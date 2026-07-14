<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::where('user_id', auth()->id())->orderBy('name');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('sku', 'like', "%{$request->search}%");
            });
        }
        if ($request->category) $query->where('category', $request->category);
        if ($request->stock_level === 'low') $query->whereRaw('current_stock > 0 AND current_stock <= min_stock_level');
        if ($request->stock_level === 'zero') $query->where('current_stock', 0);
        if ($request->stock_level === 'normal') $query->whereRaw('current_stock > min_stock_level');

        return response()->json(['success' => true, 'data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $v = Validator::make($request->all(), [
            'sku' => 'required|string',
            'name' => 'required|string',
            'cost_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'current_stock' => 'nullable|integer|min:0',
            'min_stock_level' => 'nullable|integer|min:0',
        ]);
        if ($v->fails()) return response()->json(['success' => false, 'errors' => $v->errors()], 422);

        // Check unique SKU for this user
        if (Product::where('user_id', auth()->id())->where('sku', $request->sku)->exists()) {
            return response()->json(['success' => false, 'message' => 'SKU already exists'], 422);
        }

        $product = Product::create(array_merge($request->all(), ['user_id' => auth()->id()]));
        return response()->json(['success' => true, 'data' => $product], 201);
    }

    public function show($id)
    {
        $product = Product::where('user_id', auth()->id())->findOrFail($id);
        return response()->json(['success' => true, 'data' => $product]);
    }

    public function update(Request $request, $id)
    {
        $product = Product::where('user_id', auth()->id())->findOrFail($id);
        $product->update($request->all());
        return response()->json(['success' => true, 'data' => $product]);
    }

    public function destroy($id)
    {
        $product = Product::where('user_id', auth()->id())->findOrFail($id);

        // Remove from product mapping items (cascade)
        \App\Models\ProductMappingItem::where('product_id', $product->id)->each(function ($item) {
            $mapping = $item->mapping;
            $item->delete();
            if ($mapping && $mapping->items()->count() === 0) {
                $mapping->delete();
            }
        });

        // Nullify product_id on inventory_transactions (keep history, just unlink)
        \Illuminate\Support\Facades\DB::table('inventory_transactions')
            ->where('product_id', $product->id)
            ->update(['product_id' => null]);

        // Nullify product_id on invoice_line_items (keep invoice history)
        \Illuminate\Support\Facades\DB::table('invoice_line_items')
            ->where('product_id', $product->id)
            ->update(['product_id' => null]);

        $product->delete();
        return response()->json(['success' => true, 'message' => 'Product deleted']);
    }

    public function lowStock()
    {
        $products = Product::where('user_id', auth()->id())
            ->whereRaw('current_stock <= min_stock_level')
            ->orderBy('current_stock')
            ->get();
        return response()->json(['success' => true, 'data' => $products]);
    }
}
