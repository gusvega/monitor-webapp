'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChevronDown, GitBranch, Settings, Plus, LogOut, X, Loader } from 'lucide-react'
import Link from 'next/link'

interface Repository {
  id: number
  name: string
  full_name: string
  description?: string | null
  language?: string | null
}

function AddRepoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const urlPattern = /^https?:\/\/github\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)(\.git)?$/
      const match = repoUrl.trim().match(urlPattern)

      if (!match) {
        setError('Please enter a valid GitHub repository URL')
        setIsLoading(false)
        return
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
      setRepoUrl('')
      onClose()
    } catch (err) {
      setError('Failed to add repository. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-neutral-200 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-neutral-600" />
            <h2 className="text-lg font-bold text-neutral-900">Add Repository</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
            <p className="text-xs text-neutral-600 mt-2">
              Enter the full GitHub URL (e.g., https://github.com/gusvega/monitor-webapp)
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 text-neutral-900 font-semibold hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !repoUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Repository'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Topbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [isRepoOpen, setIsRepoOpen] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load selected repos from localStorage
    const loadRepos = () => {
      try {
        const saved = localStorage.getItem('userRepos')
        if (saved) {
          const repos = JSON.parse(saved)
          setRepositories(repos)
          // Don't automatically set selectedRepo - let it default to null (All Repos)
          // unless there was a previously selected repo in localStorage
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

  const handleLogout = async () => {
    await signOut({ redirectTo: '/' })
  }

  return (
    <>
      <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-neutral-200 z-20">
        <div className="h-full px-8 flex items-center justify-between">
          {/* Left: Repository Selector */}
          <div className="relative w-72">
            {isLoading ? (
              <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-2.5">
                  <Loader className="w-4 h-4 text-neutral-600 animate-spin" />
                  <p className="text-sm text-neutral-600">Loading...</p>
                </div>
              </div>
            ) : repositories.length > 0 ? (
              <>
                <button
                  onClick={() => setIsRepoOpen(!isRepoOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GitBranch className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                    <div className="min-w-0 text-left">
                      <p className="text-xs text-neutral-600 font-semibold uppercase tracking-wide leading-none">Repository</p>
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {selectedRepo ? selectedRepo.name : `All (${repositories.length})`}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-neutral-600 flex-shrink-0 transition-transform ${isRepoOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isRepoOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white border border-neutral-200 rounded-lg shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => {
                          setSelectedRepo(null)
                          // Clear selected repo from localStorage to show all repos
                          localStorage.removeItem('selectedRepoId')
                          // Dispatch custom event so dashboard listens for changes in same tab
                          window.dispatchEvent(new CustomEvent('repoSelected', { detail: { repoId: null } }))
                          setIsRepoOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          selectedRepo === null
                            ? 'bg-neutral-900 text-white'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <p className="font-semibold">All Repositories</p>
                        <p className="text-xs opacity-75">View all {repositories.length} repos</p>
                      </button>
                      <div className="py-1 border-t border-neutral-200"></div>
                      {repositories.map(repo => (
                        <button
                          key={repo.id}
                          onClick={() => {
                            setSelectedRepo(repo)
                            // Save selected repo to localStorage for dashboard to use
                            localStorage.setItem('selectedRepoId', repo.id.toString())
                            // Dispatch custom event so dashboard listens for changes in same tab
                            window.dispatchEvent(new CustomEvent('repoSelected', { detail: { repoId: repo.id } }))
                            setIsRepoOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            selectedRepo?.id === repo.id
                              ? 'bg-neutral-900 text-white'
                              : 'text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          <p className="font-semibold">{repo.name}</p>
                          <p className="text-xs opacity-75">{repo.full_name}</p>
                        </button>
                      ))}
                      <div className="pt-2 border-t border-neutral-200">
                        <button
                          onClick={() => {
                            setIsRepoOpen(false)
                            router.push('/setup?manage=true')
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-blue-700 hover:bg-blue-50 font-semibold transition-colors flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Manage Repositories
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/setup"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-semibold text-sm"
              >
                <Plus size={16} />
                Select Repositories
              </Link>
            )}
          </div>

          {/* Right: Status & User */}
          <div className="flex items-center gap-6">
            {session ? (
              <>
                <div className="text-right">
                  <p className="text-xs text-neutral-600 font-semibold uppercase tracking-wide">Status</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-sm font-semibold text-neutral-900">Live</p>
                  </div>
                </div>

                {/* User Menu */}
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

                <button className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                  <Settings size={18} />
                </button>
              </>
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
      </header>
    </>
  )
}
