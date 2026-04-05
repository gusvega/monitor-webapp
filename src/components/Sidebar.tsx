'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, Bell, ChevronDown, Rocket, Settings, X } from 'lucide-react'
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

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleNavigate = (href: string) => {
    if (href === '/dashboard') {
      localStorage.removeItem('selectedRepoId')
      window.dispatchEvent(new CustomEvent('repoSelected', { detail: { repoId: null } }))
    }

    onClose()
    router.push(href)
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 md:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>

          <GusSidebar
            title="Monitor"
            titleIcon={Activity}
            navItems={navItems}
            currentPath={pathname}
            defaultExpandedSections={['Dashboard']}
            chevronIcon={ChevronDown}
            onNavigate={handleNavigate}
            className="h-full"
          />
        </div>
      </div>
    </>
  )
}
