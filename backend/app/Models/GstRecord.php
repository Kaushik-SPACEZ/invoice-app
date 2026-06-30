<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GstRecord extends Model
{
    public $timestamps = false;
    protected $fillable = [
        'user_id', 'invoice_id', 'invoice_line_item_id',
        'gstin_supplier', 'gstin_recipient', 'hsn_code',
        'taxable_value', 'cgst_rate', 'cgst_amount',
        'sgst_rate', 'sgst_amount', 'igst_rate', 'igst_amount',
        'total_tax', 'supply_type', 'transaction_date',
        'financial_year', 'quarter', 'month',
    ];

    protected $casts = ['transaction_date' => 'date'];

    public function invoice() { return $this->belongsTo(Invoice::class); }
}
