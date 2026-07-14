<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\InvoiceProcessingService;
use App\Services\InvoiceApprovalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class InvoiceController extends Controller
{
    public function __construct(
        private InvoiceProcessingService $processingService,
        private InvoiceApprovalService $approvalService
    ) {}

    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file'          => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'marketplace'   => 'nullable|string',
            'invoice_type'  => 'nullable|in:sale,return,purchase,commission',
            'is_damaged'    => 'nullable',
            'is_credit_sale'=> 'nullable',
            'credit_days'   => 'nullable|integer|min:1|max:365',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $file = $request->file('file');
        $ext  = $file->getClientOriginalExtension();
        $path = $file->storeAs('invoices/' . auth()->id(), $file->hashName(), ['disk' => 'local', 'path' => storage_path('app')]);

        $invoice = Invoice::create([
            'user_id'           => auth()->id(),
            'file_path'         => $path,
            'file_type'         => $ext === 'jpeg' ? 'jpg' : $ext,
            'original_filename' => $file->getClientOriginalName(),
            'marketplace'       => $request->marketplace ?? 'other',
            'invoice_type'      => $request->invoice_type ?? 'sale',
            'is_damaged'        => $request->boolean('is_damaged', false),
            'is_credit_sale'    => $request->boolean('is_credit_sale', false),
            'credit_days'       => $request->input('credit_days', 0),
            'processing_status' => 'pending',
        ]);

        // Return response immediately, then process
        $response = response()->json([
            'success' => true,
            'data'    => ['invoice_id' => $invoice->id, 'status' => 'pending'],
            'message' => 'Invoice queued for processing',
        ], 202);

        // Commission invoices don't need AI extraction — go straight to review
        if ($invoice->invoice_type === 'commission') {
            $invoice->update(['processing_status' => 'review']);
            return $response;
        }

        // Register AI processing to run after response is sent
        $invoiceId = $invoice->id;
        register_shutdown_function(function() use ($invoiceId) {
            $inv = \App\Models\Invoice::find($invoiceId);
            if ($inv) {
                try {
                    app(\App\Services\InvoiceProcessingService::class)->processInvoice($inv);
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::error('Processing failed: ' . $e->getMessage());
                }
            }
        });

        return $response;
    }

    public function status($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);

        $stageInfo = null;
        if ($invoice->processing_status === 'processing' && $invoice->error_message) {
            $decoded = json_decode($invoice->error_message, true);
            if (is_array($decoded) && isset($decoded['stage'])) {
                $stageInfo = $decoded;
            }
        }

        $fallback = [
            'pending'    => ['stage' => 'uploading',      'progress' => 5],
            'processing' => ['stage' => 'ocr_extraction', 'progress' => 20],
            'review'     => ['stage' => 'completed',      'progress' => 100],
            'approved'   => ['stage' => 'completed',      'progress' => 100],
            'error'      => ['stage' => 'error',          'progress' => 0],
        ];

        $info = $stageInfo ?? ($fallback[$invoice->processing_status] ?? ['stage' => 'unknown', 'progress' => 0]);

        return response()->json([
            'success' => true,
            'data'    => [
                'id'                  => $invoice->id,
                'status'              => $invoice->processing_status,
                'stage'               => $info['stage'],
                'progress'            => $info['progress'],
                'label'               => $info['label'] ?? null,
                'ai_confidence_score' => $invoice->ai_confidence_score,
                'error_message'       => $invoice->processing_status === 'error' ? $invoice->error_message : null,
            ],
        ]);
    }

    public function index(Request $request)
    {
        $query = Invoice::where('user_id', auth()->id())->orderBy('created_at', 'desc');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('invoice_number', 'like', "%{$request->search}%")
                  ->orWhere('vendor_name', 'like', "%{$request->search}%");
            });
        }
        if ($request->marketplace)   $query->where('marketplace', $request->marketplace);
        if ($request->status)        $query->where('processing_status', $request->status);
        if ($request->invoice_type)  $query->where('invoice_type', $request->invoice_type);

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function show($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->with(['lineItems'])->findOrFail($id);
        return response()->json(['success' => true, 'data' => $invoice]);
    }

    public function manual(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vendor_name'  => 'required|string|max:255',
            'total_amount' => 'required|numeric|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $invoice = Invoice::create([
            'user_id'           => auth()->id(),
            'file_path'         => null,
            'file_type'         => null,
            'original_filename' => null,
            'invoice_number'    => $request->invoice_number,
            'invoice_date'      => $request->invoice_date,
            'vendor_name'       => $request->vendor_name,
            'vendor_gstin'      => $request->vendor_gstin,
            'marketplace'       => $request->marketplace ?? 'other',
            'invoice_type'      => $request->invoice_type ?? 'sale',
            'is_damaged'        => false,
            'subtotal'          => $request->subtotal ?? round($request->total_amount - ($request->tax_amount ?? 0), 2),
            'tax_amount'        => $request->tax_amount ?? 0,
            'total_amount'      => $request->total_amount,
            'processing_status' => $request->processing_status ?? 'approved',
            'approved_at'       => now(),
            'extracted_data'    => [
                'invoice_number' => $request->invoice_number,
                'invoice_date'   => $request->invoice_date,
                'vendor_name'    => $request->vendor_name,
                'vendor_gstin'   => $request->vendor_gstin,
                'customer_name'  => $request->customer_name,
                'subtotal'       => $request->subtotal ?? 0,
                'tax_amount'     => $request->tax_amount ?? 0,
                'total_amount'   => $request->total_amount,
                'line_items'     => $request->line_items ?? [],
            ],
        ]);

        // Save line items if provided
        if (!empty($request->line_items)) {
            foreach ($request->line_items as $item) {
                $invoice->lineItems()->create([
                    'product_name'  => $item['product_name'] ?? 'Unknown',
                    'sku'           => $item['sku'] ?? null,
                    'hsn_code'      => $item['hsn_code'] ?? null,
                    'quantity'      => $item['quantity'] ?? 1,
                    'unit_price'    => $item['unit_price'] ?? 0,
                    'discount'      => $item['discount'] ?? 0,
                    'taxable_value' => $item['taxable_value'] ?? round(($item['quantity'] ?? 1) * ($item['unit_price'] ?? 0), 2),
                    'cgst_rate'     => $item['cgst_rate'] ?? 0,
                    'cgst_amount'   => $item['cgst_amount'] ?? 0,
                    'sgst_rate'     => $item['sgst_rate'] ?? 0,
                    'sgst_amount'   => $item['sgst_amount'] ?? 0,
                    'igst_rate'     => $item['igst_rate'] ?? 0,
                    'igst_amount'   => $item['igst_amount'] ?? 0,
                    'total_amount'  => $item['total_amount'] ?? 0,
                    'confidence_score' => 100,
                ]);
            }
        }

        // Run approval cascade for sale/purchase manual invoices
        if (in_array($invoice->invoice_type, ['sale', 'purchase']) && $invoice->processing_status === 'approved') {
            try {
                $this->approvalService->approve($invoice, $invoice->extracted_data ?? []);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::warning('Manual invoice cascade: ' . $e->getMessage());
            }
        }

        return response()->json(['success' => true, 'data' => $invoice->fresh(), 'message' => 'Invoice created'], 201);
    }

    public function approve(Request $request, $id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);

        // Idempotent: if already approved, return success without re-running cascade
        if ($invoice->processing_status === 'approved') {
            return response()->json([
                'success' => true,
                'data'    => ['invoice' => $invoice->fresh(), 'modules_updated' => []],
                'message' => 'Invoice was already approved',
            ]);
        }

        $validatedData = $request->input('validated_data', []);
        if (!is_array($validatedData)) {
            $validatedData = [];
        }

        try {
            $result = $this->approvalService->approve($invoice, $validatedData);
            return response()->json(['success' => true, 'data' => $result, 'message' => 'Invoice approved successfully']);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Invoice approval failed: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            return response()->json(['success' => false, 'message' => 'Approval failed: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);
        $invoice->update($request->only(['invoice_number', 'invoice_date', 'marketplace', 'vendor_name', 'vendor_gstin', 'processing_status']));
        return response()->json(['success' => true, 'data' => $invoice]);
    }

    public function destroy($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);
        Storage::delete($invoice->file_path);
        $invoice->delete();
        return response()->json(['success' => true, 'message' => 'Invoice deleted']);
    }

    public function download($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);
        // Try private/ first (Laravel 11 default), then app/ (legacy)
        $path = storage_path('app/private/' . $invoice->file_path);
        if (!file_exists($path)) {
            $path = storage_path('app/' . $invoice->file_path);
        }
        if (!file_exists($path)) {
            return response()->json(['success' => false, 'message' => 'File not found'], 404);
        }
        return response()->download($path, $invoice->original_filename);
    }
}
