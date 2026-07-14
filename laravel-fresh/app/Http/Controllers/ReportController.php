<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function index()
    {
        return response()->json(['success' => true, 'data' => []]);
    }

    public function generate(Request $request)
    {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'type'      => 'required|string|in:sales,purchase,gst,profit,inventory,marketplace,customer,expense,gstr1,gstr3b,hsn',
            'from_date' => 'nullable|date',
            'to_date'   => 'nullable|date',
            'format'    => 'nullable|string|in:excel,pdf,csv',
            'fields'    => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $userId    = auth()->id();
        $type      = $request->input('type');
        $fromDate  = $request->input('from_date', now()->startOfMonth()->toDateString());
        $toDate    = $request->input('to_date', now()->toDateString());
        $fields    = $request->input('fields', []);
        $format    = $request->input('format', 'excel');

        // Generate report data based on type
        $reportData = $this->buildReportData($userId, $type, $fromDate, $toDate, $fields);

        // Store report record
        $reportId = DB::table('reports')->insertGetId([
            'user_id'    => $userId,
            'type'       => $type,
            'format'     => $format,
            'from_date'  => $fromDate,
            'to_date'    => $toDate,
            'fields'     => json_encode($fields),
            'data'       => json_encode($reportData),
            'status'     => 'ready',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'report_id'  => $reportId,
                'status'     => 'ready',
                'type'       => $type,
                'rows'       => count($reportData),
            ],
        ], 200);
    }

    public function download($id)
    {
        $report = DB::table('reports')
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->first();

        if (!$report) {
            return response()->json(['success' => false, 'message' => 'Report not found'], 404);
        }

        $data   = json_decode($report->data ?? '[]', true);
        $type   = $report->type;
        $format = $report->format ?? 'excel';

        if ($format === 'pdf') {
            $html = $this->buildHtml($data, $type, $report->from_date, $report->to_date);
            return response($html, 200, [
                'Content-Type'        => 'text/html; charset=UTF-8',
                'Content-Disposition' => "inline; filename=\"{$type}_report.html\"",
                'Cache-Control'       => 'no-cache',
            ]);
        }

        // Excel — use SpreadsheetML XML format (.xls) — no packages needed
        $xls = $this->buildExcelXml($data);
        $filename = "{$type}_report_{$report->from_date}_{$report->to_date}.xls";

        return response($xls, 200, [
            'Content-Type'        => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'no-cache',
        ]);
    }

    private function buildExcelXml(array $data): string
    {
        $xml  = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        $xml .= "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" ";
        $xml .= "xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\n";
        $xml .= "<Styles><Style ss:ID=\"h\"><Font ss:Bold=\"1\"/><Interior ss:Color=\"#E8F0FE\" ss:Pattern=\"Solid\"/></Style></Styles>\n";
        $xml .= "<Worksheet ss:Name=\"Report\"><Table>\n";

        if (!empty($data)) {
            // Header row
            $xml .= "<Row>";
            foreach (array_keys($data[0]) as $header) {
                $label = ucwords(str_replace('_', ' ', $header));
                $xml .= "<Cell ss:StyleID=\"h\"><Data ss:Type=\"String\">" . htmlspecialchars($label) . "</Data></Cell>";
            }
            $xml .= "</Row>\n";

            // Data rows
            foreach ($data as $row) {
                $xml .= "<Row>";
                foreach ($row as $value) {
                    $isNum = is_numeric($value) && $value !== '';
                    $t = $isNum ? 'Number' : 'String';
                    $v = htmlspecialchars((string)($value ?? ''));
                    $xml .= "<Cell><Data ss:Type=\"{$t}\">{$v}</Data></Cell>";
                }
                $xml .= "</Row>\n";
            }
        } else {
            $xml .= "<Row><Cell><Data ss:Type=\"String\">No data for selected date range</Data></Cell></Row>\n";
        }

        $xml .= "</Table></Worksheet></Workbook>";
        return $xml;
    }

    private function buildHtml(array $data, string $type, string $from, string $to): string
    {
        $title = ucwords(str_replace('_', ' ', $type)) . ' Report';
        $headers = !empty($data) ? array_keys($data[0]) : [];

        $rows = '';
        foreach ($data as $row) {
            $rows .= '<tr>';
            foreach ($row as $val) {
                $rows .= '<td>' . htmlspecialchars((string)($val ?? '—')) . '</td>';
            }
            $rows .= '</tr>';
        }

        $ths = implode('', array_map(fn($h) => '<th>' . htmlspecialchars(ucwords(str_replace('_', ' ', $h))) . '</th>', $headers));

        return "<!DOCTYPE html><html><head><meta charset='UTF-8'>
<title>{$title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:20px}
  h2{color:#2563eb;margin-bottom:4px} p{color:#64748b;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#eff6ff;color:#1d4ed8;padding:8px 12px;text-align:left;border:1px solid #bfdbfe;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  td{padding:8px 12px;border:1px solid #e2e8f0;color:#334155}
  tr:nth-child(even) td{background:#f8fafc}
  @media print{body{margin:0}button{display:none}}
</style></head>
<body>
<button onclick='window.print()' style='margin-bottom:16px;padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px'>🖨️ Print / Save as PDF</button>
<h2>{$title}</h2>
<p>Period: {$from} to {$to} &nbsp;|&nbsp; Generated: " . date('d M Y H:i') . "</p>
" . (!empty($data) ? "<table><thead><tr>{$ths}</tr></thead><tbody>{$rows}</tbody></table>" : "<p>No data for selected date range.</p>") . "
</body></html>";
    }

    private function buildReportData(int $userId, string $type, string $fromDate, string $toDate, array $fields): array
    {
        switch ($type) {
            case 'sales':
                $orders = DB::table('sales_orders')
                    ->where('user_id', $userId)
                    ->whereBetween('order_date', [$fromDate, $toDate])
                    ->orderBy('order_date', 'desc')
                    ->get();
                return $orders->map(fn($o) => array_filter([
                    'date'        => in_array('date', $fields) || empty($fields)        ? $o->order_date      : null,
                    'order_number'=> in_array('order_number', $fields) || empty($fields) ? $o->order_number    : null,
                    'marketplace' => in_array('marketplace', $fields) || empty($fields)  ? $o->marketplace     : null,
                    'revenue'     => in_array('revenue', $fields) || empty($fields)      ? $o->total_amount    : null,
                    'tax'         => in_array('tax', $fields) || empty($fields)          ? $o->tax_amount      : null,
                    'net_revenue' => in_array('net_revenue', $fields) || empty($fields)  ? $o->net_revenue     : null,
                    'commission'  => in_array('commission', $fields)                     ? $o->commission_amount : null,
                    'status'      => in_array('status', $fields)                         ? $o->status          : null,
                ], fn($v) => $v !== null))->toArray();

            case 'inventory':
                $products = DB::table('products')
                    ->where('user_id', $userId)
                    ->orderBy('name')
                    ->get();
                return $products->map(fn($p) => array_filter([
                    'sku'           => in_array('sku', $fields) || empty($fields)           ? $p->sku             : null,
                    'name'          => in_array('name', $fields) || empty($fields)          ? $p->name            : null,
                    'category'      => in_array('category', $fields) || empty($fields)      ? $p->category        : null,
                    'current_stock' => in_array('current_stock', $fields) || empty($fields) ? $p->current_stock   : null,
                    'cost_price'    => in_array('cost_price', $fields) || empty($fields)    ? $p->cost_price      : null,
                    'selling_price' => in_array('selling_price', $fields) || empty($fields) ? $p->selling_price   : null,
                    'hsn_code'      => in_array('hsn_code', $fields)                        ? $p->hsn_code        : null,
                    'total_value'   => in_array('total_value', $fields)                     ? round($p->current_stock * $p->cost_price, 2) : null,
                ], fn($v) => $v !== null))->toArray();

            case 'gst':
            case 'gstr1':
            case 'gstr3b':
            case 'hsn':
                $records = DB::table('gst_records')
                    ->where('user_id', $userId)
                    ->whereBetween('transaction_date', [$fromDate, $toDate])
                    ->orderBy('transaction_date')
                    ->get();
                return $records->map(fn($r) => array_filter([
                    'date'       => in_array('period', $fields) || empty($fields)    ? $r->transaction_date : null,
                    'hsn_code'   => in_array('hsn_code', $fields) || empty($fields)  ? $r->hsn_code         : null,
                    'output_gst' => in_array('output_gst', $fields) || empty($fields) ? ($r->cgst_amount + $r->sgst_amount + $r->igst_amount) : null,
                    'cgst'       => in_array('cgst', $fields) || empty($fields)      ? $r->cgst_amount      : null,
                    'sgst'       => in_array('sgst', $fields) || empty($fields)      ? $r->sgst_amount      : null,
                    'igst'       => in_array('igst', $fields) || empty($fields)      ? $r->igst_amount      : null,
                ], fn($v) => $v !== null))->toArray();

            case 'customer':
                $customers = DB::table('customers')
                    ->where('customers.user_id', $userId)
                    ->leftJoin('sales_orders', 'sales_orders.customer_id', '=', 'customers.id')
                    ->selectRaw('customers.name, customers.email, customers.gstin, customers.customer_type,
                        COUNT(sales_orders.id) as total_orders, SUM(sales_orders.total_amount) as total_revenue,
                        MAX(sales_orders.order_date) as last_order')
                    ->groupBy('customers.id', 'customers.name', 'customers.email', 'customers.gstin', 'customers.customer_type')
                    ->get();
                return $customers->map(fn($c) => array_filter([
                    'name'          => in_array('name', $fields) || empty($fields)         ? $c->name          : null,
                    'email'         => in_array('email', $fields)                          ? $c->email         : null,
                    'customer_type' => in_array('marketplace', $fields) || empty($fields)  ? $c->customer_type : null,
                    'total_orders'  => in_array('total_orders', $fields) || empty($fields) ? $c->total_orders  : null,
                    'total_revenue' => in_array('total_revenue', $fields) || empty($fields)? $c->total_revenue : null,
                    'last_order'    => in_array('last_order', $fields)                     ? $c->last_order    : null,
                    'gstin'         => in_array('gstin', $fields)                          ? $c->gstin         : null,
                ], fn($v) => $v !== null))->toArray();

            case 'expense':
                $expenses = DB::table('expenses')
                    ->where('user_id', $userId)
                    ->whereBetween('expense_date', [$fromDate, $toDate])
                    ->orderBy('expense_date', 'desc')
                    ->get();
                return $expenses->map(fn($e) => array_filter([
                    'date'        => in_array('date', $fields) || empty($fields)       ? $e->expense_date  : null,
                    'category'    => in_array('category', $fields) || empty($fields)   ? $e->category      : null,
                    'amount'      => in_array('amount', $fields) || empty($fields)     ? $e->amount        : null,
                    'description' => in_array('description', $fields)                  ? $e->description   : null,
                ], fn($v) => $v !== null))->toArray();

            case 'profit':
                $months = DB::table('sales_orders')
                    ->where('user_id', $userId)
                    ->whereBetween('order_date', [$fromDate, $toDate])
                    ->selectRaw('DATE_FORMAT(order_date, "%Y-%m") as period,
                        SUM(total_amount) as revenue, SUM(net_revenue) as net_revenue,
                        SUM(commission_amount) as commission, SUM(tax_amount) as tax')
                    ->groupByRaw('DATE_FORMAT(order_date, "%Y-%m")')
                    ->orderBy('period')
                    ->get();
                return $months->map(fn($m) => [
                    'period'      => $m->period,
                    'revenue'     => $m->revenue,
                    'net_revenue' => $m->net_revenue,
                    'commission'  => $m->commission,
                    'tax'         => $m->tax,
                ])->toArray();

            case 'marketplace':
                $mp = DB::table('sales_orders')
                    ->where('user_id', $userId)
                    ->whereBetween('order_date', [$fromDate, $toDate])
                    ->selectRaw('marketplace, SUM(total_amount) as revenue,
                        COUNT(*) as orders, SUM(commission_amount) as commission')
                    ->groupBy('marketplace')
                    ->get();
                return $mp->map(fn($m) => [
                    'platform'   => $m->marketplace,
                    'revenue'    => $m->revenue,
                    'orders'     => $m->orders,
                    'commission' => $m->commission,
                ])->toArray();

            default:
                return [];
        }
    }
}

