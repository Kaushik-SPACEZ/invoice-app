<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::where('user_id', auth()->id())->orderBy('expense_date', 'desc');

        if ($request->from_date) $query->whereDate('expense_date', '>=', $request->from_date);
        if ($request->to_date)   $query->whereDate('expense_date', '<=', $request->to_date);
        if ($request->category)  $query->where('category', $request->category);
        if ($request->marketplace) $query->where('marketplace', $request->marketplace);

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $v = Validator::make($request->all(), [
            'category' => 'required|string',
            'description' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'expense_date' => 'required|date',
        ]);
        if ($v->fails()) return response()->json(['success' => false, 'errors' => $v->errors()], 422);

        $expense = Expense::create(array_merge($request->all(), ['user_id' => auth()->id()]));
        return response()->json(['success' => true, 'data' => $expense], 201);
    }

    public function update(Request $request, $id)
    {
        $expense = Expense::where('user_id', auth()->id())->findOrFail($id);
        $expense->update($request->all());
        return response()->json(['success' => true, 'data' => $expense]);
    }

    public function destroy($id)
    {
        Expense::where('user_id', auth()->id())->findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }

    public function summary(Request $request)
    {
        $userId = auth()->id();
        $from = $request->from ?? now()->startOfMonth()->toDateString();
        $to   = $request->to   ?? now()->toDateString();

        $byCategory = Expense::where('user_id', $userId)
            ->whereBetween('expense_date', [$from, $to])
            ->selectRaw('category, SUM(amount) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        return response()->json([
            'success' => true,
            'data' => ['total' => $byCategory->sum(), 'by_category' => $byCategory],
        ]);
    }
}
