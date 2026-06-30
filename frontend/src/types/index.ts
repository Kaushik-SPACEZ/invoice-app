// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    total: number
    per_page: number
    last_page: number
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email: string
  business_name: string | null
  gstin: string | null
  phone: string | null
  logo_path: string | null
  subscription_plan: 'free' | 'starter' | 'pro'
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'pending' | 'processing' | 'review' | 'approved' | 'rejected' | 'error'
export type Marketplace = 'amazon' | 'flipkart' | 'meesho' | 'other'

export interface Invoice {
  id: number
  user_id: number
  file_path: string
  file_type: 'pdf' | 'jpg' | 'png'
  original_filename: string
  invoice_number: string | null
  invoice_date: string | null
  marketplace: Marketplace
  vendor_name: string | null
  vendor_gstin: string | null
  customer_id: number | null
  subtotal: number
  tax_amount: number
  total_amount: number
  processing_status: InvoiceStatus
  ai_confidence_score: number | null
  extracted_data: ExtractedInvoiceData | null
  validated_data: ExtractedInvoiceData | null
  error_message: string | null
  processed_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  line_items?: InvoiceLineItem[]
  customer?: Customer
}

export interface InvoiceLineItem {
  id: number
  invoice_id: number
  product_id: number | null
  sku: string | null
  product_name: string
  hsn_code: string | null
  quantity: number
  unit_price: number
  discount: number
  taxable_value: number
  cgst_rate: number
  cgst_amount: number
  sgst_rate: number
  sgst_amount: number
  igst_rate: number
  igst_amount: number
  total_amount: number
  confidence_score: number | null
}

export interface ExtractedInvoiceData {
  invoice_number?: string | null
  invoice_date?: string | null
  vendor_name?: string | null
  vendor_gstin?: string | null
  customer_name?: string | null
  customer_gstin?: string | null
  customer_address?: string | null
  line_items?: Partial<InvoiceLineItem>[]
  shipping_charges?: number
  commission_amount?: number
  subtotal?: number
  tax_amount?: number
  total_amount?: number
  field_confidence?: Record<string, number>
}

export interface InvoiceProcessingStatus {
  id: number
  status: InvoiceStatus
  stage: string
  progress: number
  label: string | null
  ai_confidence_score: number | null
  error_message?: string | null
}

// ─── Products / Inventory ─────────────────────────────────────────────────────

export interface Product {
  id: number
  user_id: number
  sku: string
  name: string
  description: string | null
  category: string | null
  hsn_code: string | null
  unit: string
  cost_price: number
  selling_price: number
  current_stock: number
  min_stock_level: number
  max_stock_level: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
  id: number
  name: string
  email: string | null
  phone: string | null
  gstin: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  pincode: string | null
  customer_type: 'b2b' | 'b2c'
  total_purchases: number
  lifetime_revenue: number
  created_at: string
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface SalesOrder {
  id: number
  order_number: string
  order_date: string
  marketplace: Marketplace
  marketplace_order_id: string | null
  subtotal: number
  tax_amount: number
  shipping_charges: number
  commission_amount: number
  total_amount: number
  net_revenue: number
  status: 'completed' | 'pending' | 'cancelled' | 'returned'
  customer?: Customer
  invoice?: Invoice
}

export interface SalesSummary {
  revenue: number
  orders: number
  avg_order_value: number
  returns: number
  by_marketplace: Record<Marketplace, { revenue: number; orders: number; commission: number }>
}

// ─── GST ─────────────────────────────────────────────────────────────────────

export interface GSTSummary {
  output_tax: number
  input_tax_credit: number
  net_payable: number
  by_quarter: Array<{ quarter: string; output: number; input: number; payable: number }>
  by_month: Array<{ month: string; taxable_value: number; cgst: number; sgst: number; igst: number; total: number }>
}

// ─── Accounting ───────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: number
  entry_date: string
  entry_number: string
  description: string
  debit_account: string
  credit_account: string
  amount: number
  created_at: string
}

export interface ProfitLoss {
  revenue: number
  cogs: number
  gross_profit: number
  expenses: { shipping: number; commission: number; packaging: number; total: number }
  operating_profit: number
  gst_payable: number
  net_profit: number
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  today_sales: number
  monthly_revenue: number
  gst_payable: number
  net_profit: number
  total_products: number
  low_stock_count: number
  out_of_stock_count: number
  recent_invoices: Invoice[]
  unread_notifications: number
}

export interface RevenueChartData {
  labels: string[]
  datasets: Array<{ name: string; data: number[] }>
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'low_stock'
  | 'duplicate_invoice'
  | 'gst_mismatch'
  | 'invoice_error'
  | 'ai_low_confidence'
  | 'new_sales_record'
  | 'inventory_warning'
  | 'gst_due'

export interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export type ReportType = 'sales' | 'gst' | 'profit' | 'inventory' | 'marketplace' | 'customer' | 'expense'
export type ReportFormat = 'pdf' | 'excel' | 'csv'

export interface ReportRequest {
  type: ReportType
  from_date: string
  to_date: string
  format: ReportFormat
}

// ─── Marketplace ─────────────────────────────────────────────────────────────

export interface MarketplaceAnalytics {
  total_revenue: number
  total_commission: number
  total_returns: number
  by_platform: Record<string, {
    revenue: number
    orders: number
    commission: number
    commission_pct: number
    returns: number
    top_product: string
  }>
}

export interface MarketplaceSettlement {
  id: number
  marketplace: Marketplace
  period_start: string
  period_end: string
  gross_sales: number
  returns_refunds: number
  marketplace_commission: number
  payment_received: number
  expected_amount: number
  difference: number
  status: 'pending' | 'received' | 'disputed'
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: number
  user: string
  action: string
  entity_type: string
  entity_id: number | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}
