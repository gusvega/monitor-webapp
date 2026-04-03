import { GitBranch } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-100 mb-4">
          <GitBranch className="w-6 h-6 text-neutral-600" />
        </div>
        <h2 className="text-4xl font-bold text-neutral-900 mb-2">404</h2>
        <p className="text-neutral-600 mb-6">Page not found</p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2.5 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
