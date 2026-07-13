<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class InvoiceProcessingService
{
    private const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    private const VISION_MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct'];
    private const TEXT_MODELS   = ['llama-3.1-8b-instant','gemma2-9b-it','llama-3.3-70b-versatile'];

    public function processInvoice(Invoice $invoice): void
    {
        try {
            $this->updateStage($invoice, 'ocr_extraction', 20, 'Reading Invoice');
            $fullPath = storage_path('app/private/' . $invoice->file_path);
            $isImage  = in_array($invoice->file_type, ['jpg','jpeg','png']);

            if ($isImage) {
                $this->updateStage($invoice, 'llm_extraction', 50, 'Extracting Data');
                $extracted = $this->extractFromImage($fullPath, $invoice->file_type, $invoice->marketplace);
            } else {
                $text = $this->extractTextFromPDF($fullPath);
                $this->updateStage($invoice, 'llm_extraction', 50, 'Extracting Data');
                $extracted = $this->extractFromText($text, $invoice->marketplace);
            }

            $this->updateStage($invoice, 'validation', 70, 'Checking GST');
            $validated = $this->validate($extracted);
            $score     = $this->confidence($validated);

            $this->updateStage($invoice, 'saving_items', 85, 'Saving Line Items');
            $invoice->lineItems()->delete();
            foreach ($validated['line_items'] ?? [] as $item) {
                InvoiceLineItem::create(array_merge($this->mapItem($item), ['invoice_id' => $invoice->id]));
            }

            $invoice->update([
                'invoice_number'      => $validated['invoice_number'] ?? null,
                'invoice_date'        => $validated['invoice_date'] ?? null,
                'vendor_name'         => $validated['vendor_name'] ?? null,
                'vendor_gstin'        => $validated['vendor_gstin'] ?? null,
                'subtotal'            => $validated['subtotal'] ?? 0,
                'tax_amount'          => $validated['tax_amount'] ?? 0,
                'total_amount'        => $validated['total_amount'] ?? 0,
                'extracted_data'      => $validated,
                'ai_confidence_score' => $score,
                'processing_status'   => 'review',
                'error_message'       => null,
                'processed_at'        => now(),
            ]);

        } catch (\Exception $e) {
            Log::error("Invoice #{$invoice->id} failed: " . $e->getMessage());
            $invoice->update(['processing_status' => 'error', 'error_message' => $e->getMessage()]);
            throw $e;
        }
    }

    private function extractFromImage(string $path, string $type, string $marketplace): array
    {
        $base64  = base64_encode(file_get_contents($path));
        $mime    = $type === 'png' ? 'image/png' : 'image/jpeg';
        $prompt  = $this->prompt($marketplace);

        // Try Groq vision first
        try {
            return $this->callGroq(self::VISION_MODELS, [
                'messages' => [
                    ['role'=>'system','content'=>'You are an expert Indian GST invoice data extractor. You MUST extract ALL line items from the invoice — do not miss any row. For each line item, carefully read the Qty column — it may be 1 or 2 or more. Return ONLY valid JSON, no markdown, no explanation.'],
                    ['role'=>'user','content'=>[
                        ['type'=>'image_url','image_url'=>['url'=>"data:{$mime};base64,{$base64}",'detail'=>'high']],
                        ['type'=>'text','text'=>$prompt],
                    ]],
                ],
                'temperature'=>0,'max_tokens'=>4000,
            ]);
        } catch (\Exception $groqErr) {
            Log::warning("Groq vision failed, trying Gemini: " . $groqErr->getMessage());
            // Fallback to Gemini vision
            try {
                return $this->callGemini($base64, $mime, $prompt);
            } catch (\Exception $geminiErr) {
                Log::error("Both vision models failed. Groq: {$groqErr->getMessage()}, Gemini: {$geminiErr->getMessage()}");
                throw $groqErr; // rethrow original
            }
        }
    }

    private function callGemini(string $base64, string $mime, string $prompt): array
    {
        $key = env('GEMINI_API_KEY');
        if (!$key) throw new \RuntimeException('No Gemini API key configured');

        $res = Http::timeout(60)
            ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={$key}", [
                'contents' => [[
                    'parts' => [
                        ['inline_data' => ['mime_type' => $mime, 'data' => $base64]],
                        ['text' => 'You are an expert Indian GST invoice data extractor. Extract ALL line items — do not miss any row. Carefully read the Qty column for each item. Return ONLY valid JSON, no markdown. ' . $prompt],
                    ],
                ]],
                'generationConfig' => ['temperature' => 0, 'maxOutputTokens' => 4096],
            ]);

        if (!$res->successful()) {
            throw new \RuntimeException("Gemini error ({$res->status()}): " . $res->body());
        }

        $raw = $res->json('candidates.0.content.parts.0.text', '{}');
        $cleaned = trim($raw);
        $cleaned = preg_replace(["/^```json\s*/i","/^```\s*/i","/\s*```\s*$/"], "", $cleaned);
        $cleaned = trim($cleaned);
        if (!str_starts_with($cleaned, '{')) {
            preg_match('/{.*}/s', $cleaned, $m);
            $cleaned = $m[0] ?? $cleaned;
        }
        $decoded = json_decode($cleaned, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \RuntimeException('Gemini JSON parse error: ' . substr($raw, 0, 200));
        }
        return $decoded;
    }

    private function extractFromText(string $text, string $marketplace): array
    {
        return $this->callGroq(self::TEXT_MODELS, [
            'messages' => [
                ['role'=>'system','content'=>'You are an expert Indian GST invoice data extractor. Extract ALL line items — do not miss any. Read Qty carefully for each row. Return ONLY valid JSON, no markdown.'],
                ['role'=>'user','content'=>$this->prompt($marketplace, $text)],
            ],
            'temperature'=>0,'max_tokens'=>3000,
        ]);
    }

    private function callGroq(array $models, array $payload): array
    {
        $key = env('GROQ_API_KEY');
        $last = null;
        foreach ($models as $model) {
            try {
                $res = Http::timeout(45)
                    ->withHeaders(['Authorization'=>"Bearer {$key}",'Content-Type'=>'application/json'])
                    ->post(self::GROQ_API_URL, array_merge($payload, ['model'=>$model]));
                if (!$res->successful()) {
                    if (str_contains($res->body(),'rate_limit')||$res->status()===429){$last=$res->body();continue;}
                    throw new \RuntimeException("Groq error ({$res->status()}): ".$res->body());
                }
                $raw     = $res->json('choices.0.message.content','{}');
                $cleaned = trim($raw);
                $cleaned = preg_replace(["/^```json\s*/i","/^```\s*/i","/\s*```\s*$/"], "", $cleaned);
                $cleaned = trim($cleaned);
                // Find the JSON object — handle truncated responses by finding last valid }
                if (!str_starts_with($cleaned, '{')) {
                    preg_match('/{.*}/s', $cleaned, $m);
                    $cleaned = $m[0] ?? $cleaned;
                }
                // If JSON is truncated (ends mid-string), try to close it
                if (!empty($cleaned) && substr($cleaned, -1) !== '}') {
                    // Remove trailing incomplete key/value
                    // Pattern: ends with ,"key": or ,"key":"partial or ,"key":123 (no comma after)
                    // Strip back to last complete value (after last comma at top level)
                    $cleaned = preg_replace('/,\s*"[^"]*"\s*:\s*[^,\}\]]*$/', '', $cleaned);
                    $cleaned = preg_replace('/,\s*"[^"]*"\s*:\s*"[^"]*$/', '', $cleaned);
                    $cleaned = rtrim($cleaned, ',');
                    // Close open arrays and objects
                    $openBrace  = substr_count($cleaned, '{') - substr_count($cleaned, '}');
                    $openBrack  = substr_count($cleaned, '[') - substr_count($cleaned, ']');
                    $cleaned .= str_repeat(']', max(0, $openBrack));
                    $cleaned .= str_repeat('}', max(0, $openBrace));
                }
                $decoded = json_decode($cleaned, true);
                if (json_last_error()!==JSON_ERROR_NONE){
                    $last='JSON parse error: '.substr($raw,0,200);
                    Log::warning("Groq JSON parse failed, will try Gemini: " . $last);
                    continue;
                }
                return $decoded;
            } catch (\RuntimeException $e){throw $e;}
            catch (\Exception $e){$last=$e->getMessage();}
        }
        throw new \RuntimeException('All Groq models failed: '.$last);
    }

    private function extractTextFromPDF(string $path): string
    {
        $out = shell_exec('pdftotext -layout '.escapeshellarg($path).' - 2>/dev/null');
        return trim($out ?? '');
    }

    private function prompt(string $marketplace, string $text = ''): string
    {
        $hint = ['amazon'=>'Amazon India','flipkart'=>'Flipkart','meesho'=>'Meesho'][$marketplace] ?? 'Indian e-commerce';
        $t = $text ? "\nInvoice text:\n---\n".mb_substr($text,0,5000)."\n---\n" : '';

        $instructions = <<<INST
This is a {$hint} Tax Invoice.{$t}

CRITICAL RULES — READ CAREFULLY:
1. Extract EVERY line item row from the table — do not skip any row
2. The "Qty" column is the INVOICE QUANTITY — read it VERY carefully. Look at each row individually.
3. IMPORTANT VERIFICATION STEP: After reading each Qty, verify it by checking: Qty × Unit Price × (1 + Tax Rate/100) ≈ Total Amount for that row. If they don't match, trust the Total Amount column and recalculate Qty.
4. Example: If Unit Price = ₹177.97, Tax = 18%, Total = ₹420 → Qty = 420 / (177.97 × 1.18) = 420 / 210.01 ≈ 2. So Qty = 2, NOT 1.
5. "Pack of 3" or "Pack of 2" in the PRODUCT NAME is NOT the quantity. It describes the pack contents. The Qty column tells you how many packs were ordered.
6. For Amazon invoices: the SKU/ASIN is in brackets like (B0GN2XVLHS) or (HK20155) in the description — extract it as sku
7. taxable_value = Net Amount = price AFTER discount, BEFORE tax. It does NOT include tax.
8. total_amount for each line = taxable_value + tax_amount
9. If there is a Discount column, apply it: taxable_value = Gross Amount - Discount
10. The sum of all line item total_amounts MUST equal the invoice TOTAL. If not, recheck your Qty values.
11. invoice_date format: YYYY-MM-DD

Return ONLY this JSON (no markdown, no explanation) — PUT LINE ITEMS FIRST:
{"line_items":[{"sku":null,"product_name":"full product name from invoice","hsn_code":null,"quantity":1,"unit_price":0,"discount":0,"taxable_value":0,"cgst_rate":0,"cgst_amount":0,"sgst_rate":0,"sgst_amount":0,"igst_rate":0,"igst_amount":0,"total_amount":0,"confidence_score":85}],"invoice_number":null,"invoice_date":"YYYY-MM-DD","vendor_name":null,"vendor_gstin":null,"customer_name":null,"customer_gstin":null,"customer_address":null,"shipping_charges":0,"commission_amount":0,"subtotal":0,"tax_amount":0,"total_amount":0,"field_confidence":{"invoice_number":80,"invoice_date":80,"vendor_name":80,"vendor_gstin":80,"customer_name":80,"line_items":80,"totals":80}}
INST;

        return $instructions;
    }

    private function validate(array $d): array
    {
        if (!empty($d['vendor_gstin'])) $d['vendor_gstin'] = strtoupper(trim($d['vendor_gstin']));

        // Normalise confidence scores (some models return 0-1, we want 0-100)
        $scores = array_values($d['field_confidence'] ?? []);
        if (!empty($scores) && max($scores) <= 1) {
            foreach ($d['field_confidence'] as $k => $v) $d['field_confidence'][$k] = round($v * 100);
            foreach ($d['line_items'] ?? [] as &$i) {
                if (isset($i['confidence_score']) && $i['confidence_score'] <= 1)
                    $i['confidence_score'] = round($i['confidence_score'] * 100);
            }
        }

        $invoiceTotal = (float) ($d['total_amount'] ?? 0);

        // ── Per-line verification & correction ────────────────────────────────
        foreach ($d['line_items'] ?? [] as &$item) {
            $qty       = (float) ($item['quantity']    ?? 1);
            $unitPrice = (float) ($item['unit_price']  ?? 0);
            $discount  = (float) ($item['discount']    ?? 0);
            $taxable   = (float) ($item['taxable_value'] ?? 0);
            $cgstAmt   = (float) ($item['cgst_amount']  ?? 0);
            $sgstAmt   = (float) ($item['sgst_amount']  ?? 0);
            $igstAmt   = (float) ($item['igst_amount']  ?? 0);
            $lineTotal = (float) ($item['total_amount'] ?? 0);

            // 1. Derive taxable_value if missing
            if ($taxable == 0 && $unitPrice > 0) {
                $taxable = round($qty * $unitPrice - $discount, 2);
                $item['taxable_value'] = $taxable;
            }

            // 1b. CHECK: does qty × unit_price match taxable_value?
            // If not, qty is probably wrong — derive correct qty from taxable ÷ unit_price
            if ($unitPrice > 0 && $taxable > 0) {
                $impliedQtyFromTaxable = round($taxable / $unitPrice);
                if ($impliedQtyFromTaxable >= 1
                    && $impliedQtyFromTaxable <= 50
                    && $impliedQtyFromTaxable != $qty
                    && abs(($impliedQtyFromTaxable * $unitPrice) - $taxable) < 1.0
                ) {
                    // taxable ÷ unit_price gives a cleaner integer — trust it
                    $qty = $impliedQtyFromTaxable;
                    $item['quantity'] = $qty;
                }
            }

            // 2. Derive tax amounts from rates if amounts are zero
            if ($cgstAmt == 0 && ($item['cgst_rate'] ?? 0) > 0 && $taxable > 0) {
                $cgstAmt = round($taxable * $item['cgst_rate'] / 100, 2);
                $item['cgst_amount'] = $cgstAmt;
            }
            if ($sgstAmt == 0 && ($item['sgst_rate'] ?? 0) > 0 && $taxable > 0) {
                $sgstAmt = round($taxable * $item['sgst_rate'] / 100, 2);
                $item['sgst_amount'] = $sgstAmt;
            }
            if ($igstAmt == 0 && ($item['igst_rate'] ?? 0) > 0 && $taxable > 0) {
                $igstAmt = round($taxable * $item['igst_rate'] / 100, 2);
                $item['igst_amount'] = $igstAmt;
            }

            $taxTotal = $cgstAmt + $sgstAmt + $igstAmt;

            // 3. Cross-check: line total should equal taxable + tax
            $expectedTotal = round($taxable + $taxTotal, 2);
            if ($lineTotal > 0 && abs($lineTotal - $expectedTotal) > 1.0) {
                // Mismatch — trust the extracted total, back-calculate taxable
                // e.g. if AI put qty=1 but total=₹420, and igst=18% → taxable=₹355.93 → but actual item is qty=2
                // We can detect if qty*unitPrice is closer to the total
                if ($unitPrice > 0 && $qty > 0) {
                    $taxRate  = ($item['igst_rate'] ?? 0) > 0
                        ? (float) $item['igst_rate']
                        : ((float) ($item['cgst_rate'] ?? 0) + (float) ($item['sgst_rate'] ?? 0));
                    $taxMult  = 1 + ($taxRate / 100);

                    // What qty would make qty*unitPrice*taxMult ≈ lineTotal?
                    if ($taxMult > 0 && $unitPrice > 0) {
                        $impliedQty = round($lineTotal / ($unitPrice * $taxMult));
                        if ($impliedQty >= 1 && $impliedQty <= 20 && $impliedQty != $qty) {
                            // Verify: implied qty gives correct total within ₹2
                            $verifyTaxable = round($impliedQty * $unitPrice - $discount, 2);
                            $verifyTax     = round($verifyTaxable * $taxRate / 100, 2);
                            $verifyTotal   = round($verifyTaxable + $verifyTax, 2);
                            if (abs($verifyTotal - $lineTotal) <= 2.0) {
                                // Correction confirmed — update qty and taxable
                                $item['quantity']      = $impliedQty;
                                $item['taxable_value'] = $verifyTaxable;
                                if (($item['igst_rate'] ?? 0) > 0) {
                                    $item['igst_amount'] = $verifyTax;
                                } elseif (($item['cgst_rate'] ?? 0) > 0) {
                                    $item['cgst_amount'] = round($verifyTax / 2, 2);
                                    $item['sgst_amount'] = round($verifyTax / 2, 2);
                                }
                                $taxable = $verifyTaxable;
                                $taxTotal = $verifyTax;
                            }
                        }
                    }
                }
            }

            // 4. Set final correct total for the line
            // Safety: if taxable already includes tax (AI confused fields), correct it
            // Detect: taxable + igstAmt > expected total but taxable ≈ invoice total (single item case)
            $singleItem = count($d['line_items'] ?? []) === 1;
            if ($singleItem && $invoiceTotal > 0 && $taxTotal > 0 && abs($taxable + $taxTotal - $invoiceTotal) > 1.0) {
                // For single item: real taxable = invoice_total / (1 + rate/100)
                $taxRate = (float)($item['igst_rate'] ?? ((float)($item['cgst_rate']??0) + (float)($item['sgst_rate']??0)));
                if ($taxRate > 0) {
                    $realTaxable = round($invoiceTotal / (1 + $taxRate / 100), 2);
                    $realTax     = round($realTaxable * $taxRate / 100, 2);
                    if (abs($realTaxable + $realTax - $invoiceTotal) <= 1.0) {
                        $taxable = $realTaxable;
                        $item['taxable_value'] = $taxable;
                        if (($item['igst_rate'] ?? 0) > 0) {
                            $item['igst_amount'] = $realTax;
                        } else {
                            $item['cgst_amount'] = round($realTax / 2, 2);
                            $item['sgst_amount'] = round($realTax / 2, 2);
                        }
                        $taxTotal = $realTax;
                    }
                }
            }
            $item['total_amount'] = round($taxable + $taxTotal, 2);
            $item['quantity']     = (float) ($item['quantity'] ?? 1);
        }
        unset($item);

        // ── Invoice-level reconciliation ──────────────────────────────────────
        $calcSubtotal = 0;
        $calcTax      = 0;
        foreach ($d['line_items'] ?? [] as $item) {
            $calcSubtotal += (float) ($item['taxable_value'] ?? 0);
            $calcTax      += (float) ($item['cgst_amount']  ?? 0)
                           + (float) ($item['sgst_amount']  ?? 0)
                           + (float) ($item['igst_amount']  ?? 0);
        }
        $calcTotal = round($calcSubtotal + $calcTax, 2);

        // If AI total exists and there's a meaningful gap, try to reconcile
        if ($invoiceTotal > 0 && abs($calcTotal - $invoiceTotal) > 2.0) {
            $gap = round($invoiceTotal - $calcTotal, 2); // positive = we're short

            // STRATEGY: Find the item most likely to have wrong qty.
            // Prefer items where taxable_value ≈ N × unit_price for N > qty
            // (AI computed correct taxable but wrong qty field)
            $bestIdx = -1;
            $bestExtra = 0;
            $bestScore = 999;

            foreach ($d['line_items'] as $idx => $item) {
                $lineTotal  = (float)($item['total_amount'] ?? 0);
                $unitPrice  = (float)($item['unit_price']  ?? 0);
                $taxable    = (float)($item['taxable_value'] ?? 0);
                $currentQty = (float)($item['quantity'] ?? 1);
                if ($lineTotal <= 0) continue;

                // Check 1: Does gap ≈ N × line_total?
                $extraUnits = round($gap / $lineTotal);
                if ($extraUnits >= 1 && $extraUnits <= 10) {
                    $diff = abs($extraUnits * $lineTotal - $gap);
                    // Check 2: Is taxable_value already suggesting higher qty?
                    // e.g. taxable=355 but unit_price=178 and qty=1 → taxable/unit_price ≈ 2
                    $taxableImpliedQty = ($unitPrice > 0) ? round($taxable / $unitPrice) : $currentQty;
                    $taxableMatchesExtra = ($taxableImpliedQty == $currentQty + $extraUnits);

                    // Score: lower = better candidate. Prioritize items where taxable already matches
                    $score = $diff + ($taxableMatchesExtra ? 0 : 10);
                    if ($score < $bestScore) {
                        $bestScore = $score;
                        $bestIdx   = $idx;
                        $bestExtra = $extraUnits;
                    }
                }
            }

            // Apply correction to best candidate
            if ($bestIdx >= 0 && abs($bestExtra * (float)($d['line_items'][$bestIdx]['total_amount'] ?? 0) - $gap) <= 8.0) {
                $item = &$d['line_items'][$bestIdx];
                $oldQty  = (float)($item['quantity'] ?? 1);
                $newQty  = $oldQty + $bestExtra;
                $item['quantity'] = $newQty;

                // Recompute taxable from unit_price × qty (more accurate than scaling)
                $unitPrice = (float)($item['unit_price'] ?? 0);
                $discount  = (float)($item['discount']  ?? 0);
                if ($unitPrice > 0) {
                    $item['taxable_value'] = round($newQty * $unitPrice - $discount, 2);
                } else {
                    $item['taxable_value'] = round((float)($item['taxable_value'] ?? 0) * ($newQty / max($oldQty, 1)), 2);
                }

                $taxRate = (float)($item['igst_rate'] ?? 0);
                if ($taxRate > 0) {
                    $item['igst_amount'] = round($item['taxable_value'] * $taxRate / 100, 2);
                } else {
                    $item['cgst_amount'] = round($item['taxable_value'] * (float)($item['cgst_rate'] ?? 0) / 100, 2);
                    $item['sgst_amount'] = round($item['taxable_value'] * (float)($item['sgst_rate'] ?? 0) / 100, 2);
                }
                $item['total_amount'] = round($item['taxable_value'] + (float)($item['igst_amount'] ?? 0) + (float)($item['cgst_amount'] ?? 0) + (float)($item['sgst_amount'] ?? 0), 2);
                $item['confidence_score'] = min((int)($item['confidence_score'] ?? 80), 60);
                unset($item);
            }

            // Recalculate final totals
            $calcSubtotal = 0; $calcTax = 0;
            foreach ($d['line_items'] as $item) {
                $calcSubtotal += (float)($item['taxable_value'] ?? 0);
                $calcTax += (float)($item['igst_amount'] ?? 0) + (float)($item['cgst_amount'] ?? 0) + (float)($item['sgst_amount'] ?? 0);
            }
            $calcTotal = round($calcSubtotal + $calcTax, 2);

            // Still a gap? Lower confidence to flag for review
            if (abs($calcTotal - $invoiceTotal) > 5) {
                $d['field_confidence']['line_items'] = min(($d['field_confidence']['line_items'] ?? 80), 50);
                $d['field_confidence']['totals']     = min(($d['field_confidence']['totals']     ?? 80), 50);
            }
        }

        $d['subtotal']    = round($calcSubtotal, 2);
        $d['tax_amount']  = round($calcTax, 2);
        $d['total_amount'] = $invoiceTotal > 0 ? $invoiceTotal : $calcTotal;

        // ── Invoice date ──────────────────────────────────────────────────────
        if (!empty($d['invoice_date'])) {
            try {
                $d['invoice_date'] = \Carbon\Carbon::parse($d['invoice_date'])->format('Y-m-d');
            } catch (\Exception $e) {
                $d['invoice_date'] = null;
            }
        }

        return $d;
    }

    private function confidence(array $d): float
    {
        $s=array_values($d['field_confidence']??[]); return empty($s)?70.0:round(array_sum($s)/count($s),1);
    }

    private function mapItem(array $i): array
    {
        return ['sku'=>$i['sku']??null,'product_name'=>$i['product_name']??'Unknown','hsn_code'=>$i['hsn_code']??null,'quantity'=>$i['quantity']??1,'unit_price'=>$i['unit_price']??0,'discount'=>$i['discount']??0,'taxable_value'=>$i['taxable_value']??0,'cgst_rate'=>$i['cgst_rate']??0,'cgst_amount'=>$i['cgst_amount']??0,'sgst_rate'=>$i['sgst_rate']??0,'sgst_amount'=>$i['sgst_amount']??0,'igst_rate'=>$i['igst_rate']??0,'igst_amount'=>$i['igst_amount']??0,'total_amount'=>$i['total_amount']??0,'confidence_score'=>$i['confidence_score']??null];
    }

    private function updateStage(Invoice $inv, string $stage, int $progress, string $label): void
    {
        $inv->update(['processing_status'=>'processing','error_message'=>json_encode(['stage'=>$stage,'progress'=>$progress,'label'=>$label])]);
    }
}
