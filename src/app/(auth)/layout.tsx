'use client'

import { useCallback, useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import { clearMonitorLocalState } from '@/lib/client-auth'
import LoadingScreen from '@/components/LoadingScreen'

function ProtectedLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const hasAccessToken = Boolean((session as any)?.accessToken)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    // If not authenticated, redirect to login
    if (status === 'unauthenticated') {
      console.log('[AUTH LAYOUT] User is not authenticated, redirecting to /login')
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated' && !hasAccessToken) {
      console.warn('[AUTH LAYOUT] Session missing access token, clearing Monitor state')
      clearMonitorLocalState()
      signOut({ redirect: false }).finally(() => router.push('/login'))
    }
  }, [hasAccessToken, router, status])

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  // Show loading state while checking auth
  if (status === 'loading') {
    return <LoadingScreen title="Checking your Monitor session..." description="Preparing your dashboard access." />
  }

  // Don't render protected content if not authenticated
  if (!session || !hasAccessToken) {
    return null
  }

  return (
    <>
      <Topbar onMenuToggle={handleOpenSidebar} />
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
      <main className="min-h-screen pt-16 md:ml-64">
        {children}
      </main>
    </>
  )
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
}
