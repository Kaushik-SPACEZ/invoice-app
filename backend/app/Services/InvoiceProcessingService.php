<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class InvoiceProcessingService
{
    // Processing stages stored in a JSON column so frontend can poll granular progress
    private const STAGES = [
        'ocr_extraction'   => ['label' => 'Reading Invoice',    'progress' => 20],
        'llm_extraction'   => ['label' => 'Extracting Data',    'progress' => 50],
        'validation'       => ['label' => 'Checking GST',       'progress' => 70],
        'saving_items'     => ['label' => 'Saving Line Items',  'progress' => 85],
        'completed'        => ['label' => 'Done',               'progress' => 100],
    ];

    public function processInvoice(Invoice $invoice): void
    {
        try {
            // ── Stage 1: OCR ──────────────────────────────────────────────
            $this->updateStage($invoice, 'ocr_extraction');
            $rawText = $this->extractWithOCR($invoice->file_path, $invoice->file_type);

            // ── Stage 2: LLM extraction ──────────────────────────────────
            $this->updateStage($invoice, 'llm_extraction');
            $extracted = $this->extractWithLLM($rawText, $invoice->marketplace);

            // ── Stage 3: Validate ─────────────────────────────────────────
            $this->updateStage($invoice, 'validation');
            $validated = $this->validateExtractedData($extracted);
            $score = $this->calculateConfidenceScore($validated);

            // ── Stage 4: Persist line items ───────────────────────────────
            $this->updateStage($invoice, 'saving_items');
            $invoice->lineItems()->delete();
            foreach ($validated['line_items'] ?? [] as $item) {
                InvoiceLineItem::create(array_merge(
                    $this->mapLineItemFields($item),
                    ['invoice_id' => $invoice->id]
                ));
            }

            // ── Stage 5: Done ─────────────────────────────────────────────
            $invoice->update([
                'invoice_number'     => $validated['invoice_number'] ?? null,
                'invoice_date'       => $validated['invoice_date'] ?? null,
                'vendor_name'        => $validated['vendor_name'] ?? null,
                'vendor_gstin'       => $validated['vendor_gstin'] ?? null,
                'subtotal'           => $validated['subtotal'] ?? 0,
                'tax_amount'         => $validated['tax_amount'] ?? 0,
                'total_amount'       => $validated['total_amount'] ?? 0,
                'extracted_data'     => $validated,
                'ai_confidence_score'=> $score,
                'processing_status'  => 'review',
                'processed_at'       => now(),
                'error_message'      => null,
            ]);

        } catch (\Exception $e) {
            Log::error("Invoice #{$invoice->id} processing failed: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            $invoice->update([
                'processing_status' => 'error',
                'error_message'     => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    // ── OCR ──────────────────────────────────────────────────────────────────

    private function extractWithOCR(string $filePath, string $fileType): string
    {
        $fullPath = Storage::path($filePath);

        // Try pdftotext for PDFs first (fastest, most accurate)
        if ($fileType === 'pdf') {
            $text = $this->runPdfToText($fullPath);
            if (!empty(trim($text))) return $text;
        }

        // For images or scanned PDFs: convert to PNG then run Tesseract
        $pngPath = $this->ensurePng($fullPath, $fileType);
        $text = $this->runTesseract($pngPath);

        if ($pngPath !== $fullPath) @unlink($pngPath);

        if (empty(trim($text))) {
            throw new \RuntimeException('OCR produced no text. Is the file readable?');
        }

        return $text;
    }

    private function runPdfToText(string $path): string
    {
        $escaped = escapeshellarg($path);
        // pdftotext outputs to stdout with '-' as output file
        $output = shell_exec("pdftotext -layout {$escaped} - 2>/dev/null");
        return $output ?? '';
    }

    private function ensurePng(string $path, string $fileType): string
    {
        if (in_array($fileType, ['jpg', 'jpeg', 'png'])) return $path;

        // PDF → PNG via ImageMagick (for scanned PDFs)
        $tmpPng = sys_get_temp_dir() . '/inv_' . uniqid() . '.png';
        $escaped = escapeshellarg($path);
        $escapedOut = escapeshellarg($tmpPng);
        exec("convert -density 200 {$escaped}[0] -quality 90 {$escapedOut} 2>/dev/null");
        return file_exists($tmpPng) ? $tmpPng : $path;
    }

    private function runTesseract(string $imagePath): string
    {
        $outBase = sys_get_temp_dir() . '/ocr_' . uniqid();
        $escaped = escapeshellarg($imagePath);
        $escapedOut = escapeshellarg($outBase);
        // Run with English + OSD, best page segmentation for invoices
        exec("tesseract {$escaped} {$escapedOut} -l eng --psm 6 2>/dev/null");
        $result = @file_get_contents($outBase . '.txt') ?: '';
        @unlink($outBase . '.txt');
        return $result;
    }

    // ── LLM ──────────────────────────────────────────────────────────────────

    private function extractWithLLM(string $ocrText, string $marketplace): array
    {
        // Trim to ~6000 chars to stay within token limits
        $trimmedText = mb_substr($ocrText, 0, 6000);
        $prompt = $this->buildExtractionPrompt($trimmedText, $marketplace);

        $response = Http::timeout(45)
            ->withHeaders([
                'Authorization' => 'Bearer ' . config('services.openai.key'),
                'Content-Type'  => 'application/json',
            ])
            ->post('https://api.openai.com/v1/chat/completions', [
                'model'       => config('services.openai.model', 'gpt-4o-mini'),
                'messages'    => [
                    ['role' => 'system', 'content' => 'You are an expert Indian invoice data extractor. Return ONLY valid JSON with no markdown or explanation.'],
                    ['role' => 'user',   'content' => $prompt],
                ],
                'max_tokens'  => 2500,
                'temperature' => 0.0,  // zero temp for deterministic extraction
                'response_format' => ['type' => 'json_object'],
            ]);

        if (!$response->successful()) {
            $body = $response->body();
            Log::error("OpenAI API error: {$body}");
            throw new \RuntimeException("LLM extraction failed (HTTP {$response->status()}): {$body}");
        }

        $content = $response->json('choices.0.message.content', '{}');
        $decoded = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            Log::warning("LLM returned invalid JSON: {$content}");
            // Return an empty shell so we can still store partial data
            $decoded = ['invoice_number' => null, 'line_items' => [], 'field_confidence' => []];
        }

        return $decoded;
    }

    private function buildExtractionPrompt(string $text, string $marketplace): string
    {
        $marketplaceHint = match ($marketplace) {
            'amazon'   => 'This is an Amazon India seller invoice. Invoice numbers usually start with "IN-" or contain alphanumeric codes.',
            'flipkart' => 'This is a Flipkart seller invoice. Look for Flipkart-specific fields like seller ID.',
            'meesho'   => 'This is a Meesho seller invoice.',
            default    => 'This is an Indian e-commerce invoice.',
        };

        return <<<PROMPT
{$marketplaceHint}

Extract ALL structured data from this invoice text and return a single JSON object.

For each extracted field, assign a confidence score (0-100):
- 95-100: clearly visible, unambiguous
- 80-94: likely correct but minor uncertainty
- 50-79: partially readable or inferred
- 0-49: very uncertain or missing

Invoice text:
---
{$text}
---

Return this exact JSON structure. Use null for missing string fields, 0 for missing numbers:
{
  "invoice_number": "string|null",
  "invoice_date": "YYYY-MM-DD|null",
  "vendor_name": "string|null",
  "vendor_gstin": "string|null",
  "customer_name": "string|null",
  "customer_gstin": "string|null",
  "customer_address": "string|null",
  "line_items": [
    {
      "sku": "string|null",
      "product_name": "string",
      "hsn_code": "string|null",
      "quantity": 1,
      "unit_price": 0.00,
      "discount": 0.00,
      "taxable_value": 0.00,
      "cgst_rate": 0, "cgst_amount": 0.00,
      "sgst_rate": 0, "sgst_amount": 0.00,
      "igst_rate": 0, "igst_amount": 0.00,
      "total_amount": 0.00,
      "confidence_score": 85
    }
  ],
  "shipping_charges": 0.00,
  "commission_amount": 0.00,
  "packaging_charges": 0.00,
  "subtotal": 0.00,
  "tax_amount": 0.00,
  "total_amount": 0.00,
  "field_confidence": {
    "invoice_number": 0,
    "invoice_date": 0,
    "vendor_name": 0,
    "vendor_gstin": 0,
    "customer_name": 0,
    "line_items": 0,
    "totals": 0
  }
}
PROMPT;
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private function validateExtractedData(array $data): array
    {
        // Validate GSTIN format: 2-digit state + 10-char PAN + entity + Z + checksum
        $gstinPattern = '/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/';

        if (!empty($data['vendor_gstin'])) {
            $data['vendor_gstin'] = strtoupper(trim($data['vendor_gstin']));
            if (!preg_match($gstinPattern, $data['vendor_gstin'])) {
                $data['field_confidence']['vendor_gstin'] = min(
                    $data['field_confidence']['vendor_gstin'] ?? 80, 45
                );
            }
        }

        if (!empty($data['customer_gstin'])) {
            $data['customer_gstin'] = strtoupper(trim($data['customer_gstin']));
            if (!preg_match($gstinPattern, $data['customer_gstin'])) {
                $data['customer_gstin'] = null;
            }
        }

        // Validate and recalculate line item math
        $recalcSubtotal = 0;
        $recalcTax = 0;
        foreach ($data['line_items'] ?? [] as &$item) {
            $item['quantity']    = max(0, (float) ($item['quantity'] ?? 0));
            $item['unit_price']  = max(0, (float) ($item['unit_price'] ?? 0));
            $item['discount']    = max(0, (float) ($item['discount'] ?? 0));

            $expectedTaxable = round($item['quantity'] * $item['unit_price'] - $item['discount'], 2);
            if (isset($item['taxable_value']) && abs($expectedTaxable - $item['taxable_value']) > 2) {
                // LLM may have gotten quantity/price slightly wrong — trust taxable_value
                $item['confidence_score'] = min((int)($item['confidence_score'] ?? 80), 72);
            } else {
                $item['taxable_value'] = $expectedTaxable;
            }

            // Determine intra vs inter-state from GSTIN state codes
            $vendorState   = substr($data['vendor_gstin'] ?? '00', 0, 2);
            $customerState = substr($data['customer_gstin'] ?? '00', 0, 2);
            $isInterState  = $vendorState !== '00' && $customerState !== '00' && $vendorState !== $customerState;

            if ($isInterState) {
                // IGST only
                $igstRate  = (float)($item['igst_rate'] ?? ($item['cgst_rate'] ?? 0) * 2);
                $igstAmt   = round($item['taxable_value'] * $igstRate / 100, 2);
                $item['cgst_rate'] = 0; $item['cgst_amount'] = 0;
                $item['sgst_rate'] = 0; $item['sgst_amount'] = 0;
                $item['igst_rate'] = $igstRate;
                $item['igst_amount'] = $igstAmt;
            } else {
                // CGST + SGST
                $cgstRate = (float)($item['cgst_rate'] ?? 0);
                $sgstRate = (float)($item['sgst_rate'] ?? $cgstRate);
                $item['cgst_amount'] = round($item['taxable_value'] * $cgstRate / 100, 2);
                $item['sgst_amount'] = round($item['taxable_value'] * $sgstRate / 100, 2);
                $item['igst_rate'] = 0; $item['igst_amount'] = 0;
            }

            $itemTax = $item['cgst_amount'] + $item['sgst_amount'] + $item['igst_amount'];
            $item['total_amount'] = round($item['taxable_value'] + $itemTax, 2);
            $recalcSubtotal += $item['taxable_value'];
            $recalcTax      += $itemTax;
        }
        unset($item);

        // Cross-check totals — if LLM total diverges >5% use recalculated
        $llmTotal = (float)($data['total_amount'] ?? 0);
        $calcTotal = round($recalcSubtotal + $recalcTax, 2);
        if ($calcTotal > 0 && abs($llmTotal - $calcTotal) / $calcTotal > 0.05) {
            $data['subtotal']     = round($recalcSubtotal, 2);
            $data['tax_amount']   = round($recalcTax, 2);
            $data['total_amount'] = $calcTotal;
            // Lower confidence on totals
            $data['field_confidence']['totals'] = min($data['field_confidence']['totals'] ?? 80, 65);
        }

        // Normalize date
        if (!empty($data['invoice_date'])) {
            try {
                $data['invoice_date'] = \Carbon\Carbon::parse($data['invoice_date'])->format('Y-m-d');
            } catch (\Exception $e) {
                $data['invoice_date'] = null;
                $data['field_confidence']['invoice_date'] = 20;
            }
        }

        return $data;
    }

    private function calculateConfidenceScore(array $data): float
    {
        $scores = array_values($data['field_confidence'] ?? []);
        if (empty($scores)) return 70.0;
        // Weighted: penalise heavier if critical fields (invoice_number, totals) are low
        return round(array_sum($scores) / count($scores), 1);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function mapLineItemFields(array $item): array
    {
        return [
            'sku'             => $item['sku'] ?? null,
            'product_name'    => $item['product_name'] ?? 'Unknown Product',
            'hsn_code'        => $item['hsn_code'] ?? null,
            'quantity'        => $item['quantity'] ?? 1,
            'unit_price'      => $item['unit_price'] ?? 0,
            'discount'        => $item['discount'] ?? 0,
            'taxable_value'   => $item['taxable_value'] ?? 0,
            'cgst_rate'       => $item['cgst_rate'] ?? 0,
            'cgst_amount'     => $item['cgst_amount'] ?? 0,
            'sgst_rate'       => $item['sgst_rate'] ?? 0,
            'sgst_amount'     => $item['sgst_amount'] ?? 0,
            'igst_rate'       => $item['igst_rate'] ?? 0,
            'igst_amount'     => $item['igst_amount'] ?? 0,
            'total_amount'    => $item['total_amount'] ?? 0,
            'confidence_score'=> $item['confidence_score'] ?? null,
        ];
    }

    private function updateStage(Invoice $invoice, string $stage): void
    {
        $info = self::STAGES[$stage] ?? ['label' => $stage, 'progress' => 50];
        $invoice->update([
            'processing_status' => 'processing',
            // Reuse error_message column to store current stage temporarily
            // (cleared on success)
            'error_message' => json_encode(['stage' => $stage, 'progress' => $info['progress'], 'label' => $info['label']]),
        ]);
    }
}
