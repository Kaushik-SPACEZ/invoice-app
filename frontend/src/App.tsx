import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const UploadInvoice = lazy(() => import('./pages/UploadInvoice'))
const InvoiceProcessing = lazy(() => import('./pages/InvoiceProcessing'))
const InvoiceReview = lazy(() => import('./pages/InvoiceReview'))
const InvoiceList = lazy(() => import('./pages/InvoiceList'))
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Purchase = lazy(() => import('./pages/Purchase'))
const Sales = lazy(() => import('./pages/Sales'))
const Customers = lazy(() => import('./pages/Customers'))
const GST = lazy(() => import('./pages/GST'))
const Accounting = lazy(() => import('./pages/Accounting'))
const Reports = lazy(() => import('./pages/Reports'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const Notifications = lazy(() => import('./pages/Notifications'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Settings = lazy(() => import('./pages/Settings'))
const SalesReturn = lazy(() => import('./pages/SalesReturn'))
const DamagedGoods = lazy(() => import('./pages/DamagedGoods'))
const Mappings = lazy(() => import('./pages/Mappings'))
const CommissionInvoice = lazy(() => import('./pages/CommissionInvoice'))
const BankStatement = lazy(() => import('./pages/BankStatement'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Outstanding = lazy(() => import('./pages/Outstanding'))

const Loader = () => (
  <div className="flex items-center justify-center h-screen bg-bg-base">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<Loader />}>
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
                <Route path="/invoices/:id" element={<InvoiceDetail />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/purchases" element={<Purchase />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/gst" element={<GST />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/returns" element={<SalesReturn />} />
                <Route path="/damaged-goods" element={<DamagedGoods />} />
                <Route path="/mappings" element={<Mappings />} />
                <Route path="/commission-invoices" element={<CommissionInvoice />} />
                <Route path="/bank-statements" element={<BankStatement />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/outstanding" element={<Outstanding />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/audit-log" element={<AuditLog />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1F2937', color: '#F9FAFB', border: '1px solid rgba(99,102,241,0.2)' },
            success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
