import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Building2,
  FileText,
  Search,
  BarChart2,
  AlertCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Ballina', href: '/', icon: Home },
  { label: 'Kompanite', href: '/companies', icon: Building2 },
  { label: 'Dokumentet', href: '/documents', icon: FileText },
  { label: 'Procedurat APP', href: '/procedures', icon: Search },
  { label: 'Analizat', href: '/analyses', icon: BarChart2 },
  { label: 'Dok. Mungojnë', href: '/missing-docs', icon: AlertCircle },
  { label: 'Admin', href: '/admin', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const { user } = useAuth()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const location = useLocation()

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === 'admin'
  )

  return (
    <aside
      className={cn(
        'flex flex-col bg-gray-900 text-white transition-all duration-300 ease-in-out shrink-0',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 border-b border-gray-700/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600 shrink-0">
            <Scale className="h-4 w-4 text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-white truncate text-sm tracking-wide">
              Jurist Pro
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon
          // Exact match for root, prefix match for others
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href)

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Settings link */}
      <div className="border-t border-gray-700/60 py-3 px-2 space-y-0.5">
        <NavLink
          to="/settings"
          className={cn(
            'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
            location.pathname === '/settings'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          )}
          title={!sidebarOpen ? 'Cilësimet' : undefined}
        >
          <Settings className="h-4.5 w-4.5 shrink-0" />
          {sidebarOpen && <span className="truncate">Cilësimet</span>}
        </NavLink>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-gray-700/60 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        aria-label={sidebarOpen ? 'Mbyll menunë' : 'Hap menunë'}
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    </aside>
  )
}
