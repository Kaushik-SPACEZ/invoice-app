<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Customer;

class CustomerService
{
    public function updateFromInvoice(Invoice $invoice, array $validatedData): ?Customer
    {
        $customerName = $validatedData['customer_name'] ?? null;
        if (!$customerName) return null;

        $customerGstin = $validatedData['customer_gstin'] ?? null;
        $customerType = $customerGstin ? 'b2b' : 'b2c';

        // Find existing by GSTIN or name
        $customer = null;
        if ($customerGstin) {
            $customer = Customer::where('user_id', $invoice->user_id)
                ->where('gstin', $customerGstin)
                ->first();
        }
        if (!$customer) {
            $customer = Customer::where('user_id', $invoice->user_id)
                ->where('name', $customerName)
                ->first();
        }

        if ($customer) {
            $customer->increment('total_purchases');
            $customer->increment('lifetime_revenue', $invoice->total_amount);
        } else {
            $customer = Customer::create([
                'user_id' => $invoice->user_id,
                'name' => $customerName,
                'gstin' => $customerGstin,
                'address_line1' => $validatedData['customer_address'] ?? null,
                'customer_type' => $customerType,
                'total_purchases' => 1,
                'lifetime_revenue' => $invoice->total_amount,
            ]);
        }

        return $customer;
    }
}
