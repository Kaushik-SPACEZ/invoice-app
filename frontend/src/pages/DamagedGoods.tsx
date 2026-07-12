import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertOctagon, PackageX, DollarSign, Trash2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { damagedStockApi } from '../api'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'

interface DamagedItem {
  id: number
  sku: string
  product_name: string
  category: string | null
  damaged_qty: number
  cost_price: number
}

interface DamagedSummary {
  total_damaged_units: number
  total_damaged_value: number
  product_count: number
  // legacy field names — support both
  total_items?: number
  total_value?: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

export default function DamagedGoods() {
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const { data: summaryData, isLoading: summaryLoading } = useQuery<DamagedSummary>({
    queryKey: ['damaged-stock-summary'],
    queryFn: async () => {
      const res = await damagedStockApi.summary()
      return res.data?.data ?? res.data
    },
  })

  const { data: listData, isLoading: listLoading } = useQuery<DamagedItem[]>({
    queryKey: ['damaged-stock'],
    queryFn: async () => {
      const res = await damagedStockApi.list()
      return res.data?.data ?? res.data
    },
  })

  const writeOffMutation = useMutation({
    mutationFn: (id: number) => damagedStockApi.writeOff(id),
    onSuccess: () => {
      toast.success('Damaged stock written off successfully')
      queryClient.invalidateQueries({ queryKey: ['damaged-stock'] })
      queryClient.invalidateQueries({ queryKey: ['damaged-stock-summary'] })
      setConfirmId(null)
    },
    onError: () => {
      toast.error('Failed to write off damaged stock')
    },
  })

  const items: DamagedItem[] = listData ?? []
  const summary: DamagedSummary = summaryData ?? { total_damaged_units: 0, total_damaged_value: 0, product_count: 0 }
  // Support both old and new field names
  const totalUnits = summary.total_damaged_units ?? summary.total_items ?? 0
  const totalValue = summary.total_damaged_value ?? summary.total_value ?? 0

  const isLoading = summaryLoading || listLoading

  return (
    <PageWrapper>
      <div className="px-6 py-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-semibold text-2xl text-slate-800">Damaged Goods</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track and manage products returned in damaged condition
          </p>
        </div>

        {/* Summary card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <PackageX size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Total Damaged Items
              </p>
              {isLoading ? (
                <div className="h-6 w-16 bg-gray-100 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-800">{totalUnits}</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <DollarSign size={20} className="text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Total Value at Cost
              </p>
              {isLoading ? (
                <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(totalValue)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <AlertOctagon size={28} className="text-emerald-400" />
              </div>
              <p className="font-semibold text-slate-700">No damaged goods</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                All returned items are in good condition. Damaged items will appear here when you
                process a damaged-goods return.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    SKU
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Product Name
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Category
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Damaged Qty
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Cost Price
                  </th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Total Value
                  </th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors duration-150"
                    >
                      {/* SKU */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {item.sku}
                        </span>
                      </td>

                      {/* Product name */}
                      <td className="px-4 py-3 text-sm text-slate-800 font-medium">
                        {item.product_name}
                      </td>

                      {/* Category badge */}
                      <td className="px-4 py-3">
                        {item.category ? (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Damaged qty */}
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">
                          {item.damaged_qty}
                        </span>
                      </td>

                      {/* Cost price */}
                      <td className="px-4 py-3 text-right text-sm text-slate-600">
                        {formatCurrency(item.cost_price)}
                      </td>

                      {/* Total value */}
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-800">
                        {formatCurrency(item.damaged_qty * item.cost_price)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center">
                        <AnimatePresence mode="wait" initial={false}>
                          {confirmId === item.id ? (
                            <motion.div
                              key="confirm"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.1 }}
                              className="flex flex-col items-center gap-1"
                            >
                              <p className="text-xs text-slate-500 mb-1 whitespace-nowrap">
                                Are you sure? This will permanently clear damaged stock.
                              </p>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => writeOffMutation.mutate(item.id)}
                                  disabled={writeOffMutation.isPending}
                                  className={cn(
                                    'flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium transition-colors',
                                    'bg-red-600 text-white hover:bg-red-700',
                                    writeOffMutation.isPending && 'opacity-50 cursor-not-allowed'
                                  )}
                                >
                                  <Check size={11} />
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmId(null)}
                                  disabled={writeOffMutation.isPending}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium border border-gray-200 text-slate-600 hover:bg-gray-50 transition-colors"
                                >
                                  <X size={11} />
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="write-off-btn"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.1 }}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmId(item.id)}
                                className="border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 size={13} />
                                Write Off
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
