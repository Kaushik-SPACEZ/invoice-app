<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductMapping;
use App\Models\InventoryTransaction;
use App\Models\Notification;

class InventoryService
{
    public function updateFromInvoice(Invoice $invoice): void
    {
        foreach ($invoice->lineItems as $item) {

            // ── 1. Try SKU mapping first ────────────────────────────────────
            $mapping = ProductMapping::findForUser($invoice->user_id, $item->product_name ?? '');

            if ($mapping) {
                // Deduct each mapped product/quantity
                foreach ($mapping->items as $mappingItem) {
                    $product = $mappingItem->product;

                    if (!$product) {
                        continue;
                    }

                    // Scale mapped quantity by the invoice line quantity (default 1)
                    $lineQty   = max(1, (float) $item->quantity);
                    $deductQty = max(1, (int) round($mappingItem->quantity * $lineQty));

                    $before = $product->current_stock;
                    $after  = max(0, $before - $deductQty);

                    $product->update(['current_stock' => $after]);

                    InventoryTransaction::create([
                        'user_id'          => $invoice->user_id,
                        'product_id'       => $product->id,
                        'invoice_id'       => $invoice->id,
                        'transaction_type' => 'sale',
                        'quantity_change'  => -$deductQty,
                        'stock_before'     => $before,
                        'stock_after'      => $after,
                        'notes'            => 'Auto-updated via SKU mapping from invoice #' . $invoice->invoice_number,
                    ]);

                    $this->maybeNotifyLowStock($invoice->user_id, $product, $after);
                }

                // Link line item to the first mapped product for traceability
                if ($mapping->items->isNotEmpty()) {
                    $item->update(['product_id' => $mapping->items->first()->product_id]);
                }

                continue; // mapping handled — move to next line item
            }

            // ── 2. Fall back to SKU match only (NOT HSN — too ambiguous) ──────────
            $product = null;

            if ($item->sku) {
                $product = Product::where('user_id', $invoice->user_id)
                    ->where('sku', $item->sku)
                    ->first();
            }

            if (!$product) {
                // No mapping and no SKU match — notify user, do NOT guess by HSN
                Notification::create([
                    'user_id' => $invoice->user_id,
                    'type'    => 'unmapped_product',
                    'title'   => 'Unmapped Product',
                    'message' => "Product '{$item->product_name}' could not be matched to any inventory item. "
                               . "Please create a SKU mapping for it.",
                    'data'    => [
                        'product_name' => $item->product_name,
                        'sku'          => $item->sku,
                        'invoice_id'   => $invoice->id,
                        'line_item_id' => $item->id,
                    ],
                ]);
                continue;
            }

            // SKU/HSN match found — deduct as before
            $before = $product->current_stock;
            $qty    = max(1, (int) round($item->quantity));
            $after  = max(0, $before - $qty);

            $product->update(['current_stock' => $after]);

            InventoryTransaction::create([
                'user_id'          => $invoice->user_id,
                'product_id'       => $product->id,
                'invoice_id'       => $invoice->id,
                'transaction_type' => 'sale',
                'quantity_change'  => -$qty,
                'stock_before'     => $before,
                'stock_after'      => $after,
                'notes'            => 'Auto-updated from invoice #' . $invoice->invoice_number,
            ]);

            // Link line item to product
            $item->update(['product_id' => $product->id]);

            $this->maybeNotifyLowStock($invoice->user_id, $product, $after);
        }
    }

