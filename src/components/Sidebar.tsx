'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Activity, Bell, ChevronDown, Rocket, Settings } from 'lucide-react'
import { Sidebar as GusSidebar, type SidebarNavItem } from '@gusvega/ui'

const navItems: SidebarNavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: Activity,
    children: [
      { label: 'Overview', href: '/dashboard' },
      { label: 'Metrics', href: '/metrics' },
    ],
  },
  {
    label: 'Deployments',
    href: '/deployments',
    icon: Rocket,
    children: [
      { label: 'Production', href: '/deployments/prod' },
      { label: 'Staging', href: '/deployments/staging' },
      { label: 'Development', href: '/deployments/dev' },
    ],
  },
  {
    label: 'Alerts',
    href: '/alerts',
    icon: Bell,
    children: [
      { label: 'Active', href: '/alerts/active' },
      { label: 'History', href: '/alerts/history' },
      { label: 'Rules', href: '/alerts/rules' },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    children: [
      { label: 'General', href: '/settings/general' },
      { label: 'Notifications', href: '/settings/notifications' },
      { label: 'Integrations', href: '/settings/integrations' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleNavigate = (href: string) => {
    if (href === '/dashboard') {
      localStorage.removeItem('selectedRepoId')
      window.dispatchEvent(new CustomEvent('repoSelected', { detail: { repoId: null } }))
    }

    router.push(href)
  }

  return (
    <GusSidebar
      title="Monitor"
      titleIcon={Activity}
      navItems={navItems}
      currentPath={pathname}
      defaultExpandedSections={['Dashboard']}
      chevronIcon={ChevronDown}
      onNavigate={handleNavigate}
    />
  )
}
