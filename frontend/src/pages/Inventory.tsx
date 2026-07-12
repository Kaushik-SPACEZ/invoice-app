import { useState } from 'react'
import { Edit2, Trash2, Search, Package, AlertTriangle, XCircle, Plus, Tag, X } from 'lucide-react'
import { useProducts, useLowStockProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, cn } from '../lib/utils'
import toast from 'react-hot-toast'
import type { Product } from '../types'

const DEFAULT_CATEGORIES = ['Electronics', 'Accessories', 'Cables', 'Audio', 'Mobile', 'Clothing']

const STOCK_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'normal', label: 'In Stock' },
  { value: 'low', label: 'Low Stock' },
  { value: 'zero', label: 'Out of Stock' },
]

const TABLE_HEADERS = ['SKU', 'Product', 'Category', 'Stock', 'Min Level', 'Cost Price', 'Sell Price', '']

// Persist user-added categories in localStorage
function useCategories() {
  const [custom, setCustom] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('biz_categories') ?? '[]') } catch { return [] }
  })

  const all = [...new Set([...DEFAULT_CATEGORIES, ...custom])]

  const add = (cat: string) => {
    const trimmed = cat.trim()
    if (!trimmed || all.includes(trimmed)) return
    const next = [...custom, trimmed]
    setCustom(next)
    localStorage.setItem('biz_categories', JSON.stringify(next))
  }

  const remove = (cat: string) => {
    const next = custom.filter(c => c !== cat)
    setCustom(next)
    localStorage.setItem('biz_categories', JSON.stringify(next))
  }

  return { all, add, remove, custom }
}

