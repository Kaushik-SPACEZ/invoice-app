<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\InvoiceProcessingService;
use Illuminate\Console\Command;

class ProcessPendingInvoices extends Command
{
    protected $signature = 'app:process-pending';
    protected $description = 'Process all pending invoices';

    public function handle(InvoiceProcessingService $service): void
    {
        $invoices = Invoice::where('processing_status', 'pending')->get();
        
        if ($invoices->isEmpty()) {
            $this->info('No pending invoices.');
            return;
        }

        foreach ($invoices as $invoice) {
            $this->info("Processing invoice #{$invoice->id}...");
            try {
                $service->processInvoice($invoice);
                $this->info("Done. Status: " . $invoice->fresh()->processing_status);
            } catch (\Exception $e) {
                $this->error("Failed #{$invoice->id}: " . $e->getMessage());
            }
        }
    }
}
