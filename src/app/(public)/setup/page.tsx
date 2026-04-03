'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Check, Loader, GitBranch, AlertCircle } from 'lucide-react'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  url: string
  language: string | null
}

export default function SetupPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  
  // Check if user is managing repos (coming from /dashboard manage button)
  const [isManaging, setIsManaging] = useState(false)
  
  useEffect(() => {
    // Read manage query param on client side
    const params = new URLSearchParams(window.location.search)
    setIsManaging(params.get('manage') === 'true')
  }, [])
  
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [selectedRepos, setSelectedRepos] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing...')
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null)
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Session initialization check with timeout
  useEffect(() => {
    console.log('[SETUP] Checking session status:', { status, hasSession: !!session, hasToken: !!(session as any)?.accessToken })
    
    if (status !== 'loading') {
      // Session has loaded
      if (sessionCheckRef.current) clearTimeout(sessionCheckRef.current)
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
    }
  }, [status, session])

  // Set timeout for session initialization
  useEffect(() => {
    if (status === 'loading') {
      console.log('[SETUP] Session is loading, setting 5 second timeout')
      setLoadingStatus('Initializing authentication...')
      
      sessionCheckRef.current = setTimeout(() => {
        console.warn('[SETUP] Session initialization timeout - treating as unauthenticated')
        // If still loading after 5 seconds, treat as not authenticated
        if (status === 'loading') {
          setError('Authentication took too long. Please try logging in again.')
          setIsLoading(false)
        }
      }, 5000)

      return () => {
        if (sessionCheckRef.current) clearTimeout(sessionCheckRef.current)
      }
    }
  }, [status])

  // Main authentication effect
  useEffect(() => {
    console.log('[SETUP] Auth effect - status:', status, 'hasToken:', !!(session as any)?.accessToken)
    
    // Skip if still loading (let timeout handle it)
    if (status === 'loading') {
      return
    }

    // If not authenticated, redirect to login
    if (status === 'unauthenticated') {
      console.log('[SETUP] Unauthenticated, redirecting to login')
      router.push('/login')
      return
    }

    // User is authenticated
    if (status === 'authenticated') {
      console.log('[SETUP] Authenticated, checking for token')
      
      if ((session as any)?.accessToken) {
        console.log('[SETUP] Token found, fetching repos')
        setLoadingStatus('Loading your repositories...')
        fetchGitHubRepos()
        loadSelectedRepos()
      } else {
        console.warn('[SETUP] No token in session')
        setError('Authentication token not available. Please log in again.')
        setIsLoading(false)
      }
    }
  }, [status, session, router])

  const fetchGitHubRepos = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const accessToken = (session as any)?.accessToken
      console.log('[SETUP] Fetching repos with token length:', accessToken?.length)
      
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      console.log('[SETUP] GitHub API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[SETUP] GitHub API error:', response.status, errorData)
        throw new Error(`GitHub API error: ${response.status} - ${errorData.message || 'Unknown error'}`)
      }

      const data: GitHubRepo[] = await response.json()
      console.log('[SETUP] Fetched repos:', data.length)
      setRepos(data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[SETUP] Error fetching repos:', errorMsg)
      setError(`Failed to load your repositories: ${errorMsg}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSelectedRepos = () => {
    const saved = localStorage.getItem('selectedRepos')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSelectedRepos(parsed)
        // If repos are already selected (returning user), redirect to dashboard
        // unless they're intentionally managing repos
        if (parsed.length > 0 && !isManaging) {
          // Slight delay to ensure state is set
          setTimeout(() => router.push('/dashboard'), 100)
        }
      } catch (err) {
        console.error('Error loading selected repos:', err)
      }
    }
  }

  const toggleRepo = (repoId: number) => {
    setSelectedRepos((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    )
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // Save to localStorage
      localStorage.setItem('selectedRepos', JSON.stringify(selectedRepos))
      // Save repo details
      const selectedRepoData = repos.filter((r) => selectedRepos.includes(r.id))
      localStorage.setItem('userRepos', JSON.stringify(selectedRepoData))

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      console.error('Error saving repos:', err)
      setError('Failed to save your selection. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600 mb-2">{loadingStatus}</p>
          <p className="text-xs text-neutral-500">This may take a moment...</p>
        </div>
      </div>
    )
  }

  if (isLoading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600 mb-2">{loadingStatus}</p>
          <p className="text-xs text-neutral-500">Fetching from GitHub</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-neutral-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">Select Repositories</h1>
          <p className="text-neutral-600">
            Choose which repositories you'd like to monitor with Monitor
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-900 font-semibold text-sm">{error}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setError(null)
                    setIsLoading(true)
                    fetchGitHubRepos()
                  }}
                  className="text-red-700 text-sm hover:text-red-800 underline"
                >
                  Try again
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="text-red-700 text-sm hover:text-red-800 underline"
                >
                  Back to login
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Repository Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => toggleRepo(repo.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedRepos.includes(repo.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <GitBranch className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    selectedRepos.includes(repo.id) ? 'text-blue-600' : 'text-neutral-600'
                  }`} />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-neutral-900 truncate">{repo.name}</h3>
                    <p className="text-xs text-neutral-600 truncate">{repo.full_name}</p>
                  </div>
                </div>
                {selectedRepos.includes(repo.id) && (
                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                )}
              </div>
              {repo.description && (
                <p className="text-sm text-neutral-600 line-clamp-2">{repo.description}</p>
              )}
              {repo.language && (
                <div className="mt-3 pt-3 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500">{repo.language}</p>
                </div>
              )}
            </button>
          ))}
        </div>

        {repos.length === 0 && !error && (
          <div className="text-center py-12">
            <GitBranch className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-600">No repositories found</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-lg border border-neutral-200 text-neutral-900 font-semibold hover:bg-neutral-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || selectedRepos.length === 0}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving && <Loader className="w-4 h-4 animate-spin" />}
            Continue ({selectedRepos.length} selected)
          </button>
        </div>
      </div>
    </div>
  )
}
