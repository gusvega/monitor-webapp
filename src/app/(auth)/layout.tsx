'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import { SessionProvider } from 'next-auth/react'

function ProtectedLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // If not authenticated, redirect to login
    if (status === 'unauthenticated') {
      console.log('[AUTH LAYOUT] User is not authenticated, redirecting to /login')
      router.push('/login')
    }
  }, [status, router])

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render protected content if not authenticated
  if (!session) {
    return null
  }

  return (
    <>
      <Topbar />
      <Sidebar />
      <main className="ml-64 min-h-screen">
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
  return (
    <SessionProvider>
      <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
    </SessionProvider>
  )
}
