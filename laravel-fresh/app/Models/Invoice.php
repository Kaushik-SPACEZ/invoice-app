<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'file_path', 'file_type', 'original_filename',
        'invoice_number', 'invoice_date', 'marketplace',
        'vendor_name', 'vendor_gstin', 'customer_id',
        'subtotal', 'tax_amount', 'total_amount',
        'processing_status', 'ai_confidence_score',
        'extracted_data', 'validated_data', 'error_message',
        'processed_at', 'approved_at',
        'invoice_type', 'is_damaged',
        'is_credit_sale', 'credit_days', 'due_date',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'extracted_data' => 'array',
        'validated_data' => 'array',
        'processed_at' => 'datetime',
        'approved_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'ai_confidence_score' => 'decimal:2',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function lineItems() { return $this->hasMany(InvoiceLineItem::class); }
    public function salesOrder() { return $this->hasOne(SalesOrder::class); }
    public function gstRecords() { return $this->hasMany(GstRecord::class); }
    public function journalEntries() { return $this->hasMany(JournalEntry::class); }
}
