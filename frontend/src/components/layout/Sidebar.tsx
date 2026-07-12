import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Upload, FileText, Package, ShoppingCart,
  Users, Receipt, BookOpen, BarChart3, ShoppingBag,
  Bell, ClipboardList, Settings, LogOut, ChevronLeft, ChevronRight,
  RotateCcw, AlertOctagon, Link2, ShoppingBag as PurchaseIcon,
  Percent, Landmark, UserCog, CreditCard,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { authApi } from '../../api/auth'
import { cn } from '../../lib/utils'

const NAV_GROUPS = [
  {
    label: '',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Invoices',
    items: [
      { to: '/invoices/upload', icon: Upload, label: 'Upload Invoice' },
      { to: '/invoices', icon: FileText, label: 'Invoices' },
      { to: '/mappings', icon: Link2, label: 'Product Mappings' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/purchases', icon: PurchaseIcon, label: 'Purchases' },
      { to: '/sales', icon: ShoppingCart, label: 'Sales' },
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/outstanding', icon: CreditCard, label: 'Outstanding' },
      { to: '/returns', icon: RotateCcw, label: 'Sales Returns' },
      { to: '/damaged-goods', icon: AlertOctagon, label: 'Damaged Goods' },
      { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/commission-invoices', icon: Percent, label: 'Commission' },
      { to: '/bank-statements', icon: Landmark, label: 'Bank Statement' },
      { to: '/gst', icon: Receipt, label: 'GST' },
      { to: '/accounting', icon: BookOpen, label: 'Accounting' },
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/users', icon: UserCog, label: 'User Management' },
      { to: '/audit-log', icon: ClipboardList, label: 'Audit Log' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export const Sidebar = () => {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUIStore()
  const { user, logout } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    navigate('/login')
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 56 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex-shrink-0 h-screen bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden z-20 relative"
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-4 h-14 bg-slate-900 flex-shrink-0">
        <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          B
        </div>
        {!sidebarCollapsed && (
          <span className="text-white font-semibold text-sm whitespace-nowrap overflow-hidden">
            BizSync
          </span>
        )}
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label || '__dashboard__'}>
            {/* Group label */}
            {group.label && !sidebarCollapsed && (
              <p
                className={cn(
                  'text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1 whitespace-nowrap overflow-hidden',
                  groupIndex === 0 ? '' : 'mt-4'
                )}
              >
                {group.label}
              </p>
            )}
            {group.label && sidebarCollapsed && (
              <div className={groupIndex === 0 ? '' : 'mt-4'} />
            )}

            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/invoices' || to === '/dashboard'}
                  onClick={() => {
                    if (window.innerWidth < 1024) setSidebarCollapsed(true)
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 mx-2 px-3 py-2 rounded-md transition-colors duration-150 group relative',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    )
                  }
                >
                  <div className="relative flex-shrink-0">
                    <Icon size={15} />
                    {label === 'Notifications' && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-sm whitespace-nowrap overflow-hidden">
                      {label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User section + logout + collapse toggle */}
      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700 px-3 py-3 space-y-1">
        {/* User info */}
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden min-w-0">
              <p className="text-sm text-white whitespace-nowrap overflow-hidden text-ellipsis">{user?.name}</p>
              <p className="text-xs text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">{user?.business_name}</p>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors duration-150"
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!sidebarCollapsed && (
            <span className="text-sm whitespace-nowrap overflow-hidden">
              Logout
            </span>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-7 h-7 mx-auto rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors duration-150"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </motion.aside>
  )
}
