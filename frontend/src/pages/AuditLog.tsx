import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { formatDateTime } from '../lib/utils'

const ACTION_COLORS: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  invoice_approved: 'success',
  invoice_rejected: 'danger',
  invoice_uploaded: 'info',
  product_updated: 'warning',
  settings_updated: 'default',
}

export default function AuditLog() {
  const [page, setPage] = useState(1)
  const { data: raw, isLoading, isError } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => auditApi.list({ page }).then((r) => r.data.data),
  })

  // raw is PaginatedResponse<AuditLog> = { data: [], meta: {} }
  const logs = raw?.data ?? []
  const meta = raw?.meta

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Audit Log</h1>
        <p className="text-sm text-gray-400 mt-0.5">Complete history of all actions in your account</p>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={5} /></div>
        ) : isError ? (
          <EmptyState icon="⚠️" title="Failed to load audit log" description="Check your connection and try again" />
        ) : logs.length === 0 ? (
          <EmptyState icon="📋" title="No audit logs yet" description="Activity will appear here as you use the system" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-border-default/50">
                    {['Timestamp', 'User', 'Action', 'Entity', 'Details', 'IP Address'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-border-default/30 hover:bg-white/3">
                      <td className="px-5 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="px-5 py-3 text-sm text-gray-200">{log.user}</td>
                      <td className="px-5 py-3">
                        <Badge variant={ACTION_COLORS[log.action] ?? 'default'}>{log.action.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-400 capitalize">{log.entity_type} #{log.entity_id}</td>
                      <td className="px-5 py-3 text-xs text-gray-500 font-mono max-w-xs truncate">
                        {log.new_values ? JSON.stringify(log.new_values).slice(0, 60) : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 font-mono">{log.ip_address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-default/50">
                <p className="text-xs text-gray-500">Showing {logs.length} of {meta.total}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors">Previous</button>
                  <span className="text-xs px-3 py-1.5 text-gray-400">{page} / {meta.last_page}</span>
                  <button onClick={() => setPage(p => Math.min(meta.last_page, p + 1))} disabled={page === meta.last_page}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </PageWrapper>
  )
}
