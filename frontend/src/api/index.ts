import client from './client'
import type { ReportRequest, ApiResponse } from '../types'

export const reportsApi = {
  generate: (data: ReportRequest) =>
    client.post<ApiResponse<{ report_id: number; status: string }>>('/reports/generate', data),

  download: (id: number) =>
    client.get(`/reports/${id}/download`, { responseType: 'blob' }),

  list: () => client.get('/reports'),
}

export const gstApi = {
  summary: (year: number) => client.get('/gst/summary', { params: { year } }),
  monthly: (year: number, month: number) => client.get(`/gst/monthly/${year}/${month}`),
  hsnSummary: (params?: Record<string, unknown>) => client.get('/gst/hsn-summary', { params }),
  generateReport: (data: { type: string; period: string; format: string }) =>
    client.post('/gst/generate-report', data),
}

export const salesApi = {
  summary: (period = 'month') => client.get('/sales/summary', { params: { period } }),
  list: (params?: Record<string, unknown>) => client.get('/sales', { params }),
  byMarketplace: () => client.get('/sales/by-marketplace'),
}

export const customersApi = {
  list: (params?: Record<string, unknown>) => client.get('/customers', { params }),
  get: (id: number) => client.get(`/customers/${id}`),
  create: (data: Record<string, unknown>) => client.post('/customers', data),
  update: (id: number, data: Record<string, unknown>) => client.put(`/customers/${id}`, data),
  purchases: (id: number) => client.get(`/customers/${id}/purchases`),
}

export const accountingApi = {
  journalEntries: (params?: Record<string, unknown>) => client.get('/accounting/journal-entries', { params }),
  profitLoss: (from: string, to: string) => client.get('/accounting/profit-loss', { params: { from_date: from, to_date: to } }),
  balanceSheet: (date?: string) => client.get('/accounting/balance-sheet', { params: { date } }),
}

export const marketplaceApi = {
  analytics: (params?: Record<string, unknown>) => client.get('/marketplace/analytics', { params }),
  settlements: (params?: Record<string, unknown>) => client.get('/marketplace/settlements', { params }),
  platformSummary: (platform: string) => client.get(`/marketplace/${platform}/summary`),
}

export const settingsApi = {
  get: () => client.get('/settings'),
  update: (data: Record<string, unknown>) => client.put('/settings', data),
}

export const auditApi = {
  list: (params?: Record<string, unknown>) => client.get('/audit-log', { params }),
}

export const damagedStockApi = {
  list: (params?: Record<string, unknown>) => client.get('/damaged-stock', { params }),
  summary: () => client.get('/damaged-stock/summary'),
  writeOff: (id: number) => client.post(`/damaged-stock/${id}/write-off`),
}
