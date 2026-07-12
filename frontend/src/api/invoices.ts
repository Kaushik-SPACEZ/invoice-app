import client from './client'
import type { Invoice, InvoiceProcessingStatus, PaginatedResponse, ApiResponse, ExtractedInvoiceData } from '../types'

export const invoicesApi = {
  upload: (file: File, marketplace: string, onProgress?: (pct: number) => void, extra?: Record<string, unknown>) => {
    const form = new FormData()
    form.append('file', file)
    form.append('marketplace', marketplace)
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        // Only append credit fields when credit sale is actually ON
        if (k === 'is_credit_sale' && !v) return
        if (k === 'credit_days' && !extra['is_credit_sale']) return
        form.append(k, String(v))
      })
    }
    return client.post<ApiResponse<{ invoice_id: number; status: string }>>('/invoices/upload', form, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
  },

  uploadReturn: (
    file: File,
    marketplace: string,
    isDamaged: boolean,
    onProgress?: (pct: number) => void
  ) => {
    const form = new FormData()
    form.append('file', file)
    form.append('marketplace', marketplace)
    form.append('invoice_type', 'return')
    form.append('is_damaged', isDamaged ? 'true' : 'false')
    return client.post<ApiResponse<{ invoice_id: number; status: string }>>('/invoices/upload', form, {
      // Do NOT set Content-Type manually — let browser set it with the correct boundary
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
  },

  getStatus: (id: number) =>
    client.get<ApiResponse<InvoiceProcessingStatus>>(`/invoices/${id}/status`),

  list: (params?: Record<string, unknown>) =>
    client.get<ApiResponse<PaginatedResponse<Invoice>>>('/invoices', { params }),

  get: (id: number) =>
    client.get<ApiResponse<Invoice>>(`/invoices/${id}`),

  approve: (id: number, validatedData: ExtractedInvoiceData) =>
    client.put<ApiResponse<{ invoice: Invoice; modules_updated: string[] }>>(`/invoices/${id}/approve`, {
      validated_data: validatedData,
    }),

  update: (id: number, data: Partial<Invoice>) =>
    client.put<ApiResponse<Invoice>>(`/invoices/${id}`, data),

  delete: (id: number) => client.delete(`/invoices/${id}`),

  download: (id: number) =>
    client.get(`/invoices/${id}/download`, { responseType: 'blob' }),
}
