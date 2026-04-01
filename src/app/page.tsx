'use client'

import { Activity, AlertCircle, CheckCircle } from 'lucide-react'
import { Card, Container, PageIntro, Badge, Button } from '@gusvega/ui'

// Under construction landing page for the monitoring dashboard
export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12 bg-gradient-to-b from-white via-neutral-50 to-white">
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

        <Card className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <Badge variant="secondary">Under Construction</Badge>
            </div>
            <p className="text-neutral-700 leading-relaxed">
              This is where my monitoring will live for all my websites, web apps, and infrastructure.
            </p>
          </div>

          <div className="pt-4 border-t border-neutral-200 space-y-3">
            <p className="text-xs text-neutral-600 font-medium uppercase tracking-wide">Coming Soon</p>
            <ul className="space-y-2 text-left">
              <li className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                Real-time uptime monitoring
              </li>
              <li className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                Performance metrics & analytics
              </li>
              <li className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                Alert notifications
              </li>
            </ul>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="ghost">Check back soon for updates</Button>
          </div>
        </Card>
      </div>
    </main>
  )
}
