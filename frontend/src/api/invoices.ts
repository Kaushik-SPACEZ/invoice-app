import client from './client'
import type { Invoice, InvoiceProcessingStatus, PaginatedResponse, ApiResponse, ExtractedInvoiceData } from '../types'

export const invoicesApi = {
  upload: (file: File, marketplace: string, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('file', file)
    form.append('marketplace', marketplace)
    return client.post<ApiResponse<{ invoice_id: number; status: string }>>('/invoices/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
