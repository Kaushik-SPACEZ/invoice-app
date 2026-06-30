<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Product;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::create([
            'name' => 'Raj Kumar',
            'email' => 'raj@rkelectronics.com',
            'password' => Hash::make('password123'),
            'business_name' => 'RK Electronics',
            'gstin' => '27AAPFU0939F1ZV',
            'phone' => '9876543210',
            'subscription_plan' => 'starter',
        ]);

        $products = [
            ['sku' => 'PHC-001', 'name' => 'Silicone Phone Case', 'category' => 'Accessories', 'hsn_code' => '8517', 'cost_price' => 80, 'selling_price' => 299, 'current_stock' => 42, 'min_stock_level' => 10],
            ['sku' => 'SCR-002', 'name' => 'Tempered Glass Screen Protector', 'category' => 'Accessories', 'hsn_code' => '7013', 'cost_price' => 30, 'selling_price' => 149, 'current_stock' => 6, 'min_stock_level' => 10],
            ['sku' => 'USB-003', 'name' => 'USB Type-C Cable 2m', 'category' => 'Cables', 'hsn_code' => '8544', 'cost_price' => 45, 'selling_price' => 199, 'current_stock' => 88, 'min_stock_level' => 15],
            ['sku' => 'PWR-004', 'name' => '20000mAh Power Bank', 'category' => 'Electronics', 'hsn_code' => '8507', 'cost_price' => 650, 'selling_price' => 1499, 'current_stock' => 14, 'min_stock_level' => 5],
            ['sku' => 'EAR-005', 'name' => 'Wireless Earbuds', 'category' => 'Audio', 'hsn_code' => '8518', 'cost_price' => 350, 'selling_price' => 999, 'current_stock' => 3, 'min_stock_level' => 8],
        ];

        foreach ($products as $p) {
            Product::create(array_merge($p, ['user_id' => $user->id]));
        }
    }
}
