import client from './client'
import type { Notification, ApiResponse, PaginatedResponse } from '../types'

export const notificationsApi = {
  list: (params?: { page?: number; is_read?: boolean }) =>
    client.get<ApiResponse<PaginatedResponse<Notification> & { meta: { unread: number } }>>('/notifications', { params }),

  markRead: (id: number) => client.put(`/notifications/${id}/read`),

  markAllRead: () => client.put('/notifications/read-all'),

  delete: (id: number) => client.delete(`/notifications/${id}`),
}
