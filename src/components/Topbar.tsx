'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChevronDown, GitBranch, Menu, Settings, Plus, LogOut } from 'lucide-react'
import Link from 'next/link'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '@gusvega/ui'
import AddRepoModal from '@/components/AddRepoModal'
import { clearMonitorLocalState } from '@/lib/client-auth'
import { toRepoSlug } from '@/lib/repo-routing'

interface Repository {
  id: number
  name: string
  full_name: string
  description?: string | null
  language?: string | null
}

interface TopbarProps {
  onMenuToggle?: () => void
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [isRepoOpen, setIsRepoOpen] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const getRepoSubtitle = (repo: Repository) => {
    const details = [repo.full_name, repo.language].filter(Boolean)
    return details.join(' · ')
  }

  useEffect(() => {
    const loadRepos = () => {
      try {
        const saved = localStorage.getItem('userRepos')
        if (saved) {
          const repos = JSON.parse(saved)
          setRepositories(repos)

          const savedSelectedId = localStorage.getItem('selectedRepoId')
          if (savedSelectedId) {
            const selectedId = parseInt(savedSelectedId, 10)
            const selected = repos.find((r: Repository) => r.id === selectedId)
            if (selected) {
              setSelectedRepo(selected)
            }
          }
        }
      } catch (err) {
        console.error('Error loading repos:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadRepos()
  }, [])

  useEffect(() => {
    const closeMenus = () => {
      setIsRepoOpen(false)
      setIsUserMenuOpen(false)
    }

    window.addEventListener('click', closeMenus)
    return () => window.removeEventListener('click', closeMenus)
  }, [])

  useEffect(() => {
    const handleRepoSelected = (event: Event) => {
      const customEvent = event as CustomEvent<{ repoId: number | null }>
      const repoId = customEvent.detail?.repoId ?? null

      if (repoId === null) {
        setSelectedRepo(null)
        return
      }

      setSelectedRepo((prev) => {
        if (prev?.id === repoId) return prev
        return repositories.find((repo) => repo.id === repoId) || null
      })
    }

    window.addEventListener('repoSelected', handleRepoSelected)
    return () => window.removeEventListener('repoSelected', handleRepoSelected)
  }, [repositories])

  const handleLogout = async () => {
    clearMonitorLocalState()
    await signOut({ redirect: false })
    router.push('/login')
  }

  const handleSelectRepo = (repo: Repository) => {
    setSelectedRepo(repo)
    localStorage.setItem('selectedRepoId', repo.id.toString())
    router.push(`/dashboard/${toRepoSlug(repo.name)}`)

    setIsRepoOpen(false)
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur-sm md:left-64 md:h-16">
        <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-3 sm:px-4 md:h-full md:px-8 md:py-0 md:gap-6">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onMenuToggle}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-colors hover:bg-neutral-50 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative w-full max-w-full md:w-72" onClick={(e) => e.stopPropagation()}>
            {isLoading ? (
              <Card className="shadow-none">
                <CardContent className="py-2.5">
                  <div className="flex items-center gap-3">
                    <Skeleton variant="rectangular" width={32} height={32} className="rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton variant="text" width="40%" />
                      <Skeleton variant="text" width="70%" className="h-3" />
                    </div>
                    <Skeleton variant="circular" width={16} height={16} />
                  </div>
                </CardContent>
              </Card>
            ) : repositories.length > 0 ? (
              <>
                <button
                  onClick={() => setIsRepoOpen((prev) => !prev)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-left transition-all hover:border-neutral-300 hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-lg bg-neutral-100 p-2">
                        <GitBranch className="w-4 h-4 text-neutral-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {selectedRepo ? selectedRepo.name : 'Overview'}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {selectedRepo ? getRepoSubtitle(selectedRepo) : `${repositories.length} repositories monitored`}
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-500 transition-transform ${isRepoOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {isRepoOpen && (
                  <Card className="absolute top-full left-0 mt-2 w-full max-w-[min(24rem,calc(100vw-2rem))] shadow-lg md:w-80 md:max-w-[min(24rem,calc(100vw-22rem))]">
                    <CardContent className="p-2 space-y-1">
                      {repositories.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => handleSelectRepo(repo)}
                          className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                            selectedRepo?.id === repo.id
                              ? 'bg-neutral-900 text-white'
                              : 'hover:bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{repo.name}</p>
                              <p className="truncate text-xs opacity-75">{getRepoSubtitle(repo)}</p>
                            </div>
                            {repo.language && (
                              <span className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                                {repo.language}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}

                      <div className="border-t border-neutral-100 my-2" />

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          setIsRepoOpen(false)
                          router.push('/setup?manage=true')
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Manage Repositories
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          setIsRepoOpen(false)
                          setIsAddRepoOpen(true)
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Repository
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Button variant="secondary" className="w-full justify-center gap-2" onClick={() => router.push('/setup')}>
                <Plus className="w-4 h-4" />
                Select Repositories
              </Button>
            )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-4">
            {session ? (
              <>
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                    Status
                  </p>
                  <Badge variant="secondary" className="mt-1 gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </Badge>
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 sm:gap-3 sm:px-3 transition-colors hover:bg-neutral-100"
                  >
                    <Avatar
                      size="sm"
                      src={session.user?.image || undefined}
                      alt={session.user?.name || 'User'}
                      initials={session.user?.name?.slice(0, 1) || session.user?.email?.slice(0, 1)}
                    />
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-semibold text-neutral-900">
                        {session.user?.name || session.user?.email}
                      </p>
                    </div>
                    <ChevronDown
                      className={`hidden h-4 w-4 text-neutral-500 transition-transform sm:block ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isUserMenuOpen && (
                    <Card className="absolute top-full right-0 mt-2 w-56 shadow-lg">
                      <CardContent className="p-2">
                        <div className="px-3 py-2">
                          <p className="text-sm font-semibold text-neutral-900">{session.user?.name}</p>
                          <p className="text-xs text-neutral-500 break-all">{session.user?.email}</p>
                        </div>
                        <div className="border-t border-neutral-100 my-2" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={handleLogout}
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <button className="hidden rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 md:inline-flex">
                  <Settings className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link href="/login">
                <Button>Login</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <AddRepoModal isOpen={isAddRepoOpen} onClose={() => setIsAddRepoOpen(false)} />
    </>
  )
}
