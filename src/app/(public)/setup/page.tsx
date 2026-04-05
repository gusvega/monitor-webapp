'use client'

import { useEffect, useState, useRef } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Check, Loader, GitBranch, AlertCircle } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  EmptyState,
  SectionIntro,
} from '@gusvega/ui'
import { clearMonitorLocalState } from '@/lib/client-auth'
import LoadingScreen from '@/components/LoadingScreen'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  url: string
  language: string | null
}

export default function SetupPage() {
  const { data: session, status } = useSession()
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
        clearMonitorLocalState()
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
    return <LoadingScreen title={loadingStatus} description="This may take a moment..." />
  }

  if (isLoading && !error) {
    return <LoadingScreen title={loadingStatus} description="Fetching repositories from GitHub." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-neutral-50 to-white">
      <Container className="py-12">
        <div className="mx-auto max-w-5xl">
          <SectionIntro eyebrow="Setup" title="Select repositories to monitor" className="text-center">
            <p className="text-neutral-600">
              Choose which repositories you want Monitor to track for deployments and environments.
            </p>
          </SectionIntro>

          {error && (
            <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <Alert title="Failed to load repositories">{error}</Alert>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setError(null)
                        setIsLoading(true)
                        fetchGitHubRepos()
                      }}
                    >
                      Try again
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        clearMonitorLocalState()
                        signOut({ redirect: false }).finally(() => router.push('/login'))
                      }}
                    >
                      Back to login
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {repos.length > 0 && (
            <div className="mb-6 flex justify-center">
              <Badge variant="secondary">{selectedRepos.length} selected</Badge>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 mb-12 md:grid-cols-2">
            {repos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => toggleRepo(repo.id)}
                className="text-left"
              >
                <Card
                  className={`h-full transition-all ${
                    selectedRepos.includes(repo.id)
                      ? 'border-neutral-900 shadow-sm ring-1 ring-neutral-900'
                      : 'hover:border-neutral-300'
                  }`}
                >
                  <CardContent className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="rounded-lg bg-neutral-100 p-2">
                          <GitBranch className="w-4 h-4 text-neutral-700" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-neutral-900 truncate">{repo.name}</h3>
                          <p className="text-xs text-neutral-600 truncate">{repo.full_name}</p>
                        </div>
                      </div>
                      {selectedRepos.includes(repo.id) && (
                        <Check className="w-5 h-5 text-neutral-900 flex-shrink-0" />
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-neutral-600 line-clamp-2">{repo.description}</p>
                    )}
                    {repo.language && (
                      <div className="pt-3 border-t border-neutral-100">
                        <Badge variant="outline">{repo.language}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          {repos.length === 0 && !error && (
            <Card>
              <CardContent>
                <EmptyState
                  icon={<GitBranch className="w-10 h-10 text-neutral-300" />}
                  title="No repositories found"
                  description="We could not find any repositories for this account yet."
                />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4 justify-center">
            <Button
              variant="secondary"
              onClick={() => router.push('/')}
            >
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || selectedRepos.length === 0}
              className="gap-2"
            >
              {isSaving && <Loader className="w-4 h-4 animate-spin" />}
              Continue ({selectedRepos.length} selected)
            </Button>
          </div>
        </div>
      </Container>
    </div>
  )
}
