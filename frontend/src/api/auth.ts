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

  googleLogin: (token: string) =>
    client.post<ApiResponse<{ user: User; token: string }>>('/auth/google', { token }),
}
