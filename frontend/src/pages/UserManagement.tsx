import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Check, X, Eye, EyeOff, Shield } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Modal } from '../components/ui/Modal'
import { TableSkeleton, EmptyState } from '../components/ui/Skeleton'
import { cn } from '../lib/utils'
import client from '../api/client'
import toast from 'react-hot-toast'

const DEFAULT_ROLE_COLORS: Record<string, string> = {
  admin:      'bg-blue-50 text-blue-700 border-blue-200',
  manager:    'bg-indigo-50 text-indigo-700 border-indigo-200',
  accountant: 'bg-amber-50 text-amber-700 border-amber-200',
  staff:      'bg-slate-50 text-slate-700 border-slate-200',
  viewer:     'bg-gray-50 text-gray-600 border-gray-200',
}

const MODULE_PERMISSIONS = [
  { key: 'invoices',      label: 'Invoices',       desc: 'Upload & view invoices' },
  { key: 'inventory',     label: 'Inventory',      desc: 'Manage stock' },
  { key: 'purchases',     label: 'Purchases',      desc: 'Purchase orders' },
  { key: 'sales',         label: 'Sales',          desc: 'Sales orders' },
  { key: 'gst',           label: 'GST',            desc: 'GST records & reports' },
  { key: 'reports',       label: 'Reports',        desc: 'Download reports' },
  { key: 'customers',     label: 'Customers',      desc: 'Customer database' },
  { key: 'settings',      label: 'Settings',       desc: 'Account settings' },
  { key: 'bank_statement',label: 'Bank Statement', desc: 'Reconciliation' },
  { key: 'commission',    label: 'Commission',     desc: 'Commission invoices' },
  { key: 'damaged_goods', label: 'Damaged Goods',  desc: 'Write-offs' },
  { key: 'users',         label: 'User Management',desc: 'Add/remove staff' },
]

const ROLE_PRESETS: Record<string, string[]> = {
  admin:      MODULE_PERMISSIONS.map(m => m.key),
  manager:    ['invoices','inventory','purchases','sales','reports','customers','commission'],
  accountant: ['invoices','gst','reports','bank_statement','commission'],
  staff:      ['invoices','inventory','sales'],
  viewer:     ['invoices','sales','reports'],
}

const EMPTY_FORM = { name: '', email: '', role: 'staff', password: '', confirm_password: '', permissions: ROLE_PRESETS['staff'] }

