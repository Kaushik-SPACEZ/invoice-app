import { useState, useEffect } from 'react'
import { X, Plus, SkipForward, PackagePlus } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import client from '../../api/client'
import toast from 'react-hot-toast'

interface UnmappedItem {
  product_name: string
  quantity: number
  invoice_line_item_id: number
}

interface AvailableProduct {
  id: number
  sku: string
  name: string
  current_stock: number
}

interface MappingRow {
  product_id: number | ''
  quantity: number
}

interface ItemMapping {
  rows: MappingRow[]
  skipped: boolean
  addingNew: boolean
  newProduct: {
    sku: string
    name: string
    category: string
    hsn_code: string
    cost_price: string
    selling_price: string
    current_stock: string
    min_stock_level: string
  }
}

export interface MappingEntry {
  invoice_product_name: string
  items: Array<{ product_id: number; quantity: number }>
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (mappings: MappingEntry[]) => void
  unmappedItems: UnmappedItem[]
  availableProducts: AvailableProduct[]
}

const EMPTY_NEW_PRODUCT = {
  sku: '', name: '', category: '', hsn_code: '',
  cost_price: '', selling_price: '', current_stock: '0', min_stock_level: '5',
}

export const ProductMappingModal = ({ open, onClose, onSave, unmappedItems, availableProducts }: Props) => {
  const [localProducts, setLocalProducts] = useState<AvailableProduct[]>(availableProducts)
  const [savingNew, setSavingNew] = useState<Record<number, boolean>>({})

  const buildInitialState = (): Record<number, ItemMapping> => {
    const state: Record<number, ItemMapping> = {}
    unmappedItems.forEach((item) => {
      state[item.invoice_line_item_id] = {
        rows: [{ product_id: '', quantity: 1 }],
        skipped: false,
        addingNew: false,
        newProduct: { ...EMPTY_NEW_PRODUCT, name: item.product_name },
      }
    })
    return state
  }

  const [mappings, setMappings] = useState<Record<number, ItemMapping>>(buildInitialState)

  useEffect(() => {
    if (open) {
      setMappings(buildInitialState())
      setLocalProducts(availableProducts)
    }
  }, [open, unmappedItems])

  useEffect(() => {
    setLocalProducts(availableProducts)
  }, [availableProducts])

  const updateRow = (lineItemId: number, rowIndex: number, field: keyof MappingRow, value: number | string) => {
    setMappings((prev) => {
      const item = prev[lineItemId]
      const updatedRows = item.rows.map((r, i) =>
        i === rowIndex ? { ...r, [field]: field === 'quantity' ? Number(value) : value } : r
      )
      return { ...prev, [lineItemId]: { ...item, rows: updatedRows } }
    })
  }

  const addRow = (lineItemId: number) => {
    setMappings((prev) => ({
      ...prev,
      [lineItemId]: { ...prev[lineItemId], rows: [...prev[lineItemId].rows, { product_id: '', quantity: 1 }] },
    }))
  }

  const removeRow = (lineItemId: number, rowIndex: number) => {
    setMappings((prev) => {
      const item = prev[lineItemId]
      const updatedRows = item.rows.filter((_, i) => i !== rowIndex)
      return { ...prev, [lineItemId]: { ...item, rows: updatedRows.length > 0 ? updatedRows : item.rows } }
    })
  }

  const updateNewProduct = (lineItemId: number, field: string, value: string) => {
    setMappings((prev) => ({
      ...prev,
      [lineItemId]: {
        ...prev[lineItemId],
        newProduct: { ...prev[lineItemId].newProduct, [field]: value },
      },
    }))
  }

  const handleCreateNewProduct = async (lineItemId: number, item: UnmappedItem) => {
    const mapping = mappings[lineItemId]
    const np = mapping.newProduct
    if (!np.sku.trim()) { toast.error('SKU is required'); return }
    if (!np.name.trim()) { toast.error('Product name is required'); return }
    if (!np.selling_price) { toast.error('Selling price is required'); return }

    setSavingNew(prev => ({ ...prev, [lineItemId]: true }))
    try {
      const res = await client.post('/products', {
        sku: np.sku.trim(),
        name: np.name.trim(),
        category: np.category || null,
        hsn_code: np.hsn_code || null,
        unit: 'pcs',
        cost_price: Number(np.cost_price) || 0,
        selling_price: Number(np.selling_price),
        current_stock: Number(np.current_stock) || 0,
        min_stock_level: Number(np.min_stock_level) || 5,
      })
      const newProd = res.data.data
      const prodEntry: AvailableProduct = {
        id: newProd.id,
        sku: newProd.sku,
        name: newProd.name,
        current_stock: newProd.current_stock,
      }
      setLocalProducts(prev => [...prev, prodEntry])

      // Auto-select the new product in the first row
      setMappings(prev => ({
        ...prev,
        [lineItemId]: {
          ...prev[lineItemId],
          addingNew: false,
          rows: [{ product_id: newProd.id, quantity: item.quantity }],
        },
      }))
      toast.success(`"${newProd.name}" added to inventory!`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create product')
    } finally {
      setSavingNew(prev => ({ ...prev, [lineItemId]: false }))
    }
  }

  const handleSave = () => {
    const result: MappingEntry[] = []
    let hasUnmapped = false

    unmappedItems.forEach((item) => {
      const mapping = mappings[item.invoice_line_item_id]
      if (mapping.skipped) return
      const validRows = mapping.rows.filter((r) => r.product_id !== '' && r.quantity > 0) as Array<{ product_id: number; quantity: number }>
      if (validRows.length === 0) {
        hasUnmapped = true
        return
      }
      result.push({ invoice_product_name: item.product_name, items: validRows })
    })

    // Warn if some items still not mapped and not skipped
    if (hasUnmapped) {
      toast.error('Please select a product for each item, or click Skip to ignore it.')
      return
    }

    onSave(result)
  }

  return (
    <Modal open={open} onClose={onClose} size="lg">
      {/* Header */}
      <div className="-mx-5 -mt-5 px-5 py-4 border-b border-gray-100 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Map New Products to Inventory</h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-md">
            These products weren't found in inventory. Map them to existing products or add them as new.
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0 ml-4">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="mt-5 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
        {unmappedItems.map((item) => {
          const mapping = mappings[item.invoice_line_item_id]
          if (!mapping) return null
          const isSkipped = mapping.skipped
          const isAddingNew = mapping.addingNew
          const np = mapping.newProduct

          return (
            <div key={item.invoice_line_item_id} className={cn('rounded-lg border p-4', isSkipped ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-200 bg-white')}>
              {/* Item header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 truncate">{item.product_name}</span>
                  <span className="flex-shrink-0 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5">Qty: {item.quantity}</span>
                </div>
                {!isSkipped ? (
                  <button onClick={() => setMappings(p => ({ ...p, [item.invoice_line_item_id]: { ...p[item.invoice_line_item_id], skipped: true } }))}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 flex-shrink-0 ml-2">
                    <SkipForward size={12} /> Skip
                  </button>
                ) : (
                  <button onClick={() => setMappings(p => ({ ...p, [item.invoice_line_item_id]: { ...p[item.invoice_line_item_id], skipped: false } }))}
                    className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0 ml-2">Undo skip</button>
                )}
              </div>

              {!isSkipped && (
                <>
                  {/* Mode toggle */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setMappings(p => ({ ...p, [item.invoice_line_item_id]: { ...p[item.invoice_line_item_id], addingNew: false } }))}
                      className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors', !isAddingNew ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50')}
                    >
                      Map to existing
                    </button>
                    <button
                      onClick={() => setMappings(p => ({ ...p, [item.invoice_line_item_id]: { ...p[item.invoice_line_item_id], addingNew: true } }))}
                      className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors flex items-center gap-1', isAddingNew ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50')}
                    >
                      <PackagePlus size={12} /> Add as new product
                    </button>
                  </div>

                  {!isAddingNew ? (
                    /* Existing product mapping */
                    <>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Maps to:</p>
                      {localProducts.length === 0 && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                          ⚠️ You have no products in inventory yet. Use <strong>"Add as new product"</strong> tab to create one, or go to <strong>Inventory → Add Product</strong> first.
                        </div>
                      )}
                      <div className="flex gap-2 mb-1 px-1">
                        <span className="flex-1 text-xs text-slate-400">Product in inventory</span>
                        <span className="w-20 text-xs text-slate-400 text-center">Qty per unit</span>
                      </div>
                      {mapping.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex gap-2 mb-2 items-center">
                          <select
                            value={row.product_id}
                            onChange={(e) => updateRow(item.invoice_line_item_id, rowIndex, 'product_id', e.target.value === '' ? '' : Number(e.target.value))}
                            className="flex-1 text-sm bg-white border border-gray-300 rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="">— Select product —</option>
                            {localProducts.map((p) => (
                              <option key={p.id} value={p.id}>{p.sku} · {p.name} (Stock: {p.current_stock})</option>
                            ))}
                          </select>
                          <input
                            type="number" min={0.001} step={0.001}
                            value={row.quantity}
                            onChange={(e) => updateRow(item.invoice_line_item_id, rowIndex, 'quantity', e.target.value)}
                            className="w-20 text-sm text-center bg-white border border-gray-300 rounded-md px-2 py-2 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                          {mapping.rows.length > 1 && (
                            <button onClick={() => removeRow(item.invoice_line_item_id, rowIndex)} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addRow(item.invoice_line_item_id)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1">
                        <Plus size={12} /> Add Product
                      </button>
                    </>
                  ) : (
                    /* Add new product form */
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">New Product Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">SKU *</label>
                          <input value={np.sku} onChange={e => updateNewProduct(item.invoice_line_item_id, 'sku', e.target.value)}
                            placeholder="e.g. ABACUS-15R" className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Product Name *</label>
                          <input value={np.name} onChange={e => updateNewProduct(item.invoice_line_item_id, 'name', e.target.value)}
                            className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">HSN Code</label>
                          <input value={np.hsn_code} onChange={e => updateNewProduct(item.invoice_line_item_id, 'hsn_code', e.target.value)}
                            placeholder="e.g. 901720" className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
                          <input value={np.category} onChange={e => updateNewProduct(item.invoice_line_item_id, 'category', e.target.value)}
                            placeholder="e.g. Education" className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Cost Price (₹)</label>
                          <input type="number" value={np.cost_price} onChange={e => updateNewProduct(item.invoice_line_item_id, 'cost_price', e.target.value)}
                            placeholder="0.00" className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Selling Price (₹) *</label>
                          <input type="number" value={np.selling_price} onChange={e => updateNewProduct(item.invoice_line_item_id, 'selling_price', e.target.value)}
                            placeholder="0.00" className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Current Stock</label>
                          <input type="number" value={np.current_stock} onChange={e => updateNewProduct(item.invoice_line_item_id, 'current_stock', e.target.value)}
                            className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">Min Stock Level</label>
                          <input type="number" value={np.min_stock_level} onChange={e => updateNewProduct(item.invoice_line_item_id, 'min_stock_level', e.target.value)}
                            className="w-full text-sm bg-white border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                      </div>
                      <button
                        onClick={() => handleCreateNewProduct(item.invoice_line_item_id, item)}
                        disabled={savingNew[item.invoice_line_item_id]}
                        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
                      >
                        {savingNew[item.invoice_line_item_id] ? 'Creating…' : '+ Create & Map Product'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-slate-400">Saved mappings will be applied automatically next time</p>
        <div className="flex gap-3">
          <button onClick={() => { setMappings(prev => { const u = { ...prev }; Object.keys(u).forEach(k => { u[Number(k)] = { ...u[Number(k)], skipped: true } }); return u }) }}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
            Skip All
          </button>
          <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors">
            Save Mappings
          </button>
        </div>
      </div>
    </Modal>
  )
}
