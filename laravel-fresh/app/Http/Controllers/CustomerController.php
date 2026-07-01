<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = Customer::where('user_id', auth()->id())->orderBy('name');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('gstin', 'like', "%{$request->search}%")
                  ->orWhere('city', 'like', "%{$request->search}%");
            });
        }
        if ($request->customer_type) {
            $query->where('customer_type', $request->customer_type);
        }

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $v = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'nullable|email',
            'gstin' => 'nullable|string|max:15',
            'customer_type' => 'nullable|in:b2b,b2c',
        ]);
        if ($v->fails()) return response()->json(['success' => false, 'errors' => $v->errors()], 422);

        $customer = Customer::create(array_merge($request->all(), ['user_id' => auth()->id()]));
        return response()->json(['success' => true, 'data' => $customer], 201);
    }

    public function show($id)
    {
        $customer = Customer::where('user_id', auth()->id())->findOrFail($id);
        return response()->json(['success' => true, 'data' => $customer]);
    }

    public function update(Request $request, $id)
    {
        $customer = Customer::where('user_id', auth()->id())->findOrFail($id);
        $customer->update($request->all());
        return response()->json(['success' => true, 'data' => $customer]);
    }

    public function destroy($id)
    {
        Customer::where('user_id', auth()->id())->findOrFail($id)->delete();
        return response()->json(['success' => true, 'message' => 'Customer deleted']);
    }

    public function purchases($id)
    {
        $customer = Customer::where('user_id', auth()->id())->findOrFail($id);
        $purchases = \App\Models\SalesOrder::where('customer_id', $id)
            ->with('invoice')
            ->orderBy('order_date', 'desc')
            ->get()
            ->map(fn($o) => [
                'order_date' => $o->order_date,
                'invoice_number' => $o->invoice?->invoice_number,
                'marketplace' => $o->marketplace,
                'total_amount' => $o->total_amount,
            ]);

        return response()->json([
            'success' => true,
            'data' => ['customer' => $customer, 'purchases' => $purchases],
        ]);
    }
}
