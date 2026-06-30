import client from './client'
import type { ApiResponse, DashboardSummary, RevenueChartData } from '../types'

export const dashboardApi = {
  summary: () => client.get<ApiResponse<DashboardSummary>>('/dashboard/summary'),

  revenueChart: (period: 'daily' | 'weekly' | 'monthly' = 'monthly') =>
    client.get<ApiResponse<RevenueChartData>>('/dashboard/revenue-chart', { params: { period } }),

  recentActivity: () => client.get('/dashboard/recent-activity'),
}
