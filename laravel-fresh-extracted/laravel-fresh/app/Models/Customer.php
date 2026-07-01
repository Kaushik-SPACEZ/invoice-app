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

