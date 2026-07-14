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
                    // Compute derived fields if not present
                    $qty       = floatval($item['quantity'] ?? 1);
                    $unitPrice = floatval($item['unit_price'] ?? 0);
                    $cgstRate  = floatval($item['cgst_rate'] ?? 0);
                    $sgstRate  = floatval($item['sgst_rate'] ?? 0);
                    $igstRate  = floatval($item['igst_rate'] ?? 0);
                    $taxable   = $item['taxable_value'] ?? round($qty * $unitPrice, 2);
                    $cgstAmt   = $item['cgst_amount']  ?? round($taxable * $cgstRate / 100, 2);
                    $sgstAmt   = $item['sgst_amount']  ?? round($taxable * $sgstRate / 100, 2);
                    $igstAmt   = $item['igst_amount']  ?? round($taxable * $igstRate / 100, 2);
                    $total     = $item['total_amount'] ?? round($taxable + $cgstAmt + $sgstAmt + $igstAmt, 2);

                    $invoice->lineItems()->create(array_merge($item, [
                        'taxable_value' => $taxable,
                        'cgst_amount'   => $cgstAmt,
                        'sgst_amount'   => $sgstAmt,
                        'igst_amount'   => $igstAmt,
                        'total_amount'  => $total,
                    ]));
                }
            }

            // Cascade updates
            if ($invoice->invoice_type === 'return') {
                $this->inventoryService->addFromReturn($invoice);
            } else {
                $this->inventoryService->updateFromInvoice($invoice);
            }
            $modulesUpdated[] = 'inventory';

            $customer = $this->customerService->updateFromInvoice($invoice, $validatedData);
            if ($customer) {
                $invoice->update(['customer_id' => $customer->id]);
            }
            $modulesUpdated[] = 'customer';

            if ($invoice->invoice_type === 'return') {
                $this->salesService->createReturnOrderFromInvoice($invoice);
            } else {
                $this->salesService->createOrderFromInvoice($invoice);
            }
            $modulesUpdated[] = 'sales';

            if ($invoice->invoice_type === 'return') {
                $this->gstService->processReturnFromInvoice($invoice);
            } else {
                $this->gstService->processFromInvoice($invoice);
            }
            $modulesUpdated[] = 'gst';

            $this->accountingService->createJournalEntries($invoice);
            $modulesUpdated[] = 'accounting';

            $this->expenseService->extractFromInvoice($invoice);
            $modulesUpdated[] = 'expenses';

            // Create outstanding entry for credit sales/purchases
            if ($invoice->is_credit_sale || $invoice->invoice_type === 'purchase') {
                $this->createOutstandingEntry($invoice);
                $modulesUpdated[] = 'outstanding';
            }

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

    private function createOutstandingEntry(\App\Models\Invoice $invoice): void
    {
        $type      = $invoice->is_credit_sale ? 'receivable' : 'payable';
        $creditDays = max(0, (int) ($invoice->credit_days ?? 30));
        $dueDate   = $invoice->invoice_date
            ? \Carbon\Carbon::parse($invoice->invoice_date)->addDays($creditDays)->toDateString()
            : now()->addDays($creditDays)->toDateString();

    private function createOutstandingEntry(\App\Models\Invoice $invoice): void
    {
        $type       = $invoice->is_credit_sale ? 'receivable' : 'payable';
        $creditDays = max(0, (int) ($invoice->credit_days ?? 30));
        $dueDate    = $invoice->invoice_date
            ? \Carbon\Carbon::parse($invoice->invoice_date)->addDays($creditDays)->toDateString()
            : now()->addDays($creditDays)->toDateString();

        // Advance amount reduces the initial balance
        $advance       = max(0, (float) ($invoice->extracted_data['advance_amount'] ?? 0));
        $totalAmount   = (float) $invoice->total_amount;
        $paidAmount    = min($advance, $totalAmount);
        $balanceAmount = round($totalAmount - $paidAmount, 2);
        $status        = $balanceAmount <= 0 ? 'paid' : ($paidAmount > 0 ? 'partial' : 'pending');

        $entryId = \Illuminate\Support\Facades\DB::table('outstanding_entries')->insertGetId([
            'user_id'        => $invoice->user_id,
            'invoice_id'     => $invoice->id,
            'customer_id'    => $invoice->customer_id,
            'vendor_name'    => $invoice->vendor_name,
            'type'           => $type,
            'total_amount'   => $totalAmount,
            'advance_amount' => $paidAmount,
            'paid_amount'    => $paidAmount,
            'balance_amount' => $balanceAmount,
            'due_date'       => $dueDate,
            'credit_days'    => $creditDays,
            'status'         => $status,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        // Record the advance as the first payment entry
        if ($paidAmount > 0) {
            \Illuminate\Support\Facades\DB::table('outstanding_payments')->insert([
                'outstanding_entry_id' => $entryId,
                'user_id'              => $invoice->user_id,
                'amount'               => $paidAmount,
                'payment_date'         => now()->toDateString(),
                'payment_method'       => 'advance',
                'notes'                => 'Advance payment at time of invoice',
                'created_at'           => now(),
                'updated_at'           => now(),
            ]);
        }
    }
}
