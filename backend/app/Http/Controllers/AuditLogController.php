<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::where('user_id', auth()->id())->orderBy('created_at', 'desc');

        if ($request->from_date) $query->whereDate('created_at', '>=', $request->from_date);
        if ($request->to_date)   $query->whereDate('created_at', '<=', $request->to_date);
        if ($request->action)    $query->where('action', $request->action);
        if ($request->entity_type) $query->where('entity_type', $request->entity_type);

        $paginated = $query->paginate(30);

        // Attach user name
        $data = $paginated->through(fn($log) => array_merge($log->toArray(), [
            'user' => auth()->user()->name,
        ]));

        return response()->json(['success' => true, 'data' => $data]);
    }
}