    /**
     * Process a return invoice: add stock back (or to damaged_stock if is_damaged).
     */
    public function addFromReturn(Invoice $invoice): void
    {
        foreach ($invoice->lineItems as $item) {

            $qty = max(1, (int) round($item->quantity));

            // ── 1. Try product name mapping first (same as sales) ──────────────
            $mapping = ProductMapping::findForUser($invoice->user_id, $item->product_name ?? '');

            if ($mapping) {
                foreach ($mapping->items as $mappingItem) {
                    $product = $mappingItem->product;
                    if (!$product) continue;

                    $deductQty = max(1, (int) round($mappingItem->quantity * $qty));

                    if ($invoice->is_damaged) {
                        $before = (int)($product->damaged_stock ?? 0);
                        $after  = $before + $deductQty;
                        $product->increment('damaged_stock', $deductQty);
                        InventoryTransaction::create([
                            'user_id' => $invoice->user_id, 'product_id' => $product->id,
                            'invoice_id' => $invoice->id, 'transaction_type' => 'return',
                            'quantity_change' => $deductQty, 'stock_before' => $before, 'stock_after' => $after,
                            'notes' => 'Damaged return (via mapping) from invoice #' . $invoice->invoice_number,
                        ]);
                        Notification::create([
                            'user_id' => $invoice->user_id, 'type' => 'inventory_warning',
                            'title' => 'Damaged Return Processed',
                            'message' => "{$deductQty} damaged units of '{$product->name}' added to damaged stock.",
                            'data' => ['product_id' => $product->id, 'damaged_stock' => $after],
                        ]);
                    } else {
                        $before = $product->current_stock;
                        $after  = $before + $deductQty;
                        $product->increment('current_stock', $deductQty);
                        InventoryTransaction::create([
                            'user_id' => $invoice->user_id, 'product_id' => $product->id,
                            'invoice_id' => $invoice->id, 'transaction_type' => 'return',
                            'quantity_change' => $deductQty, 'stock_before' => $before, 'stock_after' => $after,
                            'notes' => 'Regular return (via mapping) from invoice #' . $invoice->invoice_number,
                        ]);
                        Notification::create([
                            'user_id' => $invoice->user_id, 'type' => 'inventory_update',
                            'title' => 'Return Processed',
                            'message' => "{$deductQty} units of '{$product->name}' restored to stock.",
                            'data' => ['product_id' => $product->id, 'current_stock' => $after],
                        ]);
                    }
                }
                continue; // mapping handled
            }

            // ── 2. Fall back to SKU exact match ────────────────────────────────
            $product = null;
            if ($item->sku) {
                $product = Product::where('user_id', $invoice->user_id)
                    ->where('sku', $item->sku)
                    ->first();
            }

            if (!$product) {
                Notification::create([
                    'user_id' => $invoice->user_id,
                    'type'    => 'inventory_warning',
                    'title'   => 'Unknown Product on Return',
                    'message' => "Return invoice: Product '{$item->product_name}' (SKU: {$item->sku}) not found in inventory. Please create a mapping.",
                    'data'    => ['sku' => $item->sku, 'invoice_id' => $invoice->id],
                ]);
                continue;
            }

            if ($invoice->is_damaged) {
                $before = (int)($product->damaged_stock ?? 0);
                $after  = $before + $qty;
                $product->increment('damaged_stock', $qty);
                InventoryTransaction::create([
                    'user_id' => $invoice->user_id, 'product_id' => $product->id,
                    'invoice_id' => $invoice->id, 'transaction_type' => 'return',
                    'quantity_change' => $qty, 'stock_before' => $before, 'stock_after' => $after,
                    'notes' => 'Damaged return from invoice #' . $invoice->invoice_number,
                ]);
                Notification::create([
                    'user_id' => $invoice->user_id, 'type' => 'inventory_warning',
                    'title' => 'Damaged Return Processed',
                    'message' => "{$qty} damaged units of '{$product->name}' added to damaged stock.",
                    'data' => ['product_id' => $product->id, 'damaged_stock' => $after, 'invoice_id' => $invoice->id],
                ]);
            } else {
                $before = $product->current_stock;
                $after  = $before + $qty;
                $product->increment('current_stock', $qty);
                InventoryTransaction::create([
                    'user_id' => $invoice->user_id, 'product_id' => $product->id,
                    'invoice_id' => $invoice->id, 'transaction_type' => 'return',
                    'quantity_change' => $qty, 'stock_before' => $before, 'stock_after' => $after,
                    'notes' => 'Regular return from invoice #' . $invoice->invoice_number,
                ]);
                Notification::create([
                    'user_id' => $invoice->user_id, 'type' => 'inventory_update',
                    'title' => 'Return Processed',
                    'message' => "{$qty} units of '{$product->name}' restored to stock.",
                    'data' => ['product_id' => $product->id, 'current_stock' => $after, 'invoice_id' => $invoice->id],
                ]);
            }

            $item->update(['product_id' => $product->id]);
        }
    }

    /**
     * Fire low-stock or out-of-stock notifications when thresholds are crossed.
     */
    private function maybeNotifyLowStock(int $userId, Product $product, int $after): void
    {
        if ($after === 0) {
            Notification::create([
                'user_id' => $userId,
                'type'    => 'inventory_warning',
                'title'   => 'Out of Stock',
                'message' => "{$product->name} is now out of stock.",
                'data'    => ['product_id' => $product->id],
            ]);
        } elseif ($after <= $product->min_stock_level && $after > 0) {
            Notification::create([
                'user_id' => $userId,
                'type'    => 'low_stock',
                'title'   => 'Low Stock Alert',
                'message' => "{$product->name} has only {$after} units left.",
                'data'    => ['product_id' => $product->id, 'current_stock' => $after],
            ]);
        }
    }
}
