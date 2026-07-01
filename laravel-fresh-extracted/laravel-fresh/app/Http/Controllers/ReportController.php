<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function index()
    {
        // List recent generated reports (simplified — no persistent storage yet)
        return response()->json(['success' => true, 'data' => []]);
    }

    public function generate(Request $request)
    {
        // In production: generate PDF/Excel/CSV via DomPDF or PhpSpreadsheet
        // For now return a placeholder report_id
        return response()->json([
            'success' => true,
            'data' => ['report_id' => rand(100, 999), 'status' => 'generating'],
        ], 202);
    }

    public function download($id)
    {
        // In production: stream the generated file
        // For now return a simple CSV placeholder
        $csv = "Date,Amount,Description\n" . now()->toDateString() . ",0,Sample Report\n";
        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"report_{$id}.csv\"",
        ]);
    }
}