export default function UserManagement() {
  const qc = useQueryClient()
  const [showModal, setShowModal]     = useState(false)
  const [editUser, setEditUser]       = useState<any | null>(null)
  const [form, setForm]               = useState({ ...EMPTY_FORM })
  const [showPwd, setShowPwd]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [addingRole, setAddingRole]   = useState(false)
  const [deletingId, setDeletingId]   = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget]       = useState<any>(null)

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => client.get('/staff-users').then(r => r.data.data),
  })

  const { data: rolesData, refetch: refetchRoles } = useQuery({
    queryKey: ['staff-roles'],
    queryFn: () => client.get('/staff-users/roles/list').then(r => r.data.data as string[]),
    initialData: ['admin','manager','accountant','staff','viewer'],
  })

  const users: any[] = usersData?.data ?? []
  const roles: string[] = rolesData ?? ['admin','manager','accountant','staff','viewer']

  const openAdd = () => { setEditUser(null); setForm({ ...EMPTY_FORM }); setShowModal(true) }
  const openEdit = (u: any) => {
    setEditUser(u)
    setForm({ name: u.name, email: u.email, role: u.role ?? 'staff', password: '', confirm_password: '', permissions: u.permissions ?? ROLE_PRESETS[u.role ?? 'staff'] ?? [] })
    setShowModal(true)
  }

  const setRole = (role: string) => setForm(prev => ({ ...prev, role, permissions: ROLE_PRESETS[role] ?? prev.permissions }))

  const togglePermission = (key: string) => setForm(prev => ({
    ...prev,
    permissions: prev.permissions.includes(key) ? prev.permissions.filter(k => k !== key) : [...prev.permissions, key],
  }))

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return }
    if (!form.email.trim()) { toast.error('Email required'); return }
    if (!editUser && !form.password) { toast.error('Password required'); return }
    if (form.password && form.password !== form.confirm_password) { toast.error('Passwords do not match'); return }
    if (form.password && form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    try {
      const payload: any = { name: form.name, email: form.email, role: form.role, permissions: form.permissions }
      if (form.password) payload.password = form.password
      if (editUser) {
        await client.put(`/staff-users/${editUser.id}`, payload)
        toast.success('Staff user updated')
      } else {
        await client.post('/staff-users', payload)
        toast.success('Staff user created')
      }
      qc.invalidateQueries({ queryKey: ['staff-users'] })
      setShowModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleAddRole = async () => {
    const role = newRoleName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!role) { toast.error('Enter a role name'); return }
    setAddingRole(true)
    try {
      await client.post('/staff-users/roles/add', { role })
      toast.success(`Role "${role}" added`)
      refetchRoles()
      setNewRoleName('')
      setShowRoleModal(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to add role')
    } finally { setAddingRole(false) }
  }

  const confirmDelete = (u: any) => { setDeleteTarget(u); setShowDeleteModal(true) }
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await client.delete(`/staff-users/${deleteTarget.id}`)
      qc.invalidateQueries({ queryKey: ['staff-users'] })
      toast.success('Staff user removed')
      setShowDeleteModal(false)
    } catch { toast.error('Failed to remove') } finally { setDeletingId(null) }
  }

  const roleBadge = (role: string) => DEFAULT_ROLE_COLORS[role] ?? 'bg-purple-50 text-purple-700 border-purple-200'

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Add staff with role-based access — control what each person can do.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">
            <Shield size={14} /> Manage Roles
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            <Plus size={14} /> Add Staff
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Available Roles</p>
          <button onClick={() => setShowRoleModal(true)} className="text-xs text-blue-600 hover:underline">+ Add custom role</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {roles.map(role => (
            <div key={role} className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border font-medium capitalize', roleBadge(role))}>
              <Shield size={10} /> {role}
            </div>
          ))}
        </div>
      </div>

      {/* Staff table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6"><TableSkeleton rows={4} cols={5} /></div>
        ) : users.length === 0 ? (
          <EmptyState icon="👥" title="No staff yet" description="Add your first staff member with limited access" action={
            <button onClick={openAdd} className="mt-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Staff</button>
          } />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Staff Member','Email','Role','Permissions',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const perms: string[] = u.permissions ?? []
                return (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-blue-50/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {u.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded border font-medium capitalize', roleBadge(u.role ?? 'staff'))}>
                        {u.role ?? 'staff'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {perms.slice(0,4).map(p => <span key={p} className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">{p.replace('_',' ')}</span>)}
                        {perms.length > 4 && <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">+{perms.length-4} more</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => confirmDelete(u)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? `Edit ${editUser.name}` : 'Add Staff Member'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
              <input type="text" placeholder="e.g. Ravi Kumar" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
              <input type="email" placeholder="staff@business.com" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <button onClick={() => setShowRoleModal(true)} className="text-xs text-blue-600 hover:underline">+ Add custom role</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {roles.filter(r => r !== 'owner').map(role => (
                <button key={role} onClick={() => setRole(role)}
                  className={cn('text-xs px-3 py-1.5 rounded border font-medium transition-colors capitalize', form.role === role ? roleBadge(role) : 'bg-white border-gray-200 text-slate-500 hover:bg-gray-50')}>
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{editUser ? 'New Password (optional)' : 'Password *'}</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
                  className="w-full pr-9 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <button onClick={() => setShowPwd(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
              <input type="password" placeholder="Repeat password" value={form.confirm_password} onChange={e => setForm(p => ({...p, confirm_password: e.target.value}))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Module Permissions</label>
              <button onClick={() => setForm(prev => ({...prev, permissions: MODULE_PERMISSIONS.map(m => m.key)}))} className="text-xs text-blue-600 hover:text-blue-700">Select All</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MODULE_PERMISSIONS.map(mod => {
                const isOn = form.permissions.includes(mod.key)
                return (
                  <button key={mod.key} onClick={() => togglePermission(mod.key)}
                    className={cn('flex items-start gap-2.5 p-2.5 rounded border text-left transition-colors', isOn ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                    <div className={cn('w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border', isOn ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white')}>
                      {isOn && <Check size={10} className="text-white"/>}
                    </div>
                    <div>
                      <p className={cn('text-xs font-medium', isOn ? 'text-blue-700' : 'text-slate-700')}>{mod.label}</p>
                      <p className="text-[11px] text-slate-400">{mod.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : editUser ? 'Save Changes' : 'Create Staff Account'}
          </button>
        </div>
      </Modal>

      {/* Add Role Modal */}
      <Modal open={showRoleModal} onClose={() => setShowRoleModal(false)} title="Add Custom Role" size="sm">
        <p className="text-sm text-slate-600 mb-4">Create a new role. You can then assign permissions and staff to it.</p>
        <input type="text" placeholder="e.g. supervisor, warehouse, delivery" value={newRoleName}
          onChange={e => setNewRoleName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddRole()}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
        <div className="flex gap-3 mt-4">
          <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleAddRole} disabled={addingRole} className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {addingRole ? 'Adding…' : 'Add Role'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Remove Staff Member" size="sm">
        <p className="text-sm text-slate-600">Remove <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})? They will no longer be able to log in.</p>
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 text-sm font-medium bg-white border border-gray-300 text-slate-700 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleDelete} disabled={!!deletingId} className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
            {deletingId ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
