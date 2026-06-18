import { Outlet } from 'react-router-dom'
import { useUIStore } from '../../stores/uiStore'
import { useDarkMode } from '../../hooks/useDarkMode'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

export function AppShell() {
  useDarkMode()

  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <div className="flex h-screen bg-canvas dark:bg-surface-dark">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => useUIStore.getState().toggleSidebar()}
            aria-hidden="true"
          />
          <div className="relative flex h-full">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
