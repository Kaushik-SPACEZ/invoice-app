<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $query = Notification::where('user_id', auth()->id())->orderBy('created_at', 'desc');
        if ($request->has('is_read')) $query->where('is_read', (bool) $request->is_read);
        $paginated = $query->paginate(20);
        $unread = Notification::where('user_id', auth()->id())->where('is_read', false)->count();
        $data = $paginated->toArray();
        $data['meta']['unread'] = $unread;
        return response()->json(['success' => true, 'data' => $data]);
    }

    public function markRead($id)
    {
        Notification::where('user_id', auth()->id())->findOrFail($id)
            ->update(['is_read' => true, 'read_at' => now()]);
        return response()->json(['success' => true]);
    }

    public function readAll()
    {
        Notification::where('user_id', auth()->id())->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);
        return response()->json(['success' => true, 'message' => 'All notifications marked as read']);
    }

    public function destroy($id)
    {
        Notification::where('user_id', auth()->id())->findOrFail($id)->delete();
        return response()->json(['success' => true]);
    }
}
