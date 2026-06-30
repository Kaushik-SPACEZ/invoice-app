import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Upload, FileText, Package, ShoppingCart,
  Users, Receipt, BookOpen, BarChart3, ShoppingBag,
  Bell, ClipboardList, Settings, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import { authApi } from '../../api/auth'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invoices/upload', icon: Upload, label: 'Upload Invoice' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/gst', icon: Receipt, label: 'GST' },
  { to: '/accounting', icon: BookOpen, label: 'Accounting' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/audit-log', icon: ClipboardList, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export const Sidebar = () => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
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
      animate={{ width: sidebarCollapsed ? 68 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex-shrink-0 h-screen bg-bg-surface border-r border-border-subtle flex flex-col overflow-hidden z-20 relative"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0 text-white font-display font-bold text-sm">B</div>
        <motion.span
          animate={{ opacity: sidebarCollapsed ? 0 : 1, width: sidebarCollapsed ? 0 : 'auto' }}
          transition={{ duration: 0.2 }}
          className="font-display font-bold text-white text-lg whitespace-nowrap overflow-hidden"
        >
          BizSync
        </motion.span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group relative',
                isActive
                  ? 'bg-primary/15 text-primary-light border-l-2 border-primary'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              )
            }
          >
            <div className="relative flex-shrink-0">
              <Icon size={18} />
              {label === 'Notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <motion.span
              animate={{ opacity: sidebarCollapsed ? 0 : 1, width: sidebarCollapsed ? 0 : 'auto' }}
              transition={{ duration: 0.15 }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              {label}
            </motion.span>
          </NavLink>
        ))}
      </nav>

      {/* User + collapse */}
      <div className="border-t border-border-subtle p-3 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <motion.div
            animate={{ opacity: sidebarCollapsed ? 0 : 1, width: sidebarCollapsed ? 0 : 'auto' }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="text-xs font-medium text-gray-200 whitespace-nowrap">{user?.name}</p>
            <p className="text-xs text-gray-500 whitespace-nowrap truncate max-w-[140px]">{user?.business_name}</p>
          </motion.div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} className="flex-shrink-0" />
          <motion.span
            animate={{ opacity: sidebarCollapsed ? 0 : 1, width: sidebarCollapsed ? 0 : 'auto' }}
            transition={{ duration: 0.15 }}
            className="text-sm overflow-hidden whitespace-nowrap"
          >
            Logout
          </motion.span>
        </button>
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-8 h-8 mx-auto rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  )
}
