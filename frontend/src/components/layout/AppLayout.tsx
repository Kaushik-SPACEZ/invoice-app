import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { useUIStore } from '../../store/uiStore'

export const AppLayout = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore()

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden">
      {/* Mobile overlay — tap to close sidebar */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar — on mobile: fixed overlay, on desktop: static */}
      <div
        className={[
          'fixed lg:static inset-y-0 left-0 z-20',
          'transition-transform duration-200',
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0',
        ].join(' ')}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
