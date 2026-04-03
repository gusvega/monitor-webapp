'use client'

import { useState } from 'react'
import { Activity, AlertCircle, CheckCircle, ChevronDown, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Home() {
  const { data: session } = useSession()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut({ redirectTo: '/' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-neutral-50 to-white">
      {/* Toolbar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            <span className="text-lg font-bold text-neutral-950">Monitor</span>
          </div>

          {/* Auth Controls */}
          {session ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-sm font-semibold text-neutral-900 hidden sm:inline">
                  {session.user?.name || session.user?.email}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-neutral-600 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isUserMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-neutral-200">
                    <p className="text-sm font-semibold text-neutral-900">{session.user?.name}</p>
                    <p className="text-xs text-neutral-600">{session.user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100 font-medium flex items-center gap-2 transition-colors"
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4 py-12">
        <div className="max-w-2xl mx-auto w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="flex justify-center mb-6">
              <Activity className="w-16 h-16 text-blue-600" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-neutral-950">
              Monitor
            </h1>
            <p className="text-lg text-neutral-600">
              Monitoring & Observability Dashboard
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-8 sm:p-12 shadow-sm space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-medium text-neutral-950">Your monitoring dashboard is ready</p>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                Track deployments, monitor environments, and manage your infrastructure all in one place.
              </p>
            </div>

            <div className="pt-4 border-t border-neutral-200 space-y-3">
              <p className="text-xs text-neutral-600 font-medium uppercase tracking-wide">Features</p>
              <ul className="space-y-2 text-left">
                <li className="flex items-center gap-2 text-sm text-neutral-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  Real-time deployment tracking
                </li>
                <li className="flex items-center gap-2 text-sm text-neutral-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  Environment status monitoring
                </li>
                <li className="flex items-center gap-2 text-sm text-neutral-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  Deployment history & analytics
                </li>
              </ul>
            </div>

            <div className="flex justify-center pt-4">
              <Link
                href="/dashboard"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>

          <p className="text-sm text-neutral-600">
            Authenticated via GitHub
          </p>
        </div>
      </main>
    </div>
  )
}
