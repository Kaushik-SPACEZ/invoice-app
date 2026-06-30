<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = [
        'user_id', 'invoice_id', 'category', 'description',
        'amount', 'expense_date', 'marketplace',
    ];

    protected $casts = ['expense_date' => 'date', 'amount' => 'decimal:2'];

    public function invoice() { return $this->belongsTo(Invoice::class); }
}
