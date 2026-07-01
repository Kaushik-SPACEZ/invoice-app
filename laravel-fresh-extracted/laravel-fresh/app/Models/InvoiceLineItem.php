<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InvoiceLineItem extends Model
{
    protected $fillable = [
        'invoice_id', 'product_id', 'sku', 'product_name', 'hsn_code',
        'quantity', 'unit_price', 'discount', 'taxable_value',
        'cgst_rate', 'cgst_amount', 'sgst_rate', 'sgst_amount',
        'igst_rate', 'igst_amount', 'total_amount', 'confidence_score',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'taxable_value' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'confidence_score' => 'decimal:2',
    ];

    public function invoice() { return $this->belongsTo(Invoice::class); }
    public function product() { return $this->belongsTo(Product::class); }
}
