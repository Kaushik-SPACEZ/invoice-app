<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Expense;

class ExpenseService
{
    public function extractFromInvoice(Invoice $invoice): void
    {
        $data = $invoice->validated_data ?? $invoice->extracted_data ?? [];

        $expenseMap = [
            'shipping_charges' => 'Shipping',
            'commission_amount' => 'Marketplace Commission',
        ];

        foreach ($expenseMap as $field => $category) {
            if (!empty($data[$field]) && $data[$field] > 0) {
                Expense::create([
                    'user_id' => $invoice->user_id,
                    'invoice_id' => $invoice->id,
                    'category' => $category,
                    'description' => "{$category} for invoice #{$invoice->invoice_number}",
                    'amount' => $data[$field],
                    'expense_date' => $invoice->invoice_date ?? now()->toDateString(),
                    'marketplace' => $invoice->marketplace,
                ]);
            }
        }
    }
}

namespace App\Services;

class NotificationService
{
    public function checkAndNotify(\App\Models\Invoice $invoice): void
    {
        // Check for duplicate invoice
        $duplicate = \App\Models\Invoice::where('user_id', $invoice->user_id)
            ->where('invoice_number', $invoice->invoice_number)
            ->where('id', '!=', $invoice->id)
            ->where('processing_status', 'approved')
            ->exists();

        if ($duplicate) {
            \App\Models\Notification::create([
                'user_id' => $invoice->user_id,
                'type' => 'duplicate_invoice',
                'title' => 'Duplicate Invoice Detected',
                'message' => "Invoice #{$invoice->invoice_number} appears to already exist in the system.",
                'data' => ['invoice_id' => $invoice->id],
            ]);
        }

        // Low AI confidence
        if ($invoice->ai_confidence_score < 80) {
            \App\Models\Notification::create([
                'user_id' => $invoice->user_id,
                'type' => 'ai_low_confidence',
                'title' => 'Low AI Confidence',
                'message' => "Invoice #{$invoice->invoice_number} was extracted with {$invoice->ai_confidence_score}% confidence. Please verify the data.",
                'data' => ['invoice_id' => $invoice->id, 'score' => $invoice->ai_confidence_score],
            ]);
        }
    }
}
