'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
  children?: NavItem[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    children: [
      { label: 'Overview', href: '/' },
      { label: 'All Repos', href: '/repos' },
      { label: 'Metrics', href: '/metrics' },
    ],
  },
  {
    label: 'Deployments',
    href: '/deployments',
    children: [
      { label: 'Production', href: '/deployments/prod' },
      { label: 'Staging', href: '/deployments/staging' },
      { label: 'Development', href: '/deployments/dev' },
    ],
  },
  {
    label: 'Alerts',
    href: '/alerts',
    children: [
      { label: 'Active', href: '/alerts/active' },
      { label: 'History', href: '/alerts/history' },
      { label: 'Rules', href: '/alerts/rules' },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    children: [
      { label: 'General', href: '/settings/general' },
      { label: 'Notifications', href: '/settings/notifications' },
      { label: 'Integrations', href: '/settings/integrations' },
    ],
  },
]

function NavItemComponent({ item, pathname, isChild = false }: { item: NavItem; pathname: string; isChild?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(item.label === 'Dashboard')
  const hasChildren = item.children && item.children.length > 0
  const isActive = pathname === item.href
  const hasActiveChild = item.children?.some(child => pathname === child.href)

  if (isChild) {
    return (
      <Link
        href={item.href}
        className={`block px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
          isActive
            ? 'bg-neutral-700/40 text-white border-l-2 border-neutral-400'
            : 'text-neutral-400 hover:text-neutral-200 border-l-2 border-transparent hover:bg-neutral-800/40'
        }`}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-5 py-3 rounded-lg text-xs font-semibold transition-all duration-200 group ${
          isActive && !hasChildren
            ? 'bg-gradient-to-r from-neutral-700 to-neutral-600 text-white shadow-lg shadow-neutral-700/20'
            : 'text-neutral-300 hover:text-white hover:bg-neutral-800/40'
        } ${hasActiveChild ? 'text-white bg-neutral-800/20' : ''}`}
      >
        <span>{item.label}</span>
        {hasChildren && (
          <span className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={18} />
          </span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div className="mt-2 ml-4 space-y-1 pl-4 border-l border-neutral-700/50">
          {item.children!.map(child => (
            <NavItemComponent key={child.href} item={child} pathname={pathname} isChild={true} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="fixed left-0 top-0 h-screen w-64 flex flex-col bg-gradient-to-b from-neutral-900 to-neutral-950 border-r border-neutral-800">
      {/* Header */}
      <div className="h-16 flex items-center px-5 border-b border-neutral-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-neutral-100 to-neutral-300 bg-clip-text text-transparent">
          Monitor
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-5">
        <div className="space-y-3">
          {navItems.map(item => (
            <NavItemComponent key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="h-16 flex items-center px-5 border-t border-neutral-800">
        <span className="text-xs text-neutral-500">© 2026 Monitor</span>
      </div>
    </div>
  )
}
