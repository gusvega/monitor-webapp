'use client'

import { useSession } from 'next-auth/react'
import { CheckCircle } from 'lucide-react'

export default function UserGreeting() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return null
  }

  if (session?.user) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-emerald-900 font-semibold">
            Welcome, <span className="font-bold">{session.user.name || session.user.email}</span>!
          </p>
          <p className="text-emerald-700 text-sm">You are logged in and ready to monitor.</p>
        </div>
      </div>
    )
  }

  return null
}
