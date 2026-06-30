<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        $settings = Setting::where('user_id', auth()->id())->pluck('value', 'key');
        return response()->json(['success' => true, 'data' => $settings]);
    }

    public function update(Request $request)
    {
        foreach ($request->all() as $key => $value) {
            Setting::updateOrCreate(
                ['user_id' => auth()->id(), 'key' => $key],
                ['value' => $value]
            );
        }
        return response()->json(['success' => true, 'message' => 'Settings updated']);
    }
}
