# INTEGRATION SPECIFICATION — INVOICE ERP

**Frontend**: React 18 + TypeScript + Vite + Tailwind + Framer Motion + React Query v5 + Zustand + Axios  
**Backend**: PHP 8.2 + Laravel 11 + MySQL on Hostinger  
**Auth**: JWT (tymon/jwt-auth)

---

## 1. PROJECT SETUP

### Frontend (Vite + React + TypeScript)

```bash
npm create vite@latest invoice-erp -- --template react-ts
cd invoice-erp
npm install framer-motion @tanstack/react-query zustand axios recharts react-dropzone react-pdf react-router-dom react-hot-toast date-fns lucide-react @headlessui/react clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**vite.config.ts**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

**index.html** — add Google Fonts in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Backend (Laravel 11)

```bash
composer create-project laravel/laravel invoice-erp-api
cd invoice-erp-api
composer require tymon/jwt-auth
composer require phpoffice/phpspreadsheet
composer require barryvdh/laravel-dompdf
php artisan vendor:publish --provider="Tymon\JWTAuth\Providers\LaravelServiceProvider"
php artisan jwt:secret
php artisan migrate
```

**config/cors.php**
```php
return [
    'paths' => ['api/*'],
    'allowed_origins' => ['http://localhost:5173', 'https://yourdomain.com'],
    'allowed_methods' => ['*'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
```

---

## 2. API CLIENT

**src/api/client.ts**
```ts
import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 → logout, 422 → validation errors
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
```

**src/types/index.ts**
```ts
export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: { current_page: number; total: number; per_page: number; last_page: number }
}

export interface User {
  id: number
  name: string
  email: string
  business_name: string | null
  gstin: string | null
  phone: string | null
}

export interface Invoice {
  id: number
  invoice_number: string | null
  invoice_date: string | null
  marketplace: 'amazon' | 'flipkart' | 'meesho' | 'other'
  vendor_name: string | null
  vendor_gstin: string | null
  total_amount: number
  tax_amount: number
  processing_status: 'pending' | 'processing' | 'review' | 'approved' | 'rejected' | 'error'
  ai_confidence_score: number | null
  extracted_data: Record<string, unknown> | null
  line_items?: InvoiceLineItem[]
  created_at: string
}

export interface InvoiceLineItem {
  id: number
  sku: string | null
  product_name: string
  hsn_code: string | null
  quantity: number
  unit_price: number
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

export interface Product {
  id: number
  sku: string
  name: string
  category: string | null
  hsn_code: string | null
  current_stock: number
  min_stock_level: number
  cost_price: number
  selling_price: number
  is_active: boolean
}

export interface Customer {
  id: number
  name: string
  email: string | null
  phone: string | null
  gstin: string | null
  city: string | null
  state: string | null
  customer_type: 'b2b' | 'b2c'
  total_purchases: number
  lifetime_revenue: number
}

export interface SalesOrder {
  id: number
  order_number: string
  order_date: string
  marketplace: string
  total_amount: number
  net_revenue: number
  status: string
}

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

export interface Notification {
  id: number
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface InvoiceProcessingStatus {
  id: number
  status: 'pending' | 'processing' | 'review' | 'approved' | 'error'
  stage: string
  progress: number
  ai_confidence_score: number | null
}
```

---

## 3. AUTH INTEGRATION

**src/api/auth.ts**
```ts
import client from './client'
import type { ApiResponse, User } from '../types'

export const authApi = {
  login: (email: string, password: string) =>
    client.post<ApiResponse<{ user: User; token: string; expires_in: number }>>('/auth/login', { email, password }),

  register: (data: { name: string; email: string; password: string; password_confirmation: string; business_name: string }) =>
    client.post<ApiResponse<{ user: User; token: string }>>('/auth/register', data),

  logout: () => client.post('/auth/logout'),

  me: () => client.get<ApiResponse<User>>('/auth/me'),

  refresh: () => client.post<ApiResponse<{ token: string }>>('/auth/refresh'),
}
```

**src/store/authStore.ts**
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    { name: 'auth-storage', partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }) }
  )
)
```

**src/components/ProtectedRoute.tsx**
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
```

**Login flow** (src/pages/Login.tsx):
```ts
const handleLogin = async (email: string, password: string) => {
  try {
    const { data } = await authApi.login(email, password)
    useAuthStore.getState().setAuth(data.data.user, data.data.token)
    navigate('/dashboard')
  } catch (err: any) {
    setError(err.response?.data?.message || 'Login failed')
  }
}
```

---

## 4. INVOICE UPLOAD + STATUS POLLING

**src/api/invoices.ts**
```ts
import client from './client'

export const invoicesApi = {
  upload: (file: File, marketplace: string, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    form.append('marketplace', marketplace)
    return client.post('/invoices/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
  },

  getStatus: (id: number) => client.get(`/invoices/${id}/status`),

  list: (params?: Record<string, unknown>) => client.get('/invoices', { params }),

  get: (id: number) => client.get(`/invoices/${id}`),

  approve: (id: number, validatedData: unknown) =>
    client.put(`/invoices/${id}/approve`, { validated_data: validatedData }),

  delete: (id: number) => client.delete(`/invoices/${id}`),
}
```

**src/hooks/useInvoiceStatus.ts** — polls status every 2 seconds
```ts
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesApi } from '../api/invoices'
import type { InvoiceProcessingStatus } from '../types'

export const useInvoiceStatus = (invoiceId: number | null) => {
  const [status, setStatus] = useState<InvoiceProcessingStatus | null>(null)
  const navigate = useNavigate()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!invoiceId) return

    intervalRef.current = setInterval(async () => {
      try {
        const { data } = await invoicesApi.getStatus(invoiceId)
        const s: InvoiceProcessingStatus = data.data
        setStatus(s)

        if (s.status === 'review') {
          clearInterval(intervalRef.current!)
          navigate(`/invoices/${invoiceId}/review`)
        } else if (s.status === 'error') {
          clearInterval(intervalRef.current!)
        }
      } catch {
        clearInterval(intervalRef.current!)
      }
    }, 2000)

    return () => clearInterval(intervalRef.current!)
  }, [invoiceId])

  return status
}
```

---

## 5. REACT QUERY SETUP

**src/lib/queryClient.ts**
```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,    // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

