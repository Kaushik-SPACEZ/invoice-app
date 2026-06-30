<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\JournalEntry;

class AccountingService
{
    public function createJournalEntries(Invoice $invoice): void
    {
        $entryBase = 'JE-' . $invoice->id . '-';

        $entries = [
            // 1. Revenue recognition: Debit Accounts Receivable, Credit Sales Revenue
            [
                'description' => "Revenue from invoice #{$invoice->invoice_number}",
                'debit_account' => 'Accounts Receivable',
                'credit_account' => 'Sales Revenue',
                'amount' => $invoice->subtotal,
                'entry_number' => $entryBase . '01',
            ],
            // 2. Tax liability: Debit Tax Receivable, Credit GST Payable
            [
                'description' => "GST on invoice #{$invoice->invoice_number}",
                'debit_account' => 'Tax Receivable',
                'credit_account' => 'GST Payable',
                'amount' => $invoice->tax_amount,
                'entry_number' => $entryBase . '02',
            ],
        ];

        // 3. Marketplace expenses (commission + shipping)
        $data = $invoice->validated_data ?? $invoice->extracted_data ?? [];
        if (!empty($data['commission_amount']) && $data['commission_amount'] > 0) {
            $entries[] = [
                'description' => "Marketplace commission for invoice #{$invoice->invoice_number}",
                'debit_account' => 'Marketplace Commission Expense',
                'credit_account' => 'Accounts Payable',
                'amount' => $data['commission_amount'],
                'entry_number' => $entryBase . '03',
            ];
        }

        foreach ($entries as $entry) {
            JournalEntry::create(array_merge($entry, [
                'user_id' => $invoice->user_id,
                'invoice_id' => $invoice->id,
                'entry_date' => $invoice->invoice_date ?? now()->toDateString(),
            ]));
        }
    }

    public function calculateProfit(int $userId, string $from, string $to): array
    {
        // Sum revenue from sales orders
        $revenue = \App\Models\SalesOrder::where('user_id', $userId)
            ->whereBetween('order_date', [$from, $to])
            ->sum('net_revenue');

        // Sum expenses
        $expenses = \App\Models\Expense::where('user_id', $userId)
            ->whereBetween('expense_date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category')
            ->toArray();

        $totalExpenses = array_sum($expenses);
        $netProfit = $revenue - $totalExpenses;

        return [
            'revenue' => $revenue,
            'expenses' => $expenses,
            'total_expenses' => $totalExpenses,
            'net_profit' => $netProfit,
        ];
    }
}
