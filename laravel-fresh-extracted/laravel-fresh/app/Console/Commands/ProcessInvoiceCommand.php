<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\InvoiceProcessingService;
use Illuminate\Console\Command;

class ProcessInvoiceCommand extends Command
{
    protected $signature = 'app:process-invoice {id}';
    protected $description = 'Process a single invoice';

    public function handle(InvoiceProcessingService $service): void
    {
        $id = $this->argument('id');
        $invoice = Invoice::find($id);
        if (!$invoice) {
            $this->error("Invoice {$id} not found");
            return;
        }
        $this->info("Processing invoice {$id}...");
        $service->processInvoice($invoice);
        $this->info("Done. Status: {$invoice->fresh()->processing_status}");
    }
}
