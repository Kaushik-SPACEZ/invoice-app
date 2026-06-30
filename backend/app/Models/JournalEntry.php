<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model
{
    protected $fillable = [
        'user_id', 'invoice_id', 'entry_date', 'entry_number',
        'description', 'debit_account', 'credit_account', 'amount',
    ];

    protected $casts = ['entry_date' => 'date'];

    public function invoice() { return $this->belongsTo(Invoice::class); }
}