**src/hooks/queries.ts** — all query + mutation hooks
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '../api/invoices'
import client from '../api/client'

// Query keys
export const KEYS = {
  dashboard: ['dashboard'],
  invoices: (filters?: unknown) => ['invoices', filters],
  invoice: (id: number) => ['invoices', id],
  products: (filters?: unknown) => ['products', filters],
  lowStock: ['products', 'low-stock'],
  sales: (period?: string) => ['sales', period],
  customers: (filters?: unknown) => ['customers', filters],
  gst: (year?: number) => ['gst', year],
  marketplace: (platform?: string) => ['marketplace', platform],
  notifications: ['notifications'],
}

export const useDashboardSummary = () =>
  useQuery({ queryKey: KEYS.dashboard, queryFn: () => client.get('/dashboard/summary').then(r => r.data.data) })

export const useInvoices = (filters?: Record<string, unknown>) =>
  useQuery({ queryKey: KEYS.invoices(filters), queryFn: () => client.get('/invoices', { params: filters }).then(r => r.data.data) })

export const useProducts = (filters?: Record<string, unknown>) =>
  useQuery({ queryKey: KEYS.products(filters), queryFn: () => client.get('/products', { params: filters }).then(r => r.data.data) })

export const useLowStockProducts = () =>
  useQuery({ queryKey: KEYS.lowStock, queryFn: () => client.get('/products/low-stock').then(r => r.data.data) })

export const useSalesSummary = (period = 'month') =>
  useQuery({ queryKey: KEYS.sales(period), queryFn: () => client.get('/sales/summary', { params: { period } }).then(r => r.data.data) })

export const useGSTSummary = (year: number) =>
  useQuery({ queryKey: KEYS.gst(year), queryFn: () => client.get('/gst/summary', { params: { year } }).then(r => r.data.data) })

export const useNotifications = () =>
  useQuery({ queryKey: KEYS.notifications, queryFn: () => client.get('/notifications').then(r => r.data.data), refetchInterval: 30000 })

// Mutations
export const useApproveInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => invoicesApi.approve(id, data),
    onSuccess: () => {
      // Invalidate everything that changes when an invoice is approved
      qc.invalidateQueries({ queryKey: KEYS.dashboard })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['gst'] })
      qc.invalidateQueries({ queryKey: KEYS.notifications })
    },
  })
}

