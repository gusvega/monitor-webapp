'use client'

import { useState } from 'react'
import { Activity, CheckCircle, ChevronDown, ExternalLink, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  SectionIntro,
  Skeleton,
} from '@gusvega/ui'
import { clearMonitorLocalState } from '@/lib/client-auth'

export default function Home() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    clearMonitorLocalState()
    await signOut({ redirect: false })
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-neutral-50 to-white">
      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
        <Container className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              <span className="text-lg font-bold text-neutral-950">Monitor</span>
            </div>

            <div className="flex items-center gap-3">
              {status === 'loading' ? (
                <>
                  <Skeleton variant="rectangular" width={124} height={40} className="rounded-xl" />
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2">
                    <Skeleton variant="circular" width={32} height={32} />
                    <div className="hidden sm:block space-y-2">
                      <Skeleton variant="text" width={96} />
                    </div>
                  </div>
                </>
              ) : session ? (
                <Button onClick={() => router.push('/dashboard')}>Go to Console</Button>
              ) : (
                <Button onClick={() => router.push('/login')}>Login</Button>
              )}

              {status !== 'loading' && session && (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-neutral-100 transition-colors"
                  >
                    <Avatar
                      size="sm"
                      src={session.user?.image || undefined}
                      alt={session.user?.name || 'User'}
                      initials={session.user?.name?.slice(0, 1) || session.user?.email?.slice(0, 1)}
                    />
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
              )}
            </div>
          </div>
        </Container>
      </div>

      <main className="py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-3xl">
            <SectionIntro eyebrow="Monitor" title="Monitoring and observability for your repositories">
              <p className="text-base leading-7 text-neutral-600">
                A first stop for teams and non-technical stakeholders to see what is deployed, what version is live,
                what failed, and what needs attention before opening GitHub or cloud consoles.
              </p>
            </SectionIntro>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">GitHub-authenticated</Badge>
              <Badge variant="outline">Invite only</Badge>
            </div>

            <Card className="mt-10 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-neutral-900" />
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">Repository Monitor</h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      A single operational view for releases, environments, workflow runs, and deployment confidence.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                  <p className="text-sm font-semibold text-neutral-900">Philosophy</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Monitor follows the delivery philosophy documented in Playbook: validate before merge, promote by version,
                    and keep deployments traceable across environments.
                  </p>
                  <a
                    href="https://playbook.gusvega.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-blue-700"
                  >
                    Read the Playbook philosophy
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    'Real-time deployment tracking',
                    'Environment status monitoring',
                    'Cross-repository status visibility',
                  ].map((feature) => (
                    <div key={feature} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-4 h-4 text-neutral-900 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-neutral-700">{feature}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-5">
                  <p className="text-sm font-semibold text-neutral-900">Who it is for</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">
                    Engineering, DevOps, and delivery stakeholders who need a clean answer to what is running where,
                    whether releases are healthy, and which repositories need attention.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </Container>
      </main>
    </div>
  )
}
