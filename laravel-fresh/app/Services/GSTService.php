<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\GstRecord;

class GSTService
{
    public function processFromInvoice(Invoice $invoice): void
    {
        foreach ($invoice->lineItems as $item) {
            $supplyType = $invoice->vendor_gstin && $invoice->customer?->gstin ? 'b2b' : 'b2c';
            $totalTax = $item->cgst_amount + $item->sgst_amount + $item->igst_amount;

            GstRecord::create([
                'user_id' => $invoice->user_id,
                'invoice_id' => $invoice->id,
                'invoice_line_item_id' => $item->id,
                'gstin_supplier' => $invoice->vendor_gstin,
                'gstin_recipient' => $invoice->customer?->gstin,
                'hsn_code' => $item->hsn_code,
                'taxable_value' => $item->taxable_value,
                'cgst_rate' => $item->cgst_rate,
                'cgst_amount' => $item->cgst_amount,
                'sgst_rate' => $item->sgst_rate,
                'sgst_amount' => $item->sgst_amount,
                'igst_rate' => $item->igst_rate,
                'igst_amount' => $item->igst_amount,
                'total_tax' => $totalTax,
                'supply_type' => $supplyType,
                'transaction_date' => $invoice->invoice_date ?? now()->toDateString(),
                'financial_year' => $this->getFinancialYear($invoice->invoice_date ?? now()),
                'quarter' => $this->getQuarter($invoice->invoice_date ?? now()),
                'month' => now()->month,
            ]);
        }
    }

    /**
     * Process a sales return: create GST records with negated amounts.
     */
    public function processReturnFromInvoice(Invoice $invoice): void
    {
        foreach ($invoice->lineItems as $item) {
            $supplyType = $invoice->vendor_gstin && $invoice->customer?->gstin ? 'b2b' : 'b2c';
            $totalTax = -1 * ($item->cgst_amount + $item->sgst_amount + $item->igst_amount);

            GstRecord::create([
                'user_id' => $invoice->user_id,
                'invoice_id' => $invoice->id,
                'invoice_line_item_id' => $item->id,
                'gstin_supplier' => $invoice->vendor_gstin,
                'gstin_recipient' => $invoice->customer?->gstin,
                'hsn_code' => $item->hsn_code,
                'taxable_value' => -1 * $item->taxable_value,
                'cgst_rate' => $item->cgst_rate,
                'cgst_amount' => -1 * $item->cgst_amount,
                'sgst_rate' => $item->sgst_rate,
                'sgst_amount' => -1 * $item->sgst_amount,
                'igst_rate' => $item->igst_rate,
                'igst_amount' => -1 * $item->igst_amount,
                'total_tax' => $totalTax,
                'supply_type' => $supplyType,
                'transaction_date' => $invoice->invoice_date ?? now()->toDateString(),
                'financial_year' => $this->getFinancialYear($invoice->invoice_date ?? now()),
                'quarter' => $this->getQuarter($invoice->invoice_date ?? now()),
                'month' => now()->month,
            ]);
        }
    }

    private function getFinancialYear($date): string
    {
        $d = is_string($date) ? \Carbon\Carbon::parse($date) : $date;
        $year = $d->month >= 4 ? $d->year : $d->year - 1;
        return $year . '-' . substr($year + 1, -2);
    }

    private function getQuarter($date): int
    {
        $d = is_string($date) ? \Carbon\Carbon::parse($date) : $date;
        $month = $d->month;
        if ($month >= 4 && $month <= 6) return 1;
        if ($month >= 7 && $month <= 9) return 2;
        if ($month >= 10 && $month <= 12) return 3;
        return 4;
    }
}