export const useMarkNotificationRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => client.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.notifications }),
  })
}

export const useGenerateReport = () =>
  useMutation({
    mutationFn: (payload: { type: string; from_date: string; to_date: string; format: string }) =>
      client.post('/reports/generate', payload).then(r => r.data.data),
  })
```

---

## 6. ZUSTAND STORES

**src/store/uiStore.ts**
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  darkMode: boolean
  toggleSidebar: () => void
  toggleDarkMode: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      darkMode: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleDarkMode: () => set((s) => {
        const next = !s.darkMode
        document.documentElement.classList.toggle('dark', next)
        return { darkMode: next }
      }),
    }),
    { name: 'ui-storage' }
  )
)
```

**src/store/notificationStore.ts**
```ts
import { create } from 'zustand'

interface NotificationState {
  unreadCount: number
  setUnreadCount: (n: number) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
}))
```

---

## 7. ROUTING (src/App.tsx)

```tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const UploadInvoice = lazy(() => import('./pages/UploadInvoice'))
const InvoiceProcessing = lazy(() => import('./pages/InvoiceProcessing'))
const InvoiceReview = lazy(() => import('./pages/InvoiceReview'))
const InvoiceList = lazy(() => import('./pages/InvoiceList'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Sales = lazy(() => import('./pages/Sales'))
const Customers = lazy(() => import('./pages/Customers'))
const GST = lazy(() => import('./pages/GST'))
const Accounting = lazy(() => import('./pages/Accounting'))
const Reports = lazy(() => import('./pages/Reports'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const Notifications = lazy(() => import('./pages/Notifications'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center h-screen bg-bg-base text-white">Loading...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/invoices/upload" element={<UploadInvoice />} />
                <Route path="/invoices/:id/processing" element={<InvoiceProcessing />} />
                <Route path="/invoices/:id/review" element={<InvoiceReview />} />
                <Route path="/invoices" element={<InvoiceList />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/gst" element={<GST />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/audit-log" element={<AuditLog />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1F2937', color: '#F9FAFB' } }} />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

---

## 8. FORMATTERS

**src/lib/formatters.ts**
```ts
export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

export const formatDate = (dateStr: string): string =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr))

export const getConfidenceColor = (score: number) => {
  if (score >= 95) return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }
  if (score >= 80) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' }
  return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' }
}

