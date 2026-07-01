<?php

namespace App\Http\Controllers;

use App\Models\SalesOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesController extends Controller
{
    public function summary(Request $request)
    {
        $userId = auth()->id();
        $period = $request->period ?? 'month';

        $dateFrom = match($period) {
            'today' => now()->toDateString(),
            'week' => now()->startOfWeek()->toDateString(),
            'year' => now()->startOfYear()->toDateString(),
            default => now()->startOfMonth()->toDateString(),
        };

        $query = SalesOrder::where('user_id', $userId)->whereDate('order_date', '>=', $dateFrom);

        $revenue = $query->sum('total_amount');
        $orders = $query->count();
        $returns = $query->where('status', 'returned')->count();
        $avgOrderValue = $orders > 0 ? round($revenue / $orders, 2) : 0;

        $byMarketplace = SalesOrder::where('user_id', $userId)
            ->whereDate('order_date', '>=', $dateFrom)
            ->selectRaw('marketplace, SUM(total_amount) as revenue, COUNT(*) as orders, SUM(commission_amount) as commission')
            ->groupBy('marketplace')
            ->get()
            ->keyBy('marketplace');

        return response()->json([
            'success' => true,
            'data' => compact('revenue', 'orders', 'returns', 'avgOrderValue', 'byMarketplace'),
        ]);
    }

    public function index(Request $request)
    {
        $query = SalesOrder::where('user_id', auth()->id())
            ->with(['customer'])
            ->orderBy('order_date', 'desc');

        if ($request->from_date) $query->whereDate('order_date', '>=', $request->from_date);
        if ($request->to_date) $query->whereDate('order_date', '<=', $request->to_date);
        if ($request->marketplace) $query->where('marketplace', $request->marketplace);

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function show($id)
    {
        $order = SalesOrder::where('user_id', auth()->id())->with(['customer', 'invoice'])->findOrFail($id);
        return response()->json(['success' => true, 'data' => $order]);
    }

    public function byMarketplace()
    {
        $data = SalesOrder::where('user_id', auth()->id())
            ->selectRaw('marketplace, SUM(total_amount) as revenue, COUNT(*) as orders, SUM(commission_amount) as commission')
            ->groupBy('marketplace')
            ->get()
            ->keyBy('marketplace');

        return response()->json(['success' => true, 'data' => $data]);
    }
}
