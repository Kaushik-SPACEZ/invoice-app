<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\InvoiceProcessingService;
use App\Services\InvoiceApprovalService;
use App\Jobs\ProcessInvoiceJob;
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
        $ext = $file->getClientOriginalExtension();
        $path = $file->store('invoices/' . auth()->id(), 'local');

        $invoice = Invoice::create([
            'user_id' => auth()->id(),
            'file_path' => $path,
            'file_type' => $ext === 'jpeg' ? 'jpg' : $ext,
            'original_filename' => $file->getClientOriginalName(),
            'marketplace' => $request->marketplace ?? 'other',
            'processing_status' => 'pending',
        ]);

        ProcessInvoiceJob::dispatch($invoice)->onQueue('invoices');

        return response()->json([
            'success' => true,
            'data' => ['invoice_id' => $invoice->id, 'status' => 'pending'],
            'message' => 'Invoice queued for processing',
        ], 202);
    }

    public function status($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);

        // While processing, stage info is stored as JSON in error_message
        $stageInfo = null;
        if ($invoice->processing_status === 'processing' && $invoice->error_message) {
            $decoded = json_decode($invoice->error_message, true);
            if (is_array($decoded) && isset($decoded['stage'])) {
                $stageInfo = $decoded;
            }
        }

        $fallbackMap = [
            'pending'    => ['stage' => 'uploading',      'progress' => 5],
            'processing' => ['stage' => 'ocr_extraction', 'progress' => 20],
            'review'     => ['stage' => 'completed',      'progress' => 100],
            'approved'   => ['stage' => 'completed',      'progress' => 100],
            'error'      => ['stage' => 'error',          'progress' => 0],
        ];

        $info = $stageInfo ?? ($fallbackMap[$invoice->processing_status] ?? ['stage' => 'unknown', 'progress' => 0]);

        return response()->json([
            'success' => true,
            'data' => [
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
        $query = Invoice::where('user_id', auth()->id())
            ->with('customer')
            ->orderBy('created_at', 'desc');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('invoice_number', 'like', "%{$request->search}%")
                  ->orWhere('vendor_name', 'like', "%{$request->search}%");
            });
        }
        if ($request->marketplace) $query->where('marketplace', $request->marketplace);
        if ($request->status) $query->where('processing_status', $request->status);
        if ($request->from_date) $query->whereDate('created_at', '>=', $request->from_date);
        if ($request->to_date) $query->whereDate('created_at', '<=', $request->to_date);

        $invoices = $query->paginate($request->per_page ?? 20);

        return response()->json(['success' => true, 'data' => $invoices]);
    }

    public function show($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())
            ->with(['lineItems', 'customer'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $invoice]);
    }

    public function approve(Request $request, $id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'validated_data' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $result = $this->approvalService->approve($invoice, $request->validated_data);

        return response()->json([
            'success' => true,
            'data' => $result,
            'message' => 'Invoice approved successfully',
        ]);
    }

    public function update(Request $request, $id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);
        $invoice->update($request->only(['invoice_number', 'invoice_date', 'marketplace', 'vendor_name', 'vendor_gstin']));
        return response()->json(['success' => true, 'data' => $invoice]);
    }

    public function destroy($id)
    {
        $invoice = Invoice::where('user_id', auth()->id())->findOrFail($id);
        Storage::delete($invoice->file_path);
        $invoice->delete();
        return response()->json(['success' => true, 'message' => 'Invoice deleted']);
    }
}