export const MARKETPLACE_COLORS: Record<string, string> = {
  amazon: '#FF9900',
  flipkart: '#2874F0',
  meesho: '#F43397',
}
```

---

## 9. PHASED BUILD PLAN

### Phase 1 — Foundation (Days 1–3)
**Backend**: Laravel install → DB migrations (all tables) → JWT auth endpoints (register/login/me/logout/refresh) → CORS config  
**Frontend**: Vite + Tailwind setup → routing → Login page → auth store → ProtectedRoute → AppLayout skeleton (sidebar + navbar)  
**Test**: Register → login → see dashboard skeleton → logout → redirected to login ✓

### Phase 2 — Invoice Upload + Processing (Days 4–6)
**Backend**: File upload endpoint → ProcessInvoiceJob → OCR (Tesseract) → LLM extraction (OpenAI) → status polling endpoint  
**Frontend**: Upload page with drag-drop zone → file queue → POST to upload → redirect to processing page → status polling → processing animation steps  
**Test**: Upload a real Amazon/Flipkart PDF → watch animation → status reaches "review" ✓

### Phase 3 — AI Review + Approval (Days 7–9)
**Backend**: InvoiceApprovalService → all cascading module updates in DB transaction  
**Frontend**: Split-panel review page → react-pdf viewer → extracted fields form → confidence badges → field editing → approve/reject buttons  
**Test**: Edit a low-confidence field → approve → verify invoice status = approved in DB ✓

### Phase 4 — Inventory Module (Days 10–11)
**Backend**: InventoryService → updateFromInvoice → checkLowStock → notifications  
**Frontend**: Inventory page → products table → stock level bars → low stock list on dashboard  
**Test**: Approve invoice with known SKU → verify stock decremented → low stock notification appears ✓

### Phase 5 — Sales + Customers (Days 12–13)
**Backend**: SalesService → createOrderFromInvoice → CustomerService → findOrCreate  
**Frontend**: Sales page with summary + table → Customers page with card grid + detail drawer  
**Test**: Approve invoice → verify sales_order created → customer created or updated ✓

### Phase 6 — GST Module (Days 14–15)
**Backend**: GSTService → processFromInvoice → intra/inter-state logic → gst_records  
**Frontend**: GST page with tabs (Overview / Monthly / HSN / Download)  
**Test**: Approve intra-state invoice → verify CGST+SGST records → approve inter-state → verify IGST ✓

### Phase 7 — Accounting + Expenses (Days 16–17)
**Backend**: AccountingService → createJournalEntries → ExpenseService → extractFromInvoice → P&L query  
**Frontend**: Accounting page (journal entries + P&L) → Expenses page  
**Test**: Approve invoice → verify 3 journal entries created → P&L shows updated profit ✓

### Phase 8 — Reports (Days 18–19)
**Backend**: ReportService → PDF (DomPDF) + Excel (PhpSpreadsheet) + CSV → download endpoint  
**Frontend**: Reports page → card grid → generate button → download link  
**Test**: Generate sales report for current month as PDF → download and verify ✓

### Phase 9 — Dashboard + Charts (Days 20–21)
**Backend**: DashboardController → optimized summary query → revenue-chart endpoint  
**Frontend**: Full dashboard with all KPI cards (count-up) + area chart + bar chart + donut chart + recent activity  
**Test**: Upload and approve 5 invoices → verify all dashboard numbers update ✓

### Phase 10 — Marketplace Analytics (Day 22)
**Backend**: MarketplaceController → analytics endpoint → settlement tracking  
**Frontend**: Marketplace page with platform tabs + comparison charts  
**Test**: Filter to Amazon only → verify revenue matches approved Amazon invoices ✓

### Phase 11 — Notifications + Audit (Day 23)
**Backend**: All notification triggers wired → audit_logs populated in every service  
**Frontend**: Notifications page → bell count badge → Audit Log page  
**Test**: Approve invoice → verify 3+ notifications created → audit log has entries ✓

### Phase 12 — Polish + Deployment (Days 24–28)
- All empty states, skeleton loaders, error boundaries
- Mobile responsive layout
- Deploy backend to Hostinger (composer install, migrate, cron job)
- Build frontend (`npm run build`) → deploy to Hostinger public_html or subdomain
- Test full flow in production with a real invoice

---

## 10. ENVIRONMENT FILES

**Frontend .env**
```env
VITE_API_URL=https://yourdomain.com/api
```

**Frontend .env.local (dev)**
```env
VITE_API_URL=/api
```

---

## 11. DEVELOPMENT COMMANDS

```bash
# Backend
php artisan serve          # runs on :8000
php artisan migrate:fresh --seed
php artisan queue:work     # process jobs in dev

# Frontend
npm run dev                # runs on :5173 (proxies /api to :8000)
npm run build              # production build → dist/
```

---

## 12. TESTING CHECKLIST

| Module | Test Case |
|---|---|
| Auth | Register → login → refresh token → logout |
| Upload | Upload PDF → verify status goes pending→processing→review |
| OCR | Verify extracted text from a real invoice PDF |
| LLM | Verify JSON extraction contains invoice_number, line_items |
| Review | Edit field with <80% confidence → approve |
| Inventory | Approve invoice → stock decremented for each SKU |
| Unknown SKU | Approve invoice with unknown SKU → notification created |
| Sales | Approve → sales_order row exists with correct marketplace |
| Customer | Approve B2B invoice (GSTIN present) → customer_type = b2b |
| GST Intra | Same-state invoice → cgst_amount > 0, igst_amount = 0 |
| GST Inter | Different-state invoice → igst_amount > 0, cgst_amount = 0 |
| Accounting | Approve → 3+ journal_entries rows created |
| Expenses | Approve with shipping charge → expense row category=shipping |
| Low Stock | Approve until stock < min_level → low_stock notification |
| Report PDF | Generate sales report → valid PDF downloads |
| Dashboard | Approve invoice → today_sales value updates |
| Notifications | Bell count badge increments after new notification |
| Audit Log | Every approve action → audit_logs row with entity_id |
