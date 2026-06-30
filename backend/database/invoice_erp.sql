-- ============================================================
-- BizSync Invoice ERP — Full Database Schema
-- Upload this file in phpMyAdmin → Import tab
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+05:30";

-- Create database (skip if already created in Hostinger panel)
-- CREATE DATABASE IF NOT EXISTS `invoice_erp` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `invoice_erp`;

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NULL,
  `google_id` VARCHAR(255) NULL,
  `business_name` VARCHAR(255) NULL,
  `gstin` VARCHAR(15) NULL,
  `address` TEXT NULL,
  `phone` VARCHAR(15) NULL,
  `logo_path` VARCHAR(500) NULL,
  `subscription_plan` ENUM('free','starter','pro') DEFAULT 'free',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. customers (must come before invoices — FK reference)
-- ============================================================
CREATE TABLE `customers` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `phone` VARCHAR(15) NULL,
  `gstin` VARCHAR(15) NULL,
  `address_line1` VARCHAR(255) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pincode` VARCHAR(10) NULL,
  `customer_type` ENUM('b2b','b2c') DEFAULT 'b2c',
  `total_purchases` INT DEFAULT 0,
  `lifetime_revenue` DECIMAL(14,2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. invoices
-- ============================================================
CREATE TABLE `invoices` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_type` ENUM('pdf','jpg','png') NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `invoice_number` VARCHAR(100) NULL,
  `invoice_date` DATE NULL,
  `marketplace` ENUM('amazon','flipkart','meesho','other') DEFAULT 'other',
  `vendor_name` VARCHAR(255) NULL,
  `vendor_gstin` VARCHAR(15) NULL,
  `customer_id` BIGINT UNSIGNED NULL,
  `subtotal` DECIMAL(12,2) DEFAULT 0,
  `tax_amount` DECIMAL(12,2) DEFAULT 0,
  `total_amount` DECIMAL(12,2) DEFAULT 0,
  `processing_status` ENUM('pending','processing','review','approved','rejected','error') DEFAULT 'pending',
  `ai_confidence_score` DECIMAL(5,2) NULL,
  `extracted_data` JSON NULL,
  `validated_data` JSON NULL,
  `error_message` TEXT NULL,
  `processed_at` TIMESTAMP NULL,
  `approved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_invoices_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. products
-- ============================================================
CREATE TABLE `products` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(100) NULL,
  `hsn_code` VARCHAR(20) NULL,
  `unit` VARCHAR(20) DEFAULT 'pcs',
  `cost_price` DECIMAL(12,2) DEFAULT 0,
  `selling_price` DECIMAL(12,2) DEFAULT 0,
  `current_stock` INT DEFAULT 0,
  `min_stock_level` INT DEFAULT 5,
  `max_stock_level` INT DEFAULT 100,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_products_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_user_sku` (`user_id`, `sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. invoice_line_items
-- ============================================================
CREATE TABLE `invoice_line_items` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NULL,
  `sku` VARCHAR(100) NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `hsn_code` VARCHAR(20) NULL,
  `quantity` DECIMAL(10,3) NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) DEFAULT 0,
  `taxable_value` DECIMAL(12,2) NOT NULL,
  `cgst_rate` DECIMAL(5,2) DEFAULT 0,
  `cgst_amount` DECIMAL(12,2) DEFAULT 0,
  `sgst_rate` DECIMAL(5,2) DEFAULT 0,
  `sgst_amount` DECIMAL(12,2) DEFAULT 0,
  `igst_rate` DECIMAL(5,2) DEFAULT 0,
  `igst_amount` DECIMAL(12,2) DEFAULT 0,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `confidence_score` DECIMAL(5,2) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_line_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_line_items_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. inventory_transactions
-- ============================================================
CREATE TABLE `inventory_transactions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL,
  `transaction_type` ENUM('sale','purchase','adjustment','return') NOT NULL,
  `quantity_change` INT NOT NULL,
  `stock_before` INT NOT NULL,
  `stock_after` INT NOT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_trans_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_inv_trans_product` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `fk_inv_trans_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. sales_orders
-- ============================================================
CREATE TABLE `sales_orders` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL,
  `order_number` VARCHAR(100) NOT NULL,
  `order_date` DATE NOT NULL,
  `marketplace` ENUM('amazon','flipkart','meesho','other') NOT NULL,
  `marketplace_order_id` VARCHAR(200) NULL,
  `subtotal` DECIMAL(12,2) NOT NULL,
  `discount` DECIMAL(12,2) DEFAULT 0,
  `tax_amount` DECIMAL(12,2) NOT NULL,
  `shipping_charges` DECIMAL(12,2) DEFAULT 0,
  `commission_amount` DECIMAL(12,2) DEFAULT 0,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `net_revenue` DECIMAL(12,2) NOT NULL,
  `status` ENUM('completed','pending','cancelled','returned') DEFAULT 'completed',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_sales_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. gst_records
-- ============================================================
CREATE TABLE `gst_records` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NOT NULL,
  `invoice_line_item_id` BIGINT UNSIGNED NULL,
  `gstin_supplier` VARCHAR(15) NULL,
  `gstin_recipient` VARCHAR(15) NULL,
  `hsn_code` VARCHAR(20) NULL,
  `taxable_value` DECIMAL(12,2) NOT NULL,
  `cgst_rate` DECIMAL(5,2) DEFAULT 0,
  `cgst_amount` DECIMAL(12,2) DEFAULT 0,
  `sgst_rate` DECIMAL(5,2) DEFAULT 0,
  `sgst_amount` DECIMAL(12,2) DEFAULT 0,
  `igst_rate` DECIMAL(5,2) DEFAULT 0,
  `igst_amount` DECIMAL(12,2) DEFAULT 0,
  `total_tax` DECIMAL(12,2) NOT NULL,
  `supply_type` ENUM('b2b','b2c') DEFAULT 'b2c',
  `transaction_date` DATE NOT NULL,
  `financial_year` VARCHAR(7) NOT NULL,
  `quarter` TINYINT NOT NULL,
  `month` TINYINT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_gst_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_gst_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
  CONSTRAINT `fk_gst_line_item` FOREIGN KEY (`invoice_line_item_id`) REFERENCES `invoice_line_items`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. journal_entries
-- ============================================================
CREATE TABLE `journal_entries` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL,
  `entry_date` DATE NOT NULL,
  `entry_number` VARCHAR(50) NOT NULL,
  `description` TEXT NOT NULL,
  `debit_account` VARCHAR(100) NOT NULL,
  `credit_account` VARCHAR(100) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_journal_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_journal_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. expenses
-- ============================================================
CREATE TABLE `expenses` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL,
  `category` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `marketplace` ENUM('amazon','flipkart','meesho','other','none') DEFAULT 'none',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_expenses_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_expenses_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. notifications
-- ============================================================
CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('low_stock','duplicate_invoice','gst_mismatch','invoice_error','ai_low_confidence','new_sales_record','inventory_warning','gst_due') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `data` JSON NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `read_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. audit_logs
-- ============================================================
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_id` BIGINT UNSIGNED NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. marketplace_settlements
-- ============================================================
CREATE TABLE `marketplace_settlements` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `marketplace` ENUM('amazon','flipkart','meesho') NOT NULL,
  `settlement_id` VARCHAR(100) NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `gross_sales` DECIMAL(14,2) NOT NULL,
  `returns_refunds` DECIMAL(14,2) DEFAULT 0,
  `marketplace_commission` DECIMAL(14,2) DEFAULT 0,
  `tds_deducted` DECIMAL(14,2) DEFAULT 0,
  `payment_received` DECIMAL(14,2) DEFAULT 0,
  `expected_amount` DECIMAL(14,2) DEFAULT 0,
  `difference` DECIMAL(14,2) DEFAULT 0,
  `status` ENUM('pending','received','disputed') DEFAULT 'pending',
  `settled_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_settlements_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. settings
-- ============================================================
CREATE TABLE `settings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_key` (`user_id`, `key`),
  CONSTRAINT `fk_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. jobs (Laravel queue — required for async invoice processing)
-- ============================================================
CREATE TABLE `jobs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `queue` VARCHAR(255) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL,
  `reserved_at` INT UNSIGNED NULL,
  `available_at` INT UNSIGNED NOT NULL,
  `created_at` INT UNSIGNED NOT NULL,
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `failed_jobs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(255) UNIQUE NOT NULL,
  `connection` TEXT NOT NULL,
  `queue` TEXT NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `exception` LONGTEXT NOT NULL,
  `failed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SAMPLE DATA — Test user + 5 products
-- ============================================================

-- Test user (password = "password123" bcrypt hash)
INSERT INTO `users` (`name`, `email`, `password`, `business_name`, `gstin`, `phone`, `subscription_plan`) VALUES
('Raj Kumar', 'raj@rkelectronics.com', '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'RK Electronics', '27AAPFU0939F1ZV', '9876543210', 'starter');

-- 5 products for user ID 1
INSERT INTO `products` (`user_id`, `sku`, `name`, `category`, `hsn_code`, `unit`, `cost_price`, `selling_price`, `current_stock`, `min_stock_level`, `max_stock_level`) VALUES
(1, 'PHC-001', 'Silicone Phone Case', 'Accessories', '8517', 'pcs', 80.00, 299.00, 42, 10, 200),
(1, 'SCR-002', 'Tempered Glass Screen Protector', 'Accessories', '7013', 'pcs', 30.00, 149.00, 6, 10, 500),
(1, 'USB-003', 'USB Type-C Cable 2m', 'Cables', '8544', 'pcs', 45.00, 199.00, 88, 15, 300),
(1, 'PWR-004', '20000mAh Power Bank', 'Electronics', '8507', 'pcs', 650.00, 1499.00, 14, 5, 100),
(1, 'EAR-005', 'Wireless Earbuds', 'Audio', '8518', 'pcs', 350.00, 999.00, 3, 8, 150);
