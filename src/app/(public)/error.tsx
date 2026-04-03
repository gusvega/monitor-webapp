'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Public route error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-red-100 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Something went wrong</h2>
        <p className="text-neutral-600 mb-6">{error.message || 'An error occurred.'}</p>
        <button
          onClick={reset}
          className="px-4 py-2.5 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
