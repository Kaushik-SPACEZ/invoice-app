<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

class InvoiceApprovalService
{
    public function __construct(
        private InventoryService $inventoryService,
        private SalesService $salesService,
        private CustomerService $customerService,
        private GSTService $gstService,
        private AccountingService $accountingService,
        private ExpenseService $expenseService,
        private NotificationService $notificationService
    ) {}

    public function approve(Invoice $invoice, array $validatedData): array
    {
        $modulesUpdated = [];

        DB::transaction(function () use ($invoice, $validatedData, &$modulesUpdated) {
            // Save validated data
            $invoice->update([
                'validated_data' => $validatedData,
                'invoice_number' => $validatedData['invoice_number'] ?? $invoice->invoice_number,
                'invoice_date' => $validatedData['invoice_date'] ?? $invoice->invoice_date,
                'vendor_name' => $validatedData['vendor_name'] ?? $invoice->vendor_name,
                'vendor_gstin' => $validatedData['vendor_gstin'] ?? $invoice->vendor_gstin,
                'subtotal' => $validatedData['subtotal'] ?? $invoice->subtotal,
                'tax_amount' => $validatedData['tax_amount'] ?? $invoice->tax_amount,
                'total_amount' => $validatedData['total_amount'] ?? $invoice->total_amount,
                'processing_status' => 'approved',
                'approved_at' => now(),
            ]);

            // Update line items if provided
            if (!empty($validatedData['line_items'])) {
                $invoice->lineItems()->delete();
                foreach ($validatedData['line_items'] as $item) {
                    $invoice->lineItems()->create($item);
                }
            }

            // Cascade updates
            $this->inventoryService->updateFromInvoice($invoice);
            $modulesUpdated[] = 'inventory';

            $customer = $this->customerService->updateFromInvoice($invoice, $validatedData);
            if ($customer) {
                $invoice->update(['customer_id' => $customer->id]);
            }
            $modulesUpdated[] = 'customer';

            $this->salesService->createOrderFromInvoice($invoice);
            $modulesUpdated[] = 'sales';

            $this->gstService->processFromInvoice($invoice);
            $modulesUpdated[] = 'gst';

            $this->accountingService->createJournalEntries($invoice);
            $modulesUpdated[] = 'accounting';

            $this->expenseService->extractFromInvoice($invoice);
            $modulesUpdated[] = 'expenses';

            $this->notificationService->checkAndNotify($invoice);
            $modulesUpdated[] = 'notifications';

            // Audit log
            AuditLog::create([
                'user_id' => $invoice->user_id,
                'action' => 'invoice_approved',
                'entity_type' => 'invoice',
                'entity_id' => $invoice->id,
                'new_values' => ['status' => 'approved', 'total_amount' => $invoice->total_amount],
                'ip_address' => request()->ip(),
            ]);
        });

        return [
            'invoice' => $invoice->fresh(),
            'modules_updated' => $modulesUpdated,
        ];
    }
}
