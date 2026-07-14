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
        $customerType  = $customerGstin ? 'b2b' : 'b2c';
        $address       = $validatedData['customer_address'] ?? null;

        // Try to extract city, state, pincode from address string
        $city    = null;
        $state   = null;
        $pincode = null;
        if ($address) {
            // Extract pincode (6 digits)
            if (preg_match('/\b(\d{6})\b/', $address, $m)) {
                $pincode = $m[1];
            }
            // Extract state from common Indian state names
            $states = ['Maharashtra','Delhi','Karnataka','Tamil Nadu','Telangana','Gujarat','Rajasthan',
                       'Uttar Pradesh','West Bengal','Punjab','Haryana','Madhya Pradesh','Kerala',
                       'Andhra Pradesh','Bihar','Odisha','Assam','Jharkhand','Uttarakhand','Himachal Pradesh'];
            foreach ($states as $s) {
                if (stripos($address, $s) !== false) {
                    $state = $s;
                    break;
                }
            }
            // City: word before state or pincode
            $parts = array_map('trim', explode(',', $address));
            if (count($parts) >= 2) {
                $city = $parts[count($parts) - 2] ?? null;
                // Clean pincode from city
                if ($city) $city = trim(preg_replace('/\d{6}/', '', $city));
            }
        }

        // Find existing by GSTIN or name
        $customer = null;
        if ($customerGstin) {
            $customer = Customer::where('user_id', $invoice->user_id)
                ->where('gstin', $customerGstin)->first();
        }
        if (!$customer) {
            $customer = Customer::where('user_id', $invoice->user_id)
                ->where('name', $customerName)->first();
        }

        if ($customer) {
            // Update missing fields
            $updates = [];
            if (!$customer->gstin && $customerGstin)  $updates['gstin']    = $customerGstin;
            if (!$customer->city && $city)             $updates['city']     = $city;
            if (!$customer->state && $state)           $updates['state']    = $state;
            if (!$customer->pincode && $pincode)       $updates['pincode']  = $pincode;
            if (!$customer->address_line1 && $address) $updates['address_line1'] = $address;
            if (!empty($updates)) $customer->update($updates);

            $customer->increment('total_purchases');
            $customer->increment('lifetime_revenue', $invoice->total_amount);
        } else {
            $customer = Customer::create([
                'user_id'         => $invoice->user_id,
                'name'            => $customerName,
                'gstin'           => $customerGstin,
                'address_line1'   => $address,
                'city'            => $city,
                'state'           => $state,
                'pincode'         => $pincode,
                'customer_type'   => $customerType,
                'total_purchases' => 1,
                'lifetime_revenue'=> $invoice->total_amount,
            ]);
        }

        return $customer;
    }
}
