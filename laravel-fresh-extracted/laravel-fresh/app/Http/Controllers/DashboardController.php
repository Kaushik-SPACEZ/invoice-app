<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\Notification;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary()
    {
        $userId = auth()->id();
        $today = now()->toDateString();
        $monthStart = now()->startOfMonth()->toDateString();

        $todaySales = SalesOrder::where('user_id', $userId)->whereDate('order_date', $today)->sum('net_revenue');
        $monthlyRevenue = SalesOrder::where('user_id', $userId)->whereDate('order_date', '>=', $monthStart)->sum('total_amount');
        $netProfit = SalesOrder::where('user_id', $userId)->whereDate('order_date', '>=', $monthStart)->sum('net_revenue');

        $gstPayable = DB::table('gst_records')
            ->where('user_id', $userId)
            ->whereMonth('transaction_date', now()->month)
            ->sum(DB::raw('cgst_amount + sgst_amount + igst_amount'));

        $totalProducts = Product::where('user_id', $userId)->count();
        $lowStockCount = Product::where('user_id', $userId)
            ->whereRaw('current_stock > 0 AND current_stock <= min_stock_level')
            ->count();
        $outOfStockCount = Product::where('user_id', $userId)->where('current_stock', 0)->count();

        $recentInvoices = Invoice::where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        $unreadNotifications = Notification::where('user_id', $userId)->where('is_read', false)->count();

        return response()->json([
            'success' => true,
            'data' => compact(
                'todaySales', 'monthlyRevenue', 'gstPayable', 'netProfit',
                'totalProducts', 'lowStockCount', 'outOfStockCount',
                'recentInvoices', 'unreadNotifications'
            ),
        ]);
    }

    public function revenueChart(\Illuminate\Http\Request $request)
    {
        $userId = auth()->id();
        $period = $request->period ?? 'monthly';

        $data = SalesOrder::where('user_id', $userId)
            ->selectRaw('DATE_FORMAT(order_date, "%b") as label, SUM(total_amount) as revenue, SUM(net_revenue) as profit')
            ->whereYear('order_date', now()->year)
            ->groupByRaw('MONTH(order_date), DATE_FORMAT(order_date, "%b")')
            ->orderByRaw('MONTH(order_date)')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'labels' => $data->pluck('label'),
                'datasets' => [
                    ['name' => 'Revenue', 'data' => $data->pluck('revenue')],
                    ['name' => 'Profit', 'data' => $data->pluck('profit')],
                ],
            ],
        ]);
    }

    public function recentActivity()
    {
        $userId = auth()->id();
        $logs = \App\Models\AuditLog::where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();
        return response()->json(['success' => true, 'data' => $logs]);
    }
}
