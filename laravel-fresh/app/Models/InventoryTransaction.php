<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryTransaction extends Model
{
    public $timestamps = false;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'product_id', 'invoice_id',
        'transaction_type', 'quantity_change',
        'stock_before', 'stock_after', 'notes',
    ];

    public function product() { return $this->belongsTo(Product::class); }
    public function invoice() { return $this->belongsTo(Invoice::class); }
}
