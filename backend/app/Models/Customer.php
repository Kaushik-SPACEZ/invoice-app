<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'user_id', 'name', 'email', 'phone', 'gstin',
        'address_line1', 'city', 'state', 'pincode',
        'customer_type', 'total_purchases', 'lifetime_revenue',
    ];

    protected $casts = ['lifetime_revenue' => 'decimal:2'];

    public function user() { return $this->belongsTo(User::class); }
    public function salesOrders() { return $this->hasMany(SalesOrder::class); }
}

// ─── SalesOrder ───────────────────────────────────────────────────────────────

namespace App\Models;

class SalesOrder extends \Illuminate\Database\Eloquent\Model
{
    protected $fillable = [
        'user_id', 'invoice_id', 'customer_id', 'order_number', 'order_date',
        'marketplace', 'marketplace_order_id',
        'subtotal', 'discount', 'tax_amount', 'shipping_charges',
        'commission_amount', 'total_amount', 'net_revenue', 'status',
    ];

    protected $casts = ['order_date' => 'date'];

    public function invoice() { return $this->belongsTo(Invoice::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
}
