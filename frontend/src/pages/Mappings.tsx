import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Edit2, ChevronDown, ChevronUp, Link2, Check, X, Plus } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { EmptyState, TableSkeleton } from '../components/ui/Skeleton'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function Mappings() {
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRows, setEditRows] = useState<Array<{ product_id: number | ''; quantity: number }>>([])
  const [savingEdit, setSavingEdit] = useState(false)

  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ['product-mappings'],
    queryFn: () => client.get('/product-mappings').then(r => r.data.data),
  })

  const { data: productsData } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => client.get('/products?per_page=200').then(r => r.data.data?.data ?? []),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.delete(`/product-mappings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-mappings'] })
      toast.success('Mapping deleted')
    },
    onError: () => toast.error('Failed to delete mapping'),
  })

  const mappings = mappingsData ?? []
  const products = productsData ?? []

  const startEdit = (m: any) => {
    setEditingId(m.id)
    setEditRows(
      m.items?.map((i: any) => ({ product_id: i.product?.id ?? '', quantity: parseFloat(i.quantity) })) ?? []
    )
    setExpandedId(m.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRows([])
  }

  const addEditRow = () => setEditRows(prev => [...prev, { product_id: '', quantity: 1 }])

  const removeEditRow = (idx: number) => {
    if (editRows.length <= 1) return
    setEditRows(prev => prev.filter((_, i) => i !== idx))
  }

  const updateEditRow = (idx: number, field: string, value: any) => {
    setEditRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: field === 'quantity' ? Number(value) : value } : r))
  }

  const saveEdit = async (m: any) => {
    const validRows = editRows.filter(r => r.product_id !== '' && r.quantity > 0)
    if (validRows.length === 0) { toast.error('Add at least one product mapping'); return }
    setSavingEdit(true)
    try {
      await client.put(`/product-mappings/${m.id}`, { items: validRows })
      qc.invalidateQueries({ queryKey: ['product-mappings'] })
      toast.success('Mapping updated')
      setEditingId(null)
      setEditRows([])
    } catch {
      toast.error('Failed to update mapping')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Product Mappings</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage how invoice product names map to your inventory SKUs. Mappings are applied automatically on approval.
          </p>
        </div>
        {mappings.length > 0 && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 font-medium">
            {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <TableSkeleton rows={4} cols={3} />
        </div>
      ) : mappings.length === 0 ? (
        <EmptyState
          icon="🔗"
          title="No product mappings yet"
          description="Mappings are created automatically when you approve invoices with unrecognized product names. They allow combo products to map to multiple SKUs."
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Product Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Maps To (SKUs)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m: any) => (
                <>
                  {/* Main row */}
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link2 size={14} className="text-blue-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-800">{m.invoice_product_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.items?.map((item: any) => (
                          <span key={item.id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 font-mono">
                            {item.product?.sku ?? '?'} × {parseFloat(item.quantity) % 1 === 0 ? parseInt(item.quantity) : parseFloat(item.quantity)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            if (editingId === m.id) cancelEdit()
                            else startEdit(m)
                          }}
                          className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit mapping"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === m.id && editingId !== m.id ? null : m.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-slate-600 hover:bg-gray-100 transition-colors"
                          title="View details"
                        >
                          {expandedId === m.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Delete mapping for "${m.invoice_product_name}"?\nThis cannot be undone.`)) deleteMutation.mutate(m.id) }}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete mapping"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail / edit row */}
                  {expandedId === m.id && (
                    <tr key={`${m.id}-detail`} className="border-b border-gray-100">
                      <td colSpan={3} className="px-5 py-4 bg-slate-50">
                        {editingId === m.id ? (
                          /* Edit mode */
                          <div>
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Edit Mapping</p>
                            <div className="space-y-2">
                              {editRows.map((row, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                  <select
                                    value={row.product_id}
                                    onChange={e => updateEditRow(idx, 'product_id', e.target.value === '' ? '' : Number(e.target.value))}
                                    className="flex-1 text-sm bg-white border border-gray-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                  >
                                    <option value="">— Select product —</option>
                                    {products.map((p: any) => (
                                      <option key={p.id} value={p.id}>{p.sku} · {p.name} (Stock: {p.current_stock})</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number" min={0.001} step={0.001}
                                    value={row.quantity}
                                    onChange={e => updateEditRow(idx, 'quantity', e.target.value)}
                                    className="w-20 text-sm text-center bg-white border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                  />
                                  {editRows.length > 1 && (
                                    <button onClick={() => removeEditRow(idx)} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <button onClick={addEditRow} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <Plus size={12} /> Add product
                              </button>
                              <div className="flex gap-2">
                                <button onClick={cancelEdit} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded border border-gray-200 bg-white">
                                  Cancel
                                </button>
                                <button
                                  onClick={() => saveEdit(m)}
                                  disabled={savingEdit}
                                  className="text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded flex items-center gap-1"
                                >
                                  <Check size={12} /> {savingEdit ? 'Saving…' : 'Save changes'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mapped products:</p>
                            <div className="space-y-1.5">
                              {m.items?.map((item: any) => (
                                <div key={item.id} className="flex items-center gap-3 text-sm">
                                  <span className="font-mono text-blue-600 text-xs w-28 flex-shrink-0">{item.product?.sku ?? '—'}</span>
                                  <span className="text-slate-700">{item.product?.name ?? 'Unknown product'}</span>
                                  <span className="text-slate-400">× {parseFloat(item.quantity) % 1 === 0 ? parseInt(item.quantity) : parseFloat(item.quantity)} units deducted</span>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-slate-400">Current stock: {item.product?.current_stock ?? '—'}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                              Created: {new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageWrapper>
  )
}
