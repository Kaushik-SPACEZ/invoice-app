<?php

namespace App\Http\Controllers;

use App\Models\GstRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GSTController extends Controller
{
    public function summary(Request $request)
    {
        $userId = auth()->id();
        $year = $request->year ?? date('Y');

        $fy = ($year . '-' . substr($year + 1, -2));
        if (date('n') < 4) {
            $fy = (($year - 1) . '-' . substr($year, -2));
        }

        $records = GstRecord::where('user_id', $userId)
            ->where('financial_year', $fy)
            ->selectRaw('
                SUM(cgst_amount + sgst_amount + igst_amount) as output_tax,
                SUM(taxable_value) as taxable_value,
                quarter,
                month
            ')
            ->groupBy('quarter', 'month')
            ->get();

        $outputTax = $records->sum('output_tax');
        $inputTaxCredit = 0; // Input tax credit logic can be added later
        $netPayable = max(0, $outputTax - $inputTaxCredit);

        $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        $byMonth = GstRecord::where('user_id', $userId)
            ->where('financial_year', $fy)
            ->selectRaw('month, SUM(taxable_value) as taxable_value, SUM(cgst_amount) as cgst, SUM(sgst_amount) as sgst, SUM(igst_amount) as igst, SUM(cgst_amount+sgst_amount+igst_amount) as total')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn($r) => [
                'month' => $monthNames[$r->month - 1] ?? 'Month ' . $r->month,
                'taxable_value' => $r->taxable_value,
                'cgst' => $r->cgst,
                'sgst' => $r->sgst,
                'igst' => $r->igst,
                'total' => $r->total,
            ]);

        $byQuarter = GstRecord::where('user_id', $userId)
            ->where('financial_year', $fy)
            ->selectRaw('quarter, SUM(cgst_amount+sgst_amount+igst_amount) as output')
            ->groupBy('quarter')
            ->orderBy('quarter')
            ->get()
            ->map(fn($r) => [
                'quarter' => 'Q' . $r->quarter,
                'output' => $r->output,
                'input' => 0,
                'payable' => $r->output,
            ]);

        return response()->json([
            'success' => true,
            'data' => compact('outputTax', 'inputTaxCredit', 'netPayable', 'byMonth', 'byQuarter'),
        ]);
    }

    public function monthly($year, $month)
    {
        $records = GstRecord::where('user_id', auth()->id())
            ->whereYear('transaction_date', $year)
            ->where('month', $month)
            ->get();

        return response()->json(['success' => true, 'data' => $records]);
    }

    public function hsnSummary(Request $request)
    {
        $query = GstRecord::where('user_id', auth()->id())
            ->whereNotNull('hsn_code')
            ->selectRaw('hsn_code, SUM(taxable_value) as taxable_value, SUM(cgst_amount+sgst_amount+igst_amount) as total_tax')
            ->groupBy('hsn_code');

        if ($request->from_date) $query->where('transaction_date', '>=', $request->from_date);
        if ($request->to_date) $query->where('transaction_date', '<=', $request->to_date);

        return response()->json(['success' => true, 'data' => $query->get()]);
    }

    public function generateReport(Request $request)
    {
        // Simplified: returns a download URL placeholder
        // Full implementation uses PhpSpreadsheet/DomPDF
        return response()->json([
            'success' => true,
            'data' => [
                'download_url' => '/api/reports/1/download',
                'filename' => "GST_{$request->type}_{$request->period}.{$request->format}",
            ],
        ]);
    }
}
