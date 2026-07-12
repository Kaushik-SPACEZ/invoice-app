import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, Menu } from 'lucide-react'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/invoices/upload': 'Upload Invoice',
  '/invoices': 'Invoices',
  '/inventory': 'Inventory',
  '/purchases': 'Purchases',
  '/sales': 'Sales',
  '/customers': 'Customers',
  '/returns': 'Sales Returns',
  '/damaged-goods': 'Damaged Goods',
  '/mappings': 'Product Mappings',
  '/marketplace': 'Marketplace',
  '/commission-invoices': 'Commission Invoices',
  '/bank-statements': 'Bank Statement',
  '/gst': 'GST',
  '/accounting': 'Accounting',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/outstanding': 'Outstanding & Credit',
  '/audit-log': 'Audit Log',
  '/settings': 'Settings',
}

export const Navbar = () => {
  const { unreadCount } = useNotificationStore()
  const { user } = useAuthStore()
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore()
  const location = useLocation()
  const navigate = useNavigate()

  const title =
    BREADCRUMB_MAP[location.pathname] ??
    Object.entries(BREADCRUMB_MAP).find(([k]) => location.pathname.startsWith(k))?.[1] ??
    'BizSync'

  return (
    <header className="sticky top-0 z-10 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="lg:hidden flex items-center justify-center rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
        >
          <Menu size={18} />
        </button>

        <h1 className="text-sm font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        {/* Search icon */}
        <button className="flex items-center justify-center rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150">
          <Search size={16} />
        </button>

        {/* Notification bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex items-center justify-center rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold px-0.5 leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <button
          onClick={() => navigate('/settings')}
          className="ml-1 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-colors duration-150 hover:bg-blue-700"
        >
          {user?.name?.[0]?.toUpperCase() ?? 'U'}
        </button>
      </div>
    </header>
  )
}
