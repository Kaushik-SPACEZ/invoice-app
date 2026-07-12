import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { formatDateTime } from '../lib/utils'

const ACTION_COLORS: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  invoice_approved: 'success',
  invoice_rejected: 'danger',
  invoice_uploaded: 'info',
  product_updated: 'warning',
  damaged_stock_write_off: 'danger',
  settings_updated: 'default',
}

export default function AuditLog() {
  const [page, setPage] = useState(1)
  const { data: raw, isLoading, isError } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => auditApi.list({ page }).then((r) => r.data.data),
  })

  const logs = raw?.data ?? []
  const total = raw?.total ?? raw?.meta?.total ?? 0
  const lastPage = raw?.last_page ?? raw?.meta?.last_page ?? 1

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Audit Log</h1>
        <p className="text-sm text-slate-400 mt-0.5">Complete history of all actions in your account</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
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
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Timestamp', 'User', 'Action', 'Entity', 'Details', 'IP Address'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                      <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="px-5 py-3 text-sm text-slate-700">{log.user}</td>
                      <td className="px-5 py-3">
                        <Badge variant={ACTION_COLORS[log.action] ?? 'default'}>{log.action.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 capitalize">
                        {log.entity_type} #{log.entity_id}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono max-w-xs truncate">
                        {log.new_values ? JSON.stringify(log.new_values).slice(0, 60) : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-400 font-mono">{log.ip_address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lastPage > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-slate-500">Showing {logs.length} of {total}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md text-slate-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Previous</button>
                  <span className="text-xs px-3 py-1.5 text-slate-500">{page} / {lastPage}</span>
                  <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-md text-slate-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}
