<?php

namespace App\Http\Controllers;

use App\Models\JournalEntry;
use App\Services\AccountingService;
use Illuminate\Http\Request;

class AccountingController extends Controller
{
    public function __construct(private AccountingService $accountingService) {}

    public function journalEntries(Request $request)
    {
        $query = JournalEntry::where('user_id', auth()->id())
            ->orderBy('entry_date', 'desc');

        if ($request->from_date) $query->whereDate('entry_date', '>=', $request->from_date);
        if ($request->to_date)   $query->whereDate('entry_date', '<=', $request->to_date);
        if ($request->account)   $query->where(function ($q) use ($request) {
            $q->where('debit_account', 'like', "%{$request->account}%")
              ->orWhere('credit_account', 'like', "%{$request->account}%");
        });

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function profitLoss(Request $request)
    {
        $from = $request->from_date ?? now()->startOfMonth()->toDateString();
        $to   = $request->to_date   ?? now()->toDateString();

        $revenue = \App\Models\SalesOrder::where('user_id', auth()->id())
            ->whereBetween('order_date', [$from, $to])
            ->sum('total_amount');

        $shipping = \App\Models\Expense::where('user_id', auth()->id())
            ->where('category', 'Shipping')
            ->whereBetween('expense_date', [$from, $to])
            ->sum('amount');

        $commission = \App\Models\Expense::where('user_id', auth()->id())
            ->where('category', 'Marketplace Commission')
            ->whereBetween('expense_date', [$from, $to])
            ->sum('amount');

        $packaging = \App\Models\Expense::where('user_id', auth()->id())
            ->where('category', 'Packaging')
            ->whereBetween('expense_date', [$from, $to])
            ->sum('amount');

        $totalExpenses = $shipping + $commission + $packaging;
        $grossProfit   = $revenue * 0.65; // estimate if no COGS tracking yet
        $cogs          = $revenue - $grossProfit;
        $operatingProfit = $grossProfit - $totalExpenses;
        $gstPayable    = \App\Models\GstRecord::where('user_id', auth()->id())
            ->whereBetween('transaction_date', [$from, $to])
            ->sum(\Illuminate\Support\Facades\DB::raw('cgst_amount + sgst_amount + igst_amount'));
        $netProfit = $operatingProfit - $gstPayable;

        return response()->json([
            'success' => true,
            'data' => [
                'revenue' => $revenue,
                'cogs' => $cogs,
                'gross_profit' => $grossProfit,
                'expenses' => ['shipping' => $shipping, 'commission' => $commission, 'packaging' => $packaging, 'total' => $totalExpenses],
                'operating_profit' => $operatingProfit,
                'gst_payable' => $gstPayable,
                'net_profit' => $netProfit,
            ],
        ]);
    }

    public function balanceSheet(Request $request)
    {
        // Simplified balance sheet
        return response()->json([
            'success' => true,
            'data' => [
                'assets' => [
                    'current' => [
                        ['name' => 'Accounts Receivable', 'amount' => 0],
                        ['name' => 'Inventory', 'amount' => 0],
                        ['name' => 'Cash & Bank', 'amount' => 0],
                    ],
                ],
                'liabilities' => [
                    'current' => [
                        ['name' => 'GST Payable', 'amount' => 0],
                        ['name' => 'Accounts Payable', 'amount' => 0],
                    ],
                ],
            ],
        ]);
    }

    public function accounts()
    {
        $defaults = [
            ['account_code' => '1000', 'account_name' => 'Cash & Bank', 'account_type' => 'asset'],
            ['account_code' => '1100', 'account_name' => 'Accounts Receivable', 'account_type' => 'asset'],
            ['account_code' => '1200', 'account_name' => 'Inventory', 'account_type' => 'asset'],
            ['account_code' => '2000', 'account_name' => 'Accounts Payable', 'account_type' => 'liability'],
            ['account_code' => '2100', 'account_name' => 'GST Payable', 'account_type' => 'liability'],
            ['account_code' => '4000', 'account_name' => 'Sales Revenue', 'account_type' => 'revenue'],
            ['account_code' => '5000', 'account_name' => 'Cost of Goods Sold', 'account_type' => 'expense'],
            ['account_code' => '5100', 'account_name' => 'Marketplace Commission Expense', 'account_type' => 'expense'],
            ['account_code' => '5200', 'account_name' => 'Shipping Expense', 'account_type' => 'expense'],
        ];
        return response()->json(['success' => true, 'data' => $defaults]);
    }
}
