<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'user_id', 'sku', 'name', 'description', 'category',
        'hsn_code', 'unit', 'cost_price', 'selling_price',
        'current_stock', 'min_stock_level', 'max_stock_level', 'is_active',
    ];

    protected $casts = [
        'cost_price' => 'decimal:2',
        'selling_price' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function user() { return $this->belongsTo(User::class); }
    public function inventoryTransactions() { return $this->hasMany(InventoryTransaction::class); }

    public function isLowStock(): bool
    {
        return $this->current_stock > 0 && $this->current_stock <= $this->min_stock_level;
    }

    public function isOutOfStock(): bool
    {
        return $this->current_stock <= 0;
    }
}