const EMPTY_FORM = {
  sku: '', name: '', category: '', hsn_code: '', unit: 'pcs',
  cost_price: '', selling_price: '', current_stock: '', min_stock_level: '5',
  input_gst_rate: '', input_gst_amount: '',
}

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newCatInput, setNewCatInput] = useState('')
  const [showCatInput, setShowCatInput] = useState(false)

  const { all: categories, add: addCategory, remove: removeCategory, custom: customCats } = useCategories()

  const { data, isLoading } = useProducts({
    search: search || undefined,
    stock_level: stockFilter !== 'all' ? stockFilter : undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
  })
  const { data: lowStock } = useLowStockProducts()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()

  const products = data?.data ?? []
  const outOfStock = products.filter((p) => p.current_stock === 0).length
  // Laravel paginate returns total at data.total (no meta wrapper)
  const totalSkus = data?.total ?? data?.meta?.total ?? 0

  const stats = [
    { label: 'Total SKUs', value: totalSkus, accent: '#2563EB', icon: <Package size={16} className="text-blue-600" /> },
    { label: 'Low Stock', value: lowStock?.length ?? 0, accent: '#D97706', icon: <AlertTriangle size={16} className="text-amber-600" /> },
    { label: 'Out of Stock', value: outOfStock, accent: '#DC2626', icon: <XCircle size={16} className="text-red-600" /> },
  ]

  const openAdd = () => {
    setEditProduct(null)
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setShowModal(true)
  }

  const openEdit = (p: Product) => {
    setEditProduct(p)
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category ?? '',
      hsn_code: p.hsn_code ?? '',
      unit: p.unit,
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      current_stock: String(p.current_stock),
      min_stock_level: String(p.min_stock_level),
      input_gst_rate: (p as any).input_gst_rate ?? '',
      input_gst_amount: (p as any).input_gst_amount ?? '',
    })
    setErrors({})
    setShowModal(true)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.sku.trim()) e.sku = 'SKU is required'
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.selling_price || isNaN(Number(form.selling_price))) e.selling_price = 'Enter a valid price'
    if (!form.current_stock || isNaN(Number(form.current_stock))) e.current_stock = 'Enter a valid stock number'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category || null,
      hsn_code: form.hsn_code || null,
      unit: form.unit,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price),
      current_stock: Number(form.current_stock),
      min_stock_level: Number(form.min_stock_level) || 5,
      input_gst_rate: Number(form.input_gst_rate) || null,
      input_gst_amount: Number(form.input_gst_amount) || null,
    }

    try {
      if (editProduct) {
        await updateProduct.mutateAsync({ id: editProduct.id, data: payload })
        toast.success('Product updated')
      } else {
        await createProduct.mutateAsync(payload)
        toast.success('Product added')
      }
      setShowModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save product')
    }
  }

  const fieldChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const handleAddCategory = () => {
    if (!newCatInput.trim()) return
    addCategory(newCatInput.trim())
    setForm(prev => ({ ...prev, category: newCatInput.trim() }))
    setNewCatInput('')
    setShowCatInput(false)
    toast.success(`Category "${newCatInput.trim()}" added`)
  }

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Inventory</h1>
        <Button size="sm" onClick={openAdd}>+ Add Product</Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg shadow-sm px-5 py-4" style={{ borderLeft: `3px solid ${s.accent}` }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{s.label}</p>
            <p className="text-2xl font-bold text-slate-800 font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        {/* Filter Bar */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search SKU or product name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {STOCK_FILTERS.map((chip) => (
                <button key={chip.value} onClick={() => setStockFilter(chip.value)}
                  className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors duration-150',
                    stockFilter === chip.value ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50 hover:text-slate-700'
                  )}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1"><Tag size={11} /> Category:</span>
            <button onClick={() => setCategoryFilter('all')}
              className={cn('text-xs px-2.5 py-1 rounded border font-medium transition-colors', categoryFilter === 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50')}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? 'all' : cat)}
                className={cn('text-xs px-2.5 py-1 rounded border font-medium transition-colors', categoryFilter === cat ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50')}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>
        ) : products.length === 0 ? (
          <EmptyState icon="📦" title="No products found" description="Add your first product to start tracking inventory" action={<Button size="sm" onClick={openAdd}>+ Add Product</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {TABLE_HEADERS.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const pct = Math.min(100, (p.current_stock / Math.max(p.min_stock_level * 2, 1)) * 100)
                  const isZero = p.current_stock === 0
                  const isLow = !isZero && p.current_stock <= p.min_stock_level
                  const barColor = isZero ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                  const stockTextClass = isZero ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-700'

                  return (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors duration-100">
                      <td className="px-4 py-3 text-sm font-mono text-blue-600 font-medium">{p.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{p.name}</td>
                      <td className="px-4 py-3">
                        {p.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">{p.category}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-mono text-sm font-semibold tabular-nums', stockTextClass)}>{p.current_stock}</span>
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500 tabular-nums">{p.min_stock_level}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600 tabular-nums">{formatINR(p.cost_price)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-800 font-medium tabular-nums">{formatINR(p.selling_price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150" title="Edit product"><Edit2 size={13} /></button>
                          <button onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) deleteProduct.mutate(p.id) }} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-150" title="Delete product"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editProduct ? `Edit: ${editProduct.name}` : 'Add New Product'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU *</label>
            <input type="text" placeholder="e.g. PHC-001" value={form.sku} onChange={fieldChange('sku')} disabled={!!editProduct}
              className={cn('w-full px-3 py-2 text-sm font-mono bg-white border rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors',
                errors.sku ? 'border-red-400' : 'border-gray-300', editProduct && 'bg-gray-50 text-slate-500 cursor-not-allowed')} />
            {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Name *</label>
            <input type="text" placeholder="e.g. Silicone Phone Case" value={form.name} onChange={fieldChange('name')}
              className={cn('w-full px-3 py-2 text-sm bg-white border rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors', errors.name ? 'border-red-400' : 'border-gray-300')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Category with add-new option */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            {showCatInput ? (
              <div className="flex gap-2">
                <input autoFocus type="text" placeholder="New category name" value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setShowCatInput(false) }}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <button onClick={handleAddCategory} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Add</button>
                <button onClick={() => setShowCatInput(false)} className="px-3 py-2 text-sm bg-white border border-gray-300 text-slate-600 rounded-md hover:bg-gray-50 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={form.category} onChange={fieldChange('category')}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors">
                  <option value="">Select category…</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <button onClick={() => setShowCatInput(true)} title="Add new category"
                  className="px-2.5 py-2 text-sm bg-white border border-gray-300 text-slate-600 rounded-md hover:bg-gray-50 hover:text-blue-600 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            )}
            {/* Show custom categories with delete option */}
            {customCats.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {customCats.map(cat => (
                  <span key={cat} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    {cat}
                    <button onClick={() => removeCategory(cat)} className="hover:text-red-600 ml-0.5"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">HSN Code</label>
            <input type="text" placeholder="e.g. 8517" value={form.hsn_code} onChange={fieldChange('hsn_code')}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cost Price (₹)</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={form.cost_price} onChange={fieldChange('cost_price')}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Selling Price (₹) *</label>
            <input type="number" placeholder="0.00" min="0" step="0.01" value={form.selling_price} onChange={fieldChange('selling_price')}
              className={cn('w-full px-3 py-2 text-sm font-mono bg-white border rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors', errors.selling_price ? 'border-red-400' : 'border-gray-300')} />
            {errors.selling_price && <p className="mt-1 text-xs text-red-600">{errors.selling_price}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Stock *</label>
            <input type="number" placeholder="0" min="0" value={form.current_stock} onChange={fieldChange('current_stock')}
              className={cn('w-full px-3 py-2 text-sm font-mono bg-white border rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors', errors.current_stock ? 'border-red-400' : 'border-gray-300')} />
            {errors.current_stock && <p className="mt-1 text-xs text-red-600">{errors.current_stock}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Min Stock Level</label>
            <input type="number" placeholder="5" min="0" value={form.min_stock_level} onChange={fieldChange('min_stock_level')}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
            <p className="mt-1 text-xs text-slate-400">Alert when stock drops below this</p>
          </div>

          {/* Input GST section */}
          <div className="col-span-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Input GST (Purchase Tax)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Rate (%)</label>
                <select value={form.input_gst_rate} onChange={fieldChange('input_gst_rate')}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors">
                  <option value="">Not applicable</option>
                  {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Amount (₹)</label>
                <input type="number" placeholder="0.00" min="0" step="0.01" value={form.input_gst_amount} onChange={fieldChange('input_gst_amount')}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors" />
                <p className="mt-1 text-xs text-slate-400">ITC credit amount for this product</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50 transition-colors duration-150">Cancel</button>
          <button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150">
            {createProduct.isPending || updateProduct.isPending ? 'Saving…' : editProduct ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
