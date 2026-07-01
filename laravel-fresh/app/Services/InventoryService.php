<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Product;
use App\Models\InventoryTransaction;
use App\Models\Notification;

class InventoryService
{
    public function updateFromInvoice(Invoice $invoice): void
    {
        foreach ($invoice->lineItems as $item) {
            if (!$item->sku) continue;

            $product = Product::where('user_id', $invoice->user_id)
                ->where('sku', $item->sku)
                ->first();

            if (!$product) {
                // Notify user about unknown SKU
                Notification::create([
                    'user_id' => $invoice->user_id,
                    'type' => 'inventory_warning',
                    'title' => 'Unknown Product SKU',
                    'message' => "Product with SKU '{$item->sku}' not found. Please add it to inventory.",
                    'data' => ['sku' => $item->sku, 'invoice_id' => $invoice->id],
                ]);
                continue;
            }

            $before = $product->current_stock;
            $after = max(0, $before - (int) $item->quantity);

            $product->update(['current_stock' => $after]);

            InventoryTransaction::create([
                'user_id' => $invoice->user_id,
                'product_id' => $product->id,
                'invoice_id' => $invoice->id,
                'transaction_type' => 'sale',
                'quantity_change' => -(int) $item->quantity,
                'stock_before' => $before,
                'stock_after' => $after,
                'notes' => 'Auto-updated from invoice #' . $invoice->invoice_number,
            ]);

            // Check for low stock
            if ($after <= $product->min_stock_level && $after > 0) {
                Notification::create([
                    'user_id' => $invoice->user_id,
                    'type' => 'low_stock',
                    'title' => 'Low Stock Alert',
                    'message' => "{$product->name} ({$product->sku}) has only {$after} units left. Minimum is {$product->min_stock_level}.",
                    'data' => ['product_id' => $product->id, 'current_stock' => $after],
                ]);
            } elseif ($after === 0) {
                Notification::create([
                    'user_id' => $invoice->user_id,
                    'type' => 'inventory_warning',
                    'title' => 'Out of Stock',
                    'message' => "{$product->name} ({$product->sku}) is now out of stock.",
                    'data' => ['product_id' => $product->id],
                ]);
            }
        }
    }
}
