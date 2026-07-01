<?php

namespace App\Jobs;

use App\Models\Invoice;
use App\Services\InvoiceProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessInvoiceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;
    public int $backoff = 30;

    public function __construct(public Invoice $invoice) {}

    public function handle(InvoiceProcessingService $service): void
    {
        Log::info("Processing invoice #{$this->invoice->id}");
        $service->processInvoice($this->invoice);
        Log::info("Invoice #{$this->invoice->id} ready for review");
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("Invoice #{$this->invoice->id} processing failed: " . $exception->getMessage());
        $this->invoice->update([
            'processing_status' => 'error',
            'error_message' => $exception->getMessage(),
        ]);
    }
}
