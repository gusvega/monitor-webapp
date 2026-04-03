'use client'

import { useState } from 'react'
import { GitBranch, Loader, AlertCircle } from 'lucide-react'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn('github', { redirect: true, callbackUrl: '/setup' })
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Failed to sign in with GitHub')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg border border-neutral-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 px-8 py-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white rounded-lg">
                <GitBranch className="w-8 h-8 text-neutral-900" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Monitor</h1>
            <p className="text-neutral-300 text-sm">Track deployments and monitor your infrastructure</p>
          </div>

          {/* Content */}
          <div className="px-8 py-10">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-neutral-900 mb-2">Sign In</h2>
              <p className="text-neutral-600 text-sm">Sign in with your GitHub account to access Monitor</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-900 font-semibold text-sm">{error}</p>
                  <p className="text-red-700 text-xs mt-1">Please contact support if you believe you should have access.</p>
                </div>
              </div>
            )}

            <button
              onClick={handleGitHubSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Sign in with GitHub
                </>
              )}
            </button>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900">
                💡 We use GitHub OAuth to securely authenticate. No passwords stored.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-neutral-50 border-t border-neutral-200 text-center">
            <p className="text-xs text-neutral-600">
              By signing in, you agree to our terms of service
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <div className="text-center mt-8">
          <p className="text-neutral-400 text-xs">
            Monitor v1.0.0 • Built with Next.js & Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  )
}
