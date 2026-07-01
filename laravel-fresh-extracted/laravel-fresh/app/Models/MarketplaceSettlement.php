<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MarketplaceSettlement extends Model
{
    public $timestamps = false;
    const CREATED_AT = 'created_at';
    const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'marketplace', 'settlement_id', 'period_start', 'period_end',
        'gross_sales', 'returns_refunds', 'marketplace_commission', 'tds_deducted',
        'payment_received', 'expected_amount', 'difference', 'status', 'settled_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'settled_at' => 'datetime',
    ];
}
