<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\SalesOrder;

class SalesService
{
    public function createOrderFromInvoice(Invoice $invoice): SalesOrder
    {
        $data = $invoice->validated_data ?? $invoice->extracted_data ?? [];
        $shippingCharges = $data['shipping_charges'] ?? 0;
        $commission = $data['commission_amount'] ?? 0;
        $netRevenue = $invoice->total_amount - $shippingCharges - $commission;

        return SalesOrder::create([
            'user_id' => $invoice->user_id,
            'invoice_id' => $invoice->id,
            'customer_id' => $invoice->customer_id,
            'order_number' => 'ORD-' . $invoice->id . '-' . now()->format('YmdHis'),
            'order_date' => $invoice->invoice_date ?? now()->toDateString(),
            'marketplace' => $invoice->marketplace,
            'subtotal' => $invoice->subtotal,
            'tax_amount' => $invoice->tax_amount,
            'shipping_charges' => $shippingCharges,
            'commission_amount' => $commission,
            'total_amount' => $invoice->total_amount,
            'net_revenue' => $netRevenue,
            'status' => 'completed',
        ]);
    }
}
