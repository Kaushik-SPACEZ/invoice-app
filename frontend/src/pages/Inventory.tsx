import { useState } from 'react'
import { Edit2, Trash2, Search } from 'lucide-react'
import { useProducts, useLowStockProducts, useCreateProduct, useUpdateProduct } from '../hooks/queries'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { formatINR, cn } from '../lib/utils'
import toast from 'react-hot-toast'
import type { Product } from '../types'

const EMPTY_FORM = {
  sku: '', name: '', category: '', hsn_code: '', unit: 'pcs',
  cost_price: '', selling_price: '', current_stock: '', min_stock_level: '5',
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category…' },
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Accessories', label: 'Accessories' },
  { value: 'Cables', label: 'Cables' },
  { value: 'Audio', label: 'Audio' },
  { value: 'Mobile', label: 'Mobile' },
  { value: 'Clothing', label: 'Clothing' },
  { value: 'Other', label: 'Other' },
]

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading } = useProducts({ search: search || undefined, stock_level: stockFilter !== 'all' ? stockFilter : undefined })
  const { data: lowStock } = useLowStockProducts()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const products = data?.data ?? []
  const stats = [
    { label: 'Total SKUs', value: data?.meta?.total ?? 0, color: 'text-white' },
    { label: 'Low Stock', value: lowStock?.length ?? 0, color: 'text-amber-400' },
    { label: 'Out of Stock', value: products.filter((p) => p.current_stock === 0).length, color: 'text-red-400' },
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
      sku: p.sku, name: p.name, category: p.category ?? '', hsn_code: p.hsn_code ?? '',
      unit: p.unit, cost_price: String(p.cost_price), selling_price: String(p.selling_price),
      current_stock: String(p.current_stock), min_stock_level: String(p.min_stock_level),
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
      const msg = err?.response?.data?.message || 'Failed to save product'
      toast.error(msg)
    }
  }

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Inventory</h1>
        <Button size="sm" onClick={openAdd}>+ Add Product</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`font-mono font-bold text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-border-default/50 flex flex-wrap gap-3">
          <Input placeholder="Search SKU or product name…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={14} />} className="max-w-xs" />
          <div className="flex gap-2">
            {['all', 'normal', 'low', 'zero'].map((f) => (
              <button key={f} onClick={() => setStockFilter(f)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${stockFilter === f ? 'bg-primary/20 border-primary/40 text-primary-light' : 'border-border-default text-gray-400 hover:text-gray-200'}`}>
                {f === 'all' ? 'All' : f === 'normal' ? 'In Stock' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={8} cols={7} /></div>
        ) : products.length === 0 ? (
          <EmptyState icon="📦" title="No products found" description="Add your first product to start tracking inventory"
            action={<Button size="sm" onClick={openAdd}>+ Add Product</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-border-default/50">
                  {['SKU', 'Product', 'Category', 'Stock', 'Min', 'Cost', 'Sell Price', ''].map((h) => (
                    <th key={h} className={`px-5 py-3 font-medium text-left`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const pct = Math.min(100, (p.current_stock / Math.max(p.min_stock_level * 2, 1)) * 100)
                  const stockColor = p.current_stock === 0 ? 'bg-red-500' : p.current_stock <= p.min_stock_level ? 'bg-amber-500' : 'bg-emerald-500'
                  return (
                    <tr key={p.id} className="border-b border-border-default/30 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono text-primary-light">{p.sku}</td>
                      <td className="px-5 py-3 text-sm text-gray-200">{p.name}</td>
                      <td className="px-5 py-3"><Badge variant="muted">{p.category ?? '—'}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-mono text-sm font-medium', p.current_stock === 0 ? 'text-red-400' : p.current_stock <= p.min_stock_level ? 'text-amber-400' : 'text-gray-200')}>
                            {p.current_stock}
                          </span>
                          <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${stockColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-400">{p.min_stock_level}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-300">{formatINR(p.cost_price)}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-200">{formatINR(p.selling_price)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-light hover:bg-primary/10 transition-colors"><Edit2 size={13} /></button>
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editProduct ? `Edit: ${editProduct.name}` : 'Add New Product'}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="SKU *" placeholder="e.g. PHC-001" value={form.sku} onChange={f('sku')} error={errors.sku} disabled={!!editProduct} />
          <Input label="Product Name *" placeholder="e.g. Silicone Phone Case" value={form.name} onChange={f('name')} error={errors.name} />
          <Select label="Category" options={CATEGORY_OPTIONS} value={form.category} onChange={f('category')} />
          <Input label="HSN Code" placeholder="e.g. 8517" value={form.hsn_code} onChange={f('hsn_code')} className="font-mono" />
          <Input label="Cost Price (₹)" placeholder="0.00" value={form.cost_price} onChange={f('cost_price')} type="number" min="0" step="0.01" />
          <Input label="Selling Price (₹) *" placeholder="0.00" value={form.selling_price} onChange={f('selling_price')} error={errors.selling_price} type="number" min="0" step="0.01" />
          <Input label="Current Stock *" placeholder="0" value={form.current_stock} onChange={f('current_stock')} error={errors.current_stock} type="number" min="0" />
          <Input label="Min Stock Level" placeholder="5" value={form.min_stock_level} onChange={f('min_stock_level')} type="number" min="0" hint="Alert when stock drops below this" />
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={createProduct.isPending || updateProduct.isPending}
          >
            {editProduct ? 'Save Changes' : 'Add Product'}
          </Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
