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
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240',
            'marketplace' => 'nullable|in:amazon,flipkart,meesho,other',
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
            'processing_status' => 'pending',
        ]);

        // Return response immediately, then process
        $response = response()->json([
            'success' => true,
            'data'    => ['invoice_id' => $invoice->id, 'status' => 'pending'],
            'message' => 'Invoice queued for processing',
        ], 202);

        // Register processing to run after response is sent
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
        if ($request->marketplace) $query->where('marketplace', $request->marketplace);
        if ($request->status)      $query->where('processing_status', $request->status);

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function show($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->with(['lineItems'])->findOrFail($id);
        return response()->json(['success' => true, 'data' => $invoice]);
    }

    public function approve(Request $request, $id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);
        $result  = $this->approvalService->approve($invoice, $request->validated_data ?? []);
        return response()->json(['success' => true, 'data' => $result, 'message' => 'Invoice approved successfully']);
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
        $path    = storage_path('app/' . $invoice->file_path);
        if (!file_exists($path)) {
            return response()->json(['success' => false, 'message' => 'File not found'], 404);
        }
        return response()->download($path, $invoice->original_filename);
    }
}
