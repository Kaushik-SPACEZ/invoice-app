<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class InvoiceProcessingService
{
    private const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

    private const VISION_MODELS = [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.2-11b-vision-preview',
        'llama-3.2-90b-vision-preview',
    ];

    private const TEXT_MODELS = [
        'llama-3.1-8b-instant',
        'gemma2-9b-it',
        'llama-3.3-70b-versatile',
    ];

    public function processInvoice(Invoice $invoice): void
    {
        try {
            $this->updateStage($invoice, 'ocr_extraction', 20, 'Reading Invoice');

            $fullPath = storage_path('app/' . $invoice->file_path);
            $isImage  = in_array($invoice->file_type, ['jpg', 'jpeg', 'png']);

            if ($isImage) {
                // Send image directly to Groq Vision
                $this->updateStage($invoice, 'llm_extraction', 50, 'Extracting Data');
                $extracted = $this->extractFromImageWithGroq($fullPath, $invoice->file_type, $invoice->marketplace);
            } else {
                // PDF: extract text first, then send to text LLM
                $text = $this->extractTextFromPDF($fullPath);
                $this->updateStage($invoice, 'llm_extraction', 50, 'Extracting Data');
                $extracted = $this->extractFromTextWithGroq($text, $invoice->marketplace);
            }

            // Validate and recalculate
            $this->updateStage($invoice, 'validation', 70, 'Checking GST');
            $validated = $this->validateExtracted($extracted);
            $score     = $this->calculateConfidence($validated);

            // Save line items
            $this->updateStage($invoice, 'saving_items', 85, 'Saving Line Items');
            $invoice->lineItems()->delete();
            foreach ($validated['line_items'] ?? [] as $item) {
                InvoiceLineItem::create(array_merge(
                    $this->mapLineItem($item),
                    ['invoice_id' => $invoice->id]
                ));
            }

            // Mark ready for review
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
            Log::error("Invoice #{$invoice->id} processing failed: " . $e->getMessage());
            $invoice->update([
                'processing_status' => 'error',
                'error_message'     => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    // ── Image extraction via Groq Vision ─────────────────────────────────────

    private function extractFromImageWithGroq(string $filePath, string $fileType, string $marketplace): array
    {
        $base64  = base64_encode(file_get_contents($filePath));
        $imgMime = $fileType === 'png' ? 'image/png' : 'image/jpeg';

        $prompt = $this->buildExtractionPrompt($marketplace);

        $payload = [
            'messages' => [
                ['role' => 'system', 'content' => 'You are an expert Indian invoice data extractor. Return ONLY valid JSON, no markdown.'],
                ['role' => 'user', 'content' => [
                    ['type' => 'image_url', 'image_url' => ['url' => "data:{$imgMime};base64,{$base64}"]],
                    ['type' => 'text', 'text' => $prompt],
                ]],
            ],
            'temperature' => 0,
            'max_tokens'  => 2500,
        ];

        return $this->callGroq(self::VISION_MODELS, $payload);
    }

    // ── Text extraction via Groq LLM ─────────────────────────────────────────

    private function extractFromTextWithGroq(string $text, string $marketplace): array
    {
        $prompt = $this->buildExtractionPrompt($marketplace, $text);

        $payload = [
            'messages' => [
                ['role' => 'system', 'content' => 'You are an expert Indian invoice data extractor. Return ONLY valid JSON, no markdown.'],
                ['role' => 'user', 'content' => $prompt],
            ],
            'temperature' => 0,
            'max_tokens'  => 2500,
        ];

        return $this->callGroq(self::TEXT_MODELS, $payload);
    }

    // ── Groq API call with model fallback ────────────────────────────────────

    private function callGroq(array $models, array $payload): array
    {
        $apiKey    = env('GROQ_API_KEY');
        $lastError = null;

        foreach ($models as $model) {
            try {
                Log::info("Groq: trying model {$model}");
                $response = Http::timeout(45)
                    ->withHeaders(['Authorization' => "Bearer {$apiKey}", 'Content-Type' => 'application/json'])
                    ->post(self::GROQ_API_URL, array_merge($payload, ['model' => $model]));

                if (!$response->successful()) {
                    $body = $response->body();
                    if (str_contains($body, 'rate_limit') || $response->status() === 429) {
                        Log::warning("Groq model {$model} rate limited, trying next");
                        $lastError = $body;
                        continue;
                    }
                    throw new \RuntimeException("Groq API error ({$response->status()}): {$body}");
                }

                $raw     = $response->json('choices.0.message.content', '{}');
                $cleaned = preg_replace('/^```json\s*/i', '', trim($raw));
                $cleaned = preg_replace('/\s*```$/', '', $cleaned);
                $decoded = json_decode($cleaned, true);

                if (json_last_error() !== JSON_ERROR_NONE) {
                    Log::warning("Groq JSON parse error for model {$model}. Raw: " . substr($raw, 0, 200));
                    continue;
                }

                Log::info("Groq success with {$model}: invoice={$decoded['invoice_number']}, items=" . count($decoded['line_items'] ?? []));
                return $decoded;

            } catch (\RuntimeException $e) {
                throw $e;
            } catch (\Exception $e) {
                $lastError = $e->getMessage();
                Log::warning("Groq model {$model} failed: {$lastError}");
            }
        }

        throw new \RuntimeException('All Groq models failed. ' . ($lastError ?? ''));
    }

    // ── PDF text extraction ──────────────────────────────────────────────────

    private function extractTextFromPDF(string $filePath): string
    {
        // Try pdftotext (available on most Linux servers)
        $escaped = escapeshellarg($filePath);
        $text    = shell_exec("pdftotext -layout {$escaped} - 2>/dev/null");
        if (!empty(trim($text ?? ''))) return $text;

        // Fallback: return empty — will be handled as image if possible
        return '';
    }

    // ── Extraction prompt ────────────────────────────────────────────────────

    private function buildExtractionPrompt(string $marketplace, string $text = ''): string
    {
        $hint = match ($marketplace) {
            'amazon'   => 'Amazon India seller invoice.',
            'flipkart' => 'Flipkart seller invoice.',
            'meesho'   => 'Meesho seller invoice.',
            default    => 'Indian e-commerce invoice.',
        };

        $textSection = $text ? "\nInvoice text:\n---\n" . mb_substr($text, 0, 5000) . "\n---\n" : '';

        return "{$hint}{$textSection}

Extract all data. Return ONLY this JSON (null for missing, 0 for missing numbers):
{
  \"invoice_number\": null,
  \"invoice_date\": \"YYYY-MM-DD or null\",
  \"vendor_name\": null,
  \"vendor_gstin\": null,
  \"customer_name\": null,
  \"customer_gstin\": null,
  \"customer_address\": null,
  \"line_items\": [{
    \"sku\": null, \"product_name\": \"string\", \"hsn_code\": null,
    \"quantity\": 1, \"unit_price\": 0, \"discount\": 0, \"taxable_value\": 0,
    \"cgst_rate\": 0, \"cgst_amount\": 0,
    \"sgst_rate\": 0, \"sgst_amount\": 0,
    \"igst_rate\": 0, \"igst_amount\": 0,
    \"total_amount\": 0, \"confidence_score\": 85
  }],
  \"shipping_charges\": 0, \"commission_amount\": 0,
  \"subtotal\": 0, \"tax_amount\": 0, \"total_amount\": 0,
  \"field_confidence\": {
    \"invoice_number\": 80, \"invoice_date\": 80, \"vendor_name\": 80,
    \"vendor_gstin\": 80, \"customer_name\": 80, \"line_items\": 80, \"totals\": 80
  }
}";
    }

    // ── Validation ───────────────────────────────────────────────────────────

    private function validateExtracted(array $data): array
    {
        // Normalize GSTIN
        if (!empty($data['vendor_gstin'])) {
            $data['vendor_gstin'] = strtoupper(trim($data['vendor_gstin']));
            if (!preg_match('/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/', $data['vendor_gstin'])) {
                if (isset($data['field_confidence']['vendor_gstin'])) {
                    $data['field_confidence']['vendor_gstin'] = min($data['field_confidence']['vendor_gstin'], 45);
                }
            }
        }

        // Normalize confidence scores (model may return 0-1 instead of 0-100)
        $scores = array_values($data['field_confidence'] ?? []);
        if (!empty($scores) && max($scores) <= 1) {
            foreach ($data['field_confidence'] as $k => $v) {
                $data['field_confidence'][$k] = round($v * 100);
            }
            foreach ($data['line_items'] ?? [] as &$item) {
                if (isset($item['confidence_score']) && $item['confidence_score'] <= 1) {
                    $item['confidence_score'] = round($item['confidence_score'] * 100);
                }
            }
        }

        // Recalculate line item totals
        $recalcSubtotal = 0;
        $recalcTax      = 0;
        foreach ($data['line_items'] ?? [] as &$item) {
            $item['quantity']    = max(0, (float)($item['quantity'] ?? 0));
            $item['unit_price']  = max(0, (float)($item['unit_price'] ?? 0));
            $item['discount']    = max(0, (float)($item['discount'] ?? 0));
            if (!isset($item['taxable_value']) || $item['taxable_value'] == 0) {
                $item['taxable_value'] = round($item['quantity'] * $item['unit_price'] - $item['discount'], 2);
            }
            $itemTax = (float)($item['cgst_amount'] ?? 0) + (float)($item['sgst_amount'] ?? 0) + (float)($item['igst_amount'] ?? 0);
            $item['total_amount'] = round($item['taxable_value'] + $itemTax, 2);
            $recalcSubtotal += $item['taxable_value'];
            $recalcTax      += $itemTax;
        }
        unset($item);

        if (!$data['subtotal'] && $recalcSubtotal > 0)  $data['subtotal']     = round($recalcSubtotal, 2);
        if (!$data['tax_amount'] && $recalcTax > 0)     $data['tax_amount']   = round($recalcTax, 2);
        if (!$data['total_amount'])                      $data['total_amount'] = round(($data['subtotal'] ?? 0) + ($data['tax_amount'] ?? 0), 2);

        // Normalize date
        if (!empty($data['invoice_date'])) {
            try {
                $data['invoice_date'] = \Carbon\Carbon::parse($data['invoice_date'])->format('Y-m-d');
            } catch (\Exception $e) {
                $data['invoice_date'] = null;
            }
        }

        return $data;
    }

    private function calculateConfidence(array $data): float
    {
        $scores = array_values($data['field_confidence'] ?? []);
        if (empty($scores)) return 70.0;
        return round(array_sum($scores) / count($scores), 1);
    }

    private function mapLineItem(array $item): array
    {
        return [
            'sku'              => $item['sku'] ?? null,
            'product_name'     => $item['product_name'] ?? 'Unknown Product',
            'hsn_code'         => $item['hsn_code'] ?? null,
            'quantity'         => $item['quantity'] ?? 1,
            'unit_price'       => $item['unit_price'] ?? 0,
            'discount'         => $item['discount'] ?? 0,
            'taxable_value'    => $item['taxable_value'] ?? 0,
            'cgst_rate'        => $item['cgst_rate'] ?? 0,
            'cgst_amount'      => $item['cgst_amount'] ?? 0,
            'sgst_rate'        => $item['sgst_rate'] ?? 0,
            'sgst_amount'      => $item['sgst_amount'] ?? 0,
            'igst_rate'        => $item['igst_rate'] ?? 0,
            'igst_amount'      => $item['igst_amount'] ?? 0,
            'total_amount'     => $item['total_amount'] ?? 0,
            'confidence_score' => $item['confidence_score'] ?? null,
        ];
    }

    private function updateStage(Invoice $invoice, string $stage, int $progress, string $label): void
    {
        $invoice->update([
            'processing_status' => 'processing',
            'error_message'     => json_encode(['stage' => $stage, 'progress' => $progress, 'label' => $label]),
        ]);
    }
}
