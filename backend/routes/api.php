<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\GSTController;
use App\Http\Controllers\AccountingController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\MarketplaceController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\ExpenseController;

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/google', [AuthController::class, 'google']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::middleware('auth:api')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/refresh', [AuthController::class, 'refresh']);
    });
});

Route::middleware('auth:api')->group(function () {
    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/revenue-chart', [DashboardController::class, 'revenueChart']);
    Route::get('/dashboard/recent-activity', [DashboardController::class, 'recentActivity']);

    // Invoices
    Route::post('/invoices/upload', [InvoiceController::class, 'upload']);
    Route::get('/invoices/{id}/status', [InvoiceController::class, 'status']);
    Route::put('/invoices/{id}/approve', [InvoiceController::class, 'approve']);
    Route::apiResource('invoices', InvoiceController::class)->except(['store']);

    // Products / Inventory
    Route::get('/products/low-stock', [ProductController::class, 'lowStock']);
    Route::apiResource('products', ProductController::class);

    // Sales
    Route::get('/sales/summary', [SalesController::class, 'summary']);
    Route::get('/sales/by-marketplace', [SalesController::class, 'byMarketplace']);
    Route::apiResource('sales', SalesController::class)->only(['index', 'show']);

    // Customers
    Route::get('/customers/{id}/purchases', [CustomerController::class, 'purchases']);
    Route::apiResource('customers', CustomerController::class);

    // GST
    Route::get('/gst/summary', [GSTController::class, 'summary']);
    Route::get('/gst/monthly/{year}/{month}', [GSTController::class, 'monthly']);
    Route::get('/gst/hsn-summary', [GSTController::class, 'hsnSummary']);
    Route::post('/gst/generate-report', [GSTController::class, 'generateReport']);

    // Accounting
    Route::get('/accounting/journal-entries', [AccountingController::class, 'journalEntries']);
    Route::get('/accounting/profit-loss', [AccountingController::class, 'profitLoss']);
    Route::get('/accounting/balance-sheet', [AccountingController::class, 'balanceSheet']);
    Route::get('/accounting/accounts', [AccountingController::class, 'accounts']);

    // Expenses
    Route::get('/expenses/summary', [ExpenseController::class, 'summary']);
    Route::apiResource('expenses', ExpenseController::class);

    // Reports
    Route::post('/reports/generate', [ReportController::class, 'generate']);
    Route::get('/reports/{id}/download', [ReportController::class, 'download']);
    Route::get('/reports', [ReportController::class, 'index']);

    // Marketplace
    Route::get('/marketplace/analytics', [MarketplaceController::class, 'analytics']);
    Route::get('/marketplace/settlements', [MarketplaceController::class, 'settlements']);
    Route::get('/marketplace/{platform}/summary', [MarketplaceController::class, 'platformSummary']);

    // Notifications
    Route::put('/notifications/read-all', [NotificationController::class, 'readAll']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::apiResource('notifications', NotificationController::class)->only(['index', 'destroy']);

    // Audit & Settings
    Route::get('/audit-log', [AuditLogController::class, 'index']);
    Route::get('/settings', [SettingsController::class, 'index']);
    Route::put('/settings', [SettingsController::class, 'update']);
});
