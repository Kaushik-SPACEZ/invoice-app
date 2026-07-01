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
        return $this->callGroq(self::VISION_MODELS, [
            'messages' => [
                ['role'=>'system','content'=>'You are an expert Indian invoice data extractor. Return ONLY valid JSON, no markdown.'],
                ['role'=>'user','content'=>[
                    ['type'=>'image_url','image_url'=>['url'=>"data:{$mime};base64,{$base64}"]],
                    ['type'=>'text','text'=>$prompt],
                ]],
            ],
            'temperature'=>0,'max_tokens'=>2500,
        ]);
    }

    private function extractFromText(string $text, string $marketplace): array
    {
        return $this->callGroq(self::TEXT_MODELS, [
            'messages' => [
                ['role'=>'system','content'=>'You are an expert Indian invoice data extractor. Return ONLY valid JSON, no markdown.'],
                ['role'=>'user','content'=>$this->prompt($marketplace, $text)],
            ],
            'temperature'=>0,'max_tokens'=>2500,
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
                $cleaned = trim($raw); $cleaned = preg_replace(["/^```json\s*/i","/^```\s*/i","/\s*```\s*$/"], "", $cleaned); $cleaned = trim($cleaned); if(!str_starts_with($cleaned,"{")){ preg_match("/{.*}/s", $cleaned, $m); $cleaned = $m[0] ?? $cleaned; }
                $decoded = json_decode($cleaned, true);
                if (json_last_error()!==JSON_ERROR_NONE){$last='JSON parse error: '.substr($raw,0,100);continue;}
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
        $t = $text ? "\nInvoice:\n---\n".mb_substr($text,0,5000)."\n---\n" : '';
        return "{$hint} invoice.{$t}\nExtract all data. Return ONLY this JSON:\n{\"invoice_number\":null,\"invoice_date\":\"YYYY-MM-DD\",\"vendor_name\":null,\"vendor_gstin\":null,\"customer_name\":null,\"customer_gstin\":null,\"customer_address\":null,\"line_items\":[{\"sku\":null,\"product_name\":\"string\",\"hsn_code\":null,\"quantity\":1,\"unit_price\":0,\"discount\":0,\"taxable_value\":0,\"cgst_rate\":0,\"cgst_amount\":0,\"sgst_rate\":0,\"sgst_amount\":0,\"igst_rate\":0,\"igst_amount\":0,\"total_amount\":0,\"confidence_score\":85}],\"shipping_charges\":0,\"commission_amount\":0,\"subtotal\":0,\"tax_amount\":0,\"total_amount\":0,\"field_confidence\":{\"invoice_number\":80,\"invoice_date\":80,\"vendor_name\":80,\"vendor_gstin\":80,\"customer_name\":80,\"line_items\":80,\"totals\":80}}";
    }

    private function validate(array $d): array
    {
        if (!empty($d['vendor_gstin'])) $d['vendor_gstin'] = strtoupper(trim($d['vendor_gstin']));
        $scores = array_values($d['field_confidence'] ?? []);
        if (!empty($scores) && max($scores) <= 1) {
            foreach ($d['field_confidence'] as $k=>$v) $d['field_confidence'][$k] = round($v*100);
            foreach ($d['line_items']??[] as &$i) { if(isset($i['confidence_score'])&&$i['confidence_score']<=1) $i['confidence_score']=round($i['confidence_score']*100); }
        }
        $sub=0;$tax=0;
        foreach ($d['line_items']??[] as &$i) {
            $i['quantity']=(float)($i['quantity']??0); $i['unit_price']=(float)($i['unit_price']??0);
            if(!($i['taxable_value']??0)) $i['taxable_value']=round($i['quantity']*$i['unit_price']-(float)($i['discount']??0),2);
            $t=(float)($i['cgst_amount']??0)+(float)($i['sgst_amount']??0)+(float)($i['igst_amount']??0);
            $i['total_amount']=round($i['taxable_value']+$t,2); $sub+=$i['taxable_value']; $tax+=$t;
        } unset($i);
        if(!($d['subtotal']??0))   $d['subtotal']=round($sub,2);
        if(!($d['tax_amount']??0)) $d['tax_amount']=round($tax,2);
        if(!($d['total_amount']??0)) $d['total_amount']=round(($d['subtotal']??0)+($d['tax_amount']??0),2);
        if(!empty($d['invoice_date'])){try{$d['invoice_date']=\Carbon\Carbon::parse($d['invoice_date'])->format('Y-m-d');}catch(\Exception $e){$d['invoice_date']=null;}}
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
