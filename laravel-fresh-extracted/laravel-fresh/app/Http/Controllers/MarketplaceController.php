<?php

namespace App\Http\Controllers;

use App\Models\SalesOrder;
use App\Models\MarketplaceSettlement;
use Illuminate\Http\Request;

class MarketplaceController extends Controller
{
    public function analytics(Request $request)
    {
        $userId = auth()->id();
        $from = $request->from_date ?? now()->startOfMonth()->toDateString();
        $to   = $request->to_date   ?? now()->toDateString();

        $byPlatform = SalesOrder::where('user_id', $userId)
            ->whereBetween('order_date', [$from, $to])
            ->selectRaw('marketplace, SUM(total_amount) as revenue, COUNT(*) as orders, SUM(commission_amount) as commission')
            ->groupBy('marketplace')
            ->get()
            ->mapWithKeys(fn($r) => [$r->marketplace => [
                'revenue' => (float) $r->revenue,
                'orders' => (int) $r->orders,
                'commission' => (float) $r->commission,
                'commission_pct' => $r->revenue > 0 ? round(($r->commission / $r->revenue) * 100, 1) : 0,
                'returns' => SalesOrder::where('user_id', $userId)->where('marketplace', $r->marketplace)->where('status', 'returned')->count(),
                'top_product' => '—',
            ]]);

        $totalRevenue = SalesOrder::where('user_id', $userId)->whereBetween('order_date', [$from, $to])->sum('total_amount');
        $totalCommission = SalesOrder::where('user_id', $userId)->whereBetween('order_date', [$from, $to])->sum('commission_amount');
        $totalReturns = SalesOrder::where('user_id', $userId)->whereBetween('order_date', [$from, $to])->where('status', 'returned')->count();

        return response()->json([
            'success' => true,
            'data' => compact('totalRevenue', 'totalCommission', 'totalReturns', 'byPlatform'),
        ]);
    }

    public function platformSummary($platform)
    {
        $data = SalesOrder::where('user_id', auth()->id())
            ->where('marketplace', $platform)
            ->selectRaw('SUM(total_amount) as revenue, COUNT(*) as orders, SUM(commission_amount) as commission')
            ->first();

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function settlements(Request $request)
    {
        $query = MarketplaceSettlement::where('user_id', auth()->id())
            ->orderBy('period_start', 'desc');
        if ($request->marketplace) $query->where('marketplace', $request->marketplace);
        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }
}
