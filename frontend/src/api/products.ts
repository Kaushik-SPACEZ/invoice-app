import client from './client'
import type { Product, ApiResponse, PaginatedResponse } from '../types'

export const productsApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<ApiResponse<PaginatedResponse<Product>>>('/products', { params }),

  get: (id: number) => client.get<ApiResponse<Product>>(`/products/${id}`),

  create: (data: Partial<Product>) => client.post<ApiResponse<Product>>('/products', data),

  update: (id: number, data: Partial<Product>) =>
    client.put<ApiResponse<Product>>(`/products/${id}`, data),

  delete: (id: number) => client.delete(`/products/${id}`),

  lowStock: () => client.get<ApiResponse<Product[]>>('/products/low-stock'),
}
