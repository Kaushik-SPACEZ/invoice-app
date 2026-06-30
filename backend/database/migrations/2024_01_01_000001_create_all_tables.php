<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password')->nullable();
            $table->string('google_id')->nullable();
            $table->string('business_name')->nullable();
            $table->string('gstin', 15)->nullable();
            $table->text('address')->nullable();
            $table->string('phone', 15)->nullable();
            $table->string('logo_path', 500)->nullable();
            $table->enum('subscription_plan', ['free', 'starter', 'pro'])->default('free');
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('file_path', 500);
            $table->enum('file_type', ['pdf', 'jpg', 'png']);
            $table->string('original_filename');
            $table->string('invoice_number', 100)->nullable();
            $table->date('invoice_date')->nullable();
            $table->enum('marketplace', ['amazon', 'flipkart', 'meesho', 'other'])->default('other');
            $table->string('vendor_name')->nullable();
            $table->string('vendor_gstin', 15)->nullable();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('processing_status', ['pending', 'processing', 'review', 'approved', 'rejected', 'error'])->default('pending');
            $table->decimal('ai_confidence_score', 5, 2)->nullable();
            $table->json('extracted_data')->nullable();
            $table->json('validated_data')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('invoice_line_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('sku', 100)->nullable();
            $table->string('product_name');
            $table->string('hsn_code', 20)->nullable();
            $table->decimal('quantity', 10, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('taxable_value', 12, 2);
            $table->decimal('cgst_rate', 5, 2)->default(0);
            $table->decimal('cgst_amount', 12, 2)->default(0);
            $table->decimal('sgst_rate', 5, 2)->default(0);
            $table->decimal('sgst_amount', 12, 2)->default(0);
            $table->decimal('igst_rate', 5, 2)->default(0);
            $table->decimal('igst_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 100);
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category', 100)->nullable();
            $table->string('hsn_code', 20)->nullable();
            $table->string('unit', 20)->default('pcs');
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2)->default(0);
            $table->integer('current_stock')->default(0);
            $table->integer('min_stock_level')->default(5);
            $table->integer('max_stock_level')->default(100);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['user_id', 'sku']);
        });

        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('transaction_type', ['sale', 'purchase', 'adjustment', 'return']);
            $table->integer('quantity_change');
            $table->integer('stock_before');
            $table->integer('stock_after');
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 15)->nullable();
            $table->string('gstin', 15)->nullable();
            $table->string('address_line1')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('pincode', 10)->nullable();
            $table->enum('customer_type', ['b2b', 'b2c'])->default('b2c');
            $table->integer('total_purchases')->default(0);
            $table->decimal('lifetime_revenue', 14, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('sales_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('invoice_id')->constrained();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('order_number', 100);
            $table->date('order_date');
            $table->enum('marketplace', ['amazon', 'flipkart', 'meesho', 'other']);
            $table->string('marketplace_order_id', 200)->nullable();
            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2);
            $table->decimal('shipping_charges', 12, 2)->default(0);
            $table->decimal('commission_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->decimal('net_revenue', 12, 2);
            $table->enum('status', ['completed', 'pending', 'cancelled', 'returned'])->default('completed');
            $table->timestamps();
        });

        Schema::create('gst_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('invoice_id')->constrained();
            $table->foreignId('invoice_line_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('gstin_supplier', 15)->nullable();
            $table->string('gstin_recipient', 15)->nullable();
            $table->string('hsn_code', 20)->nullable();
            $table->decimal('taxable_value', 12, 2);
            $table->decimal('cgst_rate', 5, 2)->default(0);
            $table->decimal('cgst_amount', 12, 2)->default(0);
            $table->decimal('sgst_rate', 5, 2)->default(0);
            $table->decimal('sgst_amount', 12, 2)->default(0);
            $table->decimal('igst_rate', 5, 2)->default(0);
            $table->decimal('igst_amount', 12, 2)->default(0);
            $table->decimal('total_tax', 12, 2);
            $table->enum('supply_type', ['b2b', 'b2c'])->default('b2c');
            $table->date('transaction_date');
            $table->string('financial_year', 7);
            $table->tinyInteger('quarter');
            $table->tinyInteger('month');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->date('entry_date');
            $table->string('entry_number', 50);
            $table->text('description');
            $table->string('debit_account', 100);
            $table->string('credit_account', 100);
            $table->decimal('amount', 12, 2);
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category', 100);
            $table->string('description');
            $table->decimal('amount', 12, 2);
            $table->date('expense_date');
            $table->enum('marketplace', ['amazon', 'flipkart', 'meesho', 'other', 'none'])->default('none');
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['low_stock', 'duplicate_invoice', 'gst_mismatch', 'invoice_error', 'ai_low_confidence', 'new_sales_record', 'inventory_warning', 'gst_due']);
            $table->string('title');
            $table->text('message');
            $table->json('data')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 100);
            $table->string('entity_type', 100);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('marketplace_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->enum('marketplace', ['amazon', 'flipkart', 'meesho']);
            $table->string('settlement_id', 100)->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('gross_sales', 14, 2);
            $table->decimal('returns_refunds', 14, 2)->default(0);
            $table->decimal('marketplace_commission', 14, 2)->default(0);
            $table->decimal('tds_deducted', 14, 2)->default(0);
            $table->decimal('payment_received', 14, 2)->default(0);
            $table->decimal('expected_amount', 14, 2)->default(0);
            $table->decimal('difference', 14, 2)->default(0);
            $table->enum('status', ['pending', 'received', 'disputed'])->default('pending');
            $table->timestamp('settled_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('key', 100);
            $table->text('value')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('marketplace_settlements');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('gst_records');
        Schema::dropIfExists('sales_orders');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('inventory_transactions');
        Schema::dropIfExists('products');
        Schema::dropIfExists('invoice_line_items');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('users');
    }
};
