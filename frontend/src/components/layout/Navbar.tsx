import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, Search } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/invoices/upload': 'Upload Invoice',
  '/invoices': 'Invoices',
  '/inventory': 'Inventory',
  '/sales': 'Sales',
  '/customers': 'Customers',
  '/gst': 'GST',
  '/accounting': 'Accounting',
  '/reports': 'Reports',
  '/marketplace': 'Marketplace Analytics',
  '/notifications': 'Notifications',
  '/audit-log': 'Audit Log',
  '/settings': 'Settings',
}

export const Navbar = () => {
  const { darkMode, toggleDarkMode } = useUIStore()
  const { unreadCount } = useNotificationStore()
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const title = BREADCRUMB_MAP[location.pathname] ??
    Object.entries(BREADCRUMB_MAP).find(([k]) => location.pathname.startsWith(k))?.[1] ??
    'BizSync'

  return (
    <header className="h-16 bg-bg-surface/80 backdrop-blur-xl border-b border-border-subtle flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="font-display font-semibold text-base text-gray-200">{title}</h1>

      <div className="flex items-center gap-2">
        <button className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors">
          <Search size={17} />
        </button>

        <button
          onClick={() => navigate('/notifications')}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-danger rounded-full text-white text-[9px] flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={toggleDarkMode}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold cursor-pointer ml-1"
          onClick={() => navigate('/settings')}>
          {user?.name?.[0]?.toUpperCase() ?? 'U'}
        </div>
      </div>
    </header>
  )
}
