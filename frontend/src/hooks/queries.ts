import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '../api/invoices'
import { dashboardApi } from '../api/dashboard'
import { productsApi } from '../api/products'
import { notificationsApi } from '../api/notifications'
import { salesApi, gstApi, customersApi, accountingApi, marketplaceApi } from '../api'

export const KEYS = {
  dashboard: ['dashboard'] as const,
  dashboardChart: (period: string) => ['dashboard', 'chart', period] as const,
  invoices: (filters?: unknown) => ['invoices', filters] as const,
  invoice: (id: number) => ['invoices', id] as const,
  products: (filters?: unknown) => ['products', filters] as const,
  lowStock: ['products', 'low-stock'] as const,
  sales: (period?: string) => ['sales', period] as const,
  customers: (filters?: unknown) => ['customers', filters] as const,
  customer: (id: number) => ['customers', id] as const,
  gst: (year?: number) => ['gst', year] as const,
  marketplace: (platform?: string) => ['marketplace', platform] as const,
  notifications: ['notifications'] as const,
  accounting: (type: string) => ['accounting', type] as const,
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const useDashboardSummary = () =>
  useQuery({
    queryKey: KEYS.dashboard,
    queryFn: () => dashboardApi.summary().then((r) => r.data.data),
  })

export const useRevenueChart = (period: 'daily' | 'weekly' | 'monthly' = 'monthly') =>
  useQuery({
    queryKey: KEYS.dashboardChart(period),
    queryFn: () => dashboardApi.revenueChart(period).then((r) => r.data.data),
  })

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const useInvoices = (filters?: Record<string, unknown>) =>
  useQuery({
    queryKey: KEYS.invoices(filters),
    queryFn: () => invoicesApi.list(filters).then((r) => r.data.data),
  })

export const useInvoice = (id: number) =>
  useQuery({
    queryKey: KEYS.invoice(id),
    queryFn: () => invoicesApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  })

export const useApproveInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof invoicesApi.approve>[1] }) =>
      invoicesApi.approve(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.dashboard })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['gst'] })
      qc.invalidateQueries({ queryKey: KEYS.notifications })
    },
    onError: (err: any) => {
      console.error('Invoice approval failed:', err)
    },
  })
}

export const useDeleteInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const useProducts = (filters?: Record<string, unknown>) =>
  useQuery({
    queryKey: KEYS.products(filters),
    queryFn: () => productsApi.list(filters).then((r) => r.data.data),
  })

export const useLowStockProducts = () =>
  useQuery({
    queryKey: KEYS.lowStock,
    queryFn: () => productsApi.lowStock().then((r) => r.data.data),
  })

export const useCreateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof productsApi.create>[0]) => productsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useUpdateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof productsApi.update>[1] }) =>
      productsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export const useSalesSummary = (period = 'month') =>
  useQuery({
    queryKey: KEYS.sales(period),
    queryFn: () => salesApi.summary(period).then((r) => r.data.data),
  })

export const useSalesByMarketplace = () =>
  useQuery({
    queryKey: ['sales', 'marketplace'],
    queryFn: () => salesApi.byMarketplace().then((r) => r.data.data),
  })

// ─── Customers ────────────────────────────────────────────────────────────────

export const useCustomers = (filters?: Record<string, unknown>) =>
  useQuery({
    queryKey: KEYS.customers(filters),
    queryFn: () => customersApi.list(filters).then((r) => r.data.data),
  })

// ─── GST ─────────────────────────────────────────────────────────────────────

export const useGSTSummary = (year: number) =>
  useQuery({
    queryKey: KEYS.gst(year),
    queryFn: () => gstApi.summary(year).then((r) => r.data.data),
  })

// ─── Accounting ───────────────────────────────────────────────────────────────

export const useProfitLoss = (from: string, to: string) =>
  useQuery({
    queryKey: KEYS.accounting(`pl-${from}-${to}`),
    queryFn: () => accountingApi.profitLoss(from, to).then((r) => r.data.data),
    enabled: !!from && !!to,
  })

// ─── Marketplace ─────────────────────────────────────────────────────────────

export const useMarketplaceAnalytics = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: KEYS.marketplace(JSON.stringify(params)),
    queryFn: () => marketplaceApi.analytics(params).then((r) => r.data.data),
  })

// ─── Notifications ────────────────────────────────────────────────────────────

export const useNotifications = () =>
  useQuery({
    queryKey: KEYS.notifications,
    queryFn: () => notificationsApi.list().then((r) => r.data.data),
    refetchInterval: 30000,
  })

export const useMarkNotificationRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.notifications }),
  })
}

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.notifications }),
  })
}
