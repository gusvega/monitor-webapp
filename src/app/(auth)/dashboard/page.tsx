'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, CheckCircle, GitBranch, Loader, ExternalLink, Star, Server, X } from 'lucide-react'
import Link from 'next/link'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  SectionIntro,
  Skeleton,
  Stat,
  Spinner,
} from '@gusvega/ui'
import { fetchDeployments, groupDeploymentsByEnvironment, fetchReleases, fetchWorkflowRuns, fetchTags, fetchWorkflowRunJobs, STANDARD_ENVIRONMENTS, type WorkflowRun, type WorkflowJob } from '@/lib/github'
import { getLatestDeployment, getLatestRun, getLatestRunStatus, getRepoAttentionItems, getRepoHealth, getVersionDrift, type DeploymentTimelineEntry } from '@/lib/monitor-insights'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description?: string | null
  language?: string | null
  stargazers_count?: number
  html_url?: string
  default_branch?: string
  pushed_at?: string
}

interface RepoDisplay {
  id: number
  name: string
  full_name: string
  description: string
  language: string
  stars: string
  lastUpdated: string
  url: string
  deployments?: Record<string, { tag: string; date: string } | null>
  deploymentTimeline?: DeploymentTimelineEntry[]
  workflowRuns?: (WorkflowRun & { jobs?: WorkflowJob[] })[]
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 30) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return 'N/A'
  }
}

const getRunStatusClasses = (status: 'success' | 'failure' | 'running') => {
  if (status === 'success') return 'bg-green-100 text-green-700'
  if (status === 'failure') return 'bg-red-100 text-red-700'
  return 'bg-yellow-100 text-yellow-700'
}

const isCiWorkflowRun = (run: WorkflowRun) =>
  Boolean(run.name?.includes('Validate') || run.name?.includes('CI'))

const isCdWorkflowRun = (run: WorkflowRun) => !isCiWorkflowRun(run)

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton variant="text" width="20%" />
          <div className="grid gap-3 xl:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="rounded-xl border border-neutral-200 bg-white p-4">
                <Skeleton variant="text" width="35%" />
                <Skeleton variant="text" width="60%" className="mt-2" />
                <Skeleton variant="text" width="80%" className="mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-6">
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="55%" height={28} />
              <Skeleton variant="text" width="70%" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton variant="text" width="18%" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="25%" height={32} className="mt-3" />
                <Skeleton variant="text" width="55%" className="mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {[...Array(2)].map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-6">
              <Skeleton variant="text" width="22%" />
              <div className="space-y-3">
                {[...Array(3)].map((__, rowIndex) => (
                  <div key={rowIndex} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <Skeleton variant="text" width="45%" />
                    <Skeleton variant="text" width="65%" className="mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EnvironmentCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex justify-center">
        <Skeleton variant="circular" width={20} height={20} />
      </div>
      <Skeleton variant="text" width="40%" className="mx-auto" />
      <Skeleton variant="text" width="70%" className="mx-auto mt-3" />
      <Skeleton variant="text" width="45%" className="mx-auto mt-2" />
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { data: session } = useSession()
  const [repos, setRepos] = useState<RepoDisplay[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [deploymentLoading, setDeploymentLoading] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [expandedCiRuns, setExpandedCiRuns] = useState<Record<number, number | null>>({})
  const [expandedCdRuns, setExpandedCdRuns] = useState<Record<number, number | null>>({})

  useEffect(() => {
    localStorage.removeItem('selectedRepoId')
    window.dispatchEvent(new CustomEvent('repoSelected', { detail: { repoId: null } }))
    setSelectedRepoId(null)
  }, [])

  useEffect(() => {
    console.log('[DASHBOARD] Effect running - loading repos')
    let mounted = true

    // Use a small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      try {
        // Check if we're on client side
        if (typeof window === 'undefined') {
          console.warn('[DASHBOARD] Not on client side')
          return
        }

        console.log('[DASHBOARD] Reading from localStorage')
        const saved = localStorage.getItem('userRepos')
        console.log('[DASHBOARD] localStorage.userRepos:', saved ? saved.substring(0, 100) + '...' : 'null')
        
        if (!saved) {
          console.log('[DASHBOARD] No repos saved in localStorage')
          if (mounted) {
            setRepos([])
            setError(null)
            setIsLoading(false)
          }
          return
        }

        console.log('[DASHBOARD] Found saved repos:', saved.length, 'bytes')
        
        try {
          const repoData: GitHubRepo[] = JSON.parse(saved)
          console.log('[DASHBOARD] Parsed', repoData.length, 'repos')
          
          const displayRepos: RepoDisplay[] = repoData.map((repo) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name || 'N/A',
            description: repo.description || 'N/A',
            language: repo.language || 'N/A',
            stars: repo.stargazers_count ? repo.stargazers_count.toString() : '0',
            lastUpdated: formatDate(repo.pushed_at),
            url: repo.html_url || '#',
          }))
          
          if (mounted) {
            console.log('[DASHBOARD] Setting', displayRepos.length, 'repos to state')
            setRepos(displayRepos)
            setError(null)
            setIsLoading(false)
          }
        } catch (parseErr) {
          console.error('[DASHBOARD] Failed to parse repos:', parseErr)
          if (mounted) {
            setError(`Invalid data: ${parseErr instanceof Error ? parseErr.message : 'Parse error'}`)
            setRepos([])
            setIsLoading(false)
          }
        }
      } catch (err) {
        console.error('[DASHBOARD] Unexpected error:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setIsLoading(false)
        }
      }
    }, 0)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [])

  // Fetch deployments for each repo
  useEffect(() => {
    const accessToken = (session as any)?.accessToken
    if (!accessToken || repos.length === 0) return

    repos.forEach((repo) => {
      setDeploymentLoading((prev) => ({ ...prev, [repo.id]: true }))

      Promise.all([
        fetchDeployments(repo.full_name, accessToken),
        fetchReleases(repo.full_name, accessToken),
        fetchWorkflowRuns(repo.full_name, accessToken),
        fetchTags(repo.full_name, accessToken),
      ]).then(([deployments, releases, workflowRuns, tags]) => {
        const deploymentData: Record<string, { tag: string; date: string } | null> = {}

        // Get grouped deployments
        const grouped = groupDeploymentsByEnvironment(deployments)

        // Create a map of commit SHA to tag name (most recent first)
        const shaToTag: Record<string, string> = {}
        tags.forEach((tag: any) => {
          shaToTag[tag.commit.sha] = tag.name
        })
        const deploymentTimeline: DeploymentTimelineEntry[] = deployments
          .slice()
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 10)
          .map((deployment) => ({
            id: deployment.id,
            environment: deployment.environment,
            tag: shaToTag[deployment.sha] || deployment.ref.replace('refs/tags/', '').replace('refs/heads/', ''),
            date: formatDate(deployment.updated_at),
            state: deployment.state,
          }))

        console.log('[DASHBOARD] Tags to SHA mapping:', shaToTag)

        // Initialize all standard environments
        for (const env of STANDARD_ENVIRONMENTS) {
          if (grouped[env]) {
            const deployment = grouped[env]
            // Try to get tag from SHA mapping, otherwise use ref
            const tagName = shaToTag[deployment.sha] || deployment.ref.replace('refs/tags/', '').replace('refs/heads/', '')
            
            deploymentData[env] = {
              tag: tagName,
              date: formatDate(deployment.updated_at),
            }
            console.log('[DASHBOARD] Environment', env, 'deployed with tag:', tagName, 'from SHA:', deployment.sha)
          } else {
            // No deployment for this environment
            deploymentData[env] = null
          }
        }

        console.log('[DASHBOARD] Deployment data for', repo.name, ':', deploymentData)
        console.log('[DASHBOARD] Workflow runs for', repo.name, ':', workflowRuns.length)

        // Fetch jobs for each workflow run
        Promise.all(
          workflowRuns.map((run) => fetchWorkflowRunJobs(repo.full_name, run.id, accessToken))
        ).then((jobsArray) => {
          const runsWithJobs = workflowRuns.map((run, index) => ({
            ...run,
            jobs: jobsArray[index],
          }))

          console.log('[DASHBOARD] Runs with jobs for', repo.name, ':', runsWithJobs)
          console.log('[DASHBOARD] CI runs from this data:', runsWithJobs.filter((r: any) => r.name?.includes('CI')))

          setRepos((prev) =>
            prev.map((r) => (r.id === repo.id ? { ...r, deployments: deploymentData, deploymentTimeline, workflowRuns: runsWithJobs } : r))
          )

          setDeploymentLoading((prev) => ({ ...prev, [repo.id]: false }))
        })
      })
    })
  }, [repos.length])

  // Separate effect to load selected repo ID and listen for changes
  useEffect(() => {
    const loadSelectedRepoId = () => {
      console.log('[DASHBOARD] Reading selected repo ID from localStorage')
      console.log('[DASHBOARD] Current repos in state:', repos.length, 'repos')
      const selectedId = localStorage.getItem('selectedRepoId')
      if (selectedId) {
        const id = parseInt(selectedId, 10)
        console.log('[DASHBOARD] Found selected repo ID:', id)
        console.log('[DASHBOARD] Looking for repo with ID:', id, 'in repos:', repos.map(r => r.id))
        setSelectedRepoId(id)
      } else {
        console.log('[DASHBOARD] No selected repo ID found, showing all repos')
        setSelectedRepoId(null)
      }
    }

    loadSelectedRepoId()

    // Listen for custom event from topbar when repo is selected
    const handleRepoSelected = (e: Event) => {
      const customEvent = e as CustomEvent
      console.log('[DASHBOARD] Detected repo selection event:', customEvent.detail)
      if (customEvent.detail?.repoId) {
        setSelectedRepoId(customEvent.detail.repoId)
      } else {
        setSelectedRepoId(null)
      }
    }

    window.addEventListener('repoSelected', handleRepoSelected)
    return () => {
      window.removeEventListener('repoSelected', handleRepoSelected)
    }
  }, [repos.length])

  // Poll for workflow run updates every 5 seconds
  useEffect(() => {
    const accessToken = (session as any)?.accessToken
    if (!accessToken || repos.length === 0) return

    const pollInterval = setInterval(async () => {
      console.log('[DASHBOARD] Polling for workflow updates...')

      const workflowUpdates = await Promise.all(
        repos.map(async (repo) => {
          try {
            const workflowRuns = await fetchWorkflowRuns(repo.full_name, accessToken)
            const jobsArray = await Promise.all(
              workflowRuns.map((run) => fetchWorkflowRunJobs(repo.full_name, run.id, accessToken))
            )
            
            const runsWithJobs = workflowRuns.map((run, index) => ({
              ...run,
              jobs: jobsArray[index],
            }))
            
            console.log('[DASHBOARD] Updated workflow runs for', repo.name, '- count:', runsWithJobs.length)

            return {
              repoId: repo.id,
              workflowRuns: runsWithJobs,
            }
          } catch (error) {
            console.error('[DASHBOARD] Error fetching workflows for', repo.name, error)
            return {
              repoId: repo.id,
              workflowRuns: repo.workflowRuns,
            }
          }
        })
      )

      setRepos((prev) =>
        prev.map((repo) => {
          const update = workflowUpdates.find((item) => item.repoId === repo.id)
          return update ? { ...repo, workflowRuns: update.workflowRuns } : repo
        })
      )
    }, 5000) // Poll every 5 seconds for near real-time updates

    return () => clearInterval(pollInterval)
  }, [repos.length, session])

  const selectedRepo = selectedRepoId ? repos.find((repo) => repo.id === selectedRepoId) ?? null : null
  const envSummary = STANDARD_ENVIRONMENTS.map((env) => ({
    env,
    count: repos.filter((repo) => repo.deployments?.[env]).length,
  }))
  const totalCdRuns = repos.reduce(
    (total, repo) => total + (repo.workflowRuns?.filter(isCdWorkflowRun).length || 0),
    0
  )
  const totalCiRuns = repos.reduce(
    (total, repo) => total + (repo.workflowRuns?.filter(isCiWorkflowRun).length || 0),
    0
  )
  const repoInsights = repos.map((repo) => {
    const health = getRepoHealth(repo, isCiWorkflowRun, isCdWorkflowRun)
    const attentionItems = getRepoAttentionItems(repo, isCiWorkflowRun, isCdWorkflowRun)
    const latestDeployment = getLatestDeployment(repo)
    const latestCd = getLatestRun(repo.workflowRuns, isCdWorkflowRun)
    const drift = getVersionDrift(repo)

    return {
      repo,
      health,
      attentionItems,
      latestDeployment,
      latestCd,
      drift,
    }
  })
  const reposNeedingAttention = repoInsights.filter(({ attentionItems }) => attentionItems.length > 0)
  const latestCdRuns = repos
    .flatMap((repo) =>
      (repo.workflowRuns || [])
        .filter(isCdWorkflowRun)
        .map((run) => ({
          repoName: repo.name,
          repoUrl: repo.url,
          run,
        }))
    )
    .sort((a, b) => new Date(b.run.created_at).getTime() - new Date(a.run.created_at).getTime())
    .slice(0, 5)

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="px-8 py-8">
          <SectionIntro
            eyebrow="Monitor"
            title="Repository Monitor"
            smaller
            className="px-0"
          >
            <p className="text-neutral-600">
            {selectedRepoId 
              ? 'View details for selected repository'
              : 'Track all your selected repositories'
            }
            {repos.length === 0 && (
              <span>
                {' '}
                —{' '}
                <Link href="/setup" className="text-neutral-900 underline underline-offset-4">
                  Select repositories
                </Link>{' '}
                to get started
              </span>
            )}
            </p>
          </SectionIntro>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8">
        {isLoading ? (
          <OverviewSkeleton />
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
              <div className="mx-auto max-w-xl">
                <Alert title="Error loading repositories">{error}</Alert>
              </div>
              <div className="mt-6">
                <Button onClick={() => router.push('/setup')}>Go to Setup</Button>
              </div>
            </CardContent>
          </Card>
        ) : repos.length === 0 ? (
          <Card>
            <CardContent className="py-10">
              <EmptyState
                icon={<GitBranch className="w-10 h-10 text-neutral-300" />}
                title="No repositories selected"
                description="Select repositories to monitor them here."
                action={<Button onClick={() => router.push('/setup')}>Select Repositories</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {!selectedRepo ? (
              <>
                <Card className={reposNeedingAttention.length > 0 ? 'border-amber-200 bg-amber-50/40' : ''}>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                      <p className="text-sm font-semibold text-neutral-900">Needs Attention</p>
                    </div>

                    {reposNeedingAttention.length === 0 ? (
                      <p className="text-sm text-neutral-600">No urgent cross-repo issues detected right now.</p>
                    ) : (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {reposNeedingAttention.slice(0, 6).map(({ repo, attentionItems, health }) => (
                          <div key={repo.id} className="rounded-xl border border-amber-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-neutral-900">{repo.name}</p>
                                <p className="truncate text-xs text-neutral-500">{repo.full_name}</p>
                              </div>
                              <Badge variant={health.tone === 'critical' ? 'outline' : 'secondary'}>
                                {health.label}
                              </Badge>
                            </div>
                            <div className="mt-3 space-y-2">
                              {attentionItems.slice(0, 3).map((item) => (
                                <p key={`${repo.id}-${item}`} className="text-xs text-neutral-700">
                                  {item}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <CardContent>
                      <Stat label="Repositories" value={repos.length} change="selected for monitoring" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent>
                      <Stat label="CD Runs" value={totalCdRuns} change="across all repositories" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent>
                      <Stat label="CI Runs" value={totalCiRuns} change="recent workflow activity" />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent>
                      <Stat
                        label="Stars"
                        value={repos.reduce((total, repo) => total + Number(repo.stars || 0), 0)}
                        change="GitHub stars combined"
                      />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-neutral-700" />
                      <p className="text-sm font-semibold text-neutral-900">Environment Coverage</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {envSummary.map(({ env, count }) => (
                        <div key={env} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{env}</p>
                          <p className="mt-2 text-2xl font-bold text-neutral-900">{count}</p>
                          <p className="mt-1 text-sm text-neutral-600">repositories deployed</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-neutral-700" />
                      <p className="text-sm font-semibold text-neutral-900">Repository Status Table</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                            <th className="pb-3 pr-4 font-semibold">Repository</th>
                            <th className="pb-3 pr-4 font-semibold">Health</th>
                            <th className="pb-3 pr-4 font-semibold">Prod Version</th>
                            <th className="pb-3 pr-4 font-semibold">Last Deployment</th>
                            <th className="pb-3 pr-4 font-semibold">Latest CD</th>
                            <th className="pb-3 font-semibold">Drift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {repoInsights.map(({ repo, health, latestDeployment, latestCd, drift }) => (
                            <tr key={repo.id} className="border-b border-neutral-100 align-top">
                              <td className="py-3 pr-4">
                                <div>
                                  <p className="font-semibold text-neutral-900">{repo.name}</p>
                                  <p className="text-xs text-neutral-500">{repo.full_name}</p>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <Badge variant={health.tone === 'critical' ? 'outline' : 'secondary'}>
                                  {health.label}
                                </Badge>
                              </td>
                              <td className="py-3 pr-4 text-neutral-700">{repo.deployments?.prod?.tag || 'Not deployed'}</td>
                              <td className="py-3 pr-4 text-neutral-700">
                                {latestDeployment ? `${latestDeployment.environment} · ${latestDeployment.date}` : 'No deployments'}
                              </td>
                              <td className="py-3 pr-4 text-neutral-700">
                                {latestCd ? (
                                  <span className={`rounded px-2 py-1 text-xs font-medium ${getRunStatusClasses(getLatestRunStatus(latestCd) as 'success' | 'failure' | 'running')}`}>
                                    {getLatestRunStatus(latestCd)}
                                  </span>
                                ) : (
                                  'No CD data'
                                )}
                              </td>
                              <td className="py-3 text-neutral-700">{drift.summary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <Card>
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-neutral-700" />
                        <p className="text-sm font-semibold text-neutral-900">Latest CD Runs</p>
                      </div>

                      {latestCdRuns.length === 0 ? (
                        <p className="text-sm text-neutral-500">No CD workflow runs found yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {latestCdRuns.map(({ repoName, repoUrl, run }) => (
                            <div
                              key={`${repoName}-${run.id}`}
                              className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-neutral-900">{run.name}</p>
                                    <Badge variant="outline">{repoName}</Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-neutral-500">
                                    {run.head_branch} · {formatDate(run.created_at)}
                                  </p>
                                </div>
                                <a
                                  href={repoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-neutral-400 transition-colors hover:text-neutral-700"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-neutral-700" />
                        <p className="text-sm font-semibold text-neutral-900">Repository Status</p>
                      </div>

                      <div className="space-y-3">
                        {repos.map((repo) => {
                          const deployedEnvs = STANDARD_ENVIRONMENTS.filter((env) => repo.deployments?.[env])
                          const isRepoLoading = deploymentLoading[repo.id]

                          return (
                            <div key={repo.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-neutral-900">{repo.name}</p>
                                  <p className="truncate text-xs text-neutral-500">{repo.full_name}</p>
                                </div>
                                {isRepoLoading ? (
                                  <Spinner size="sm" />
                                ) : deployedEnvs.length > 0 ? (
                                  <Badge variant="secondary">{deployedEnvs.length} envs live</Badge>
                                ) : (
                                  <Badge variant="outline">No deployments</Badge>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {STANDARD_ENVIRONMENTS.map((env) => {
                                  const hasDeployment = Boolean(repo.deployments?.[env])
                                  return (
                                    <span
                                      key={`${repo.id}-${env}`}
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                        hasDeployment
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-neutral-200 text-neutral-600'
                                      }`}
                                    >
                                      {hasDeployment ? <CheckCircle className="h-3 w-3" /> : <X className="h-3 w-3" />}
                                      {env}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </>
            ) : (
              <div className="space-y-4">
                <div
                  key={selectedRepo.id}
                  className="overflow-hidden"
                >
                  <Card className="hover:border-neutral-300 transition-colors">
                  <CardContent className="p-6">
                    {/* Repo Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h2 className="text-xl font-bold text-neutral-900 truncate">{selectedRepo.name}</h2>
                          <a
                            href={selectedRepo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-neutral-600 transition-colors flex-shrink-0"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <p className="text-sm text-neutral-600 truncate">{selectedRepo.full_name}</p>
                      </div>
                      {selectedRepo.stars !== '0' && selectedRepo.stars !== 'N/A' && (
                        <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                          <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                          <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                            {selectedRepo.stars} stars
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {selectedRepo.description !== 'N/A' && (
                      <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{selectedRepo.description}</p>
                    )}

                    {/* Repo Info Grid */}
                    <div className="grid gap-3 pt-4 border-t border-neutral-200 sm:grid-cols-3">
                      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Language</p>
                        <p className="text-neutral-900 font-medium">{selectedRepo.language}</p>
                      </div>
                      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Last Updated</p>
                        <p className="text-neutral-900 font-medium">{selectedRepo.lastUpdated}</p>
                      </div>
                      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Full Name</p>
                        <p className="text-neutral-900 font-medium truncate">{selectedRepo.full_name}</p>
                      </div>
                    </div>

                    {/* Environments Section */}
                    <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg bg-neutral-100 p-2">
                            <Server className="w-4 h-4 text-neutral-700" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-neutral-900">Environments</p>
                            <p className="text-xs text-neutral-500">Latest deployed version by target environment</p>
                          </div>
                        </div>
                      </div>

                      {deploymentLoading[selectedRepo.id] ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {STANDARD_ENVIRONMENTS.map((env) => (
                            <EnvironmentCardSkeleton key={env} />
                          ))}
                        </div>
                      ) : selectedRepo.deployments ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {STANDARD_ENVIRONMENTS.map((env) => {
                            const data = selectedRepo.deployments?.[env]
                            return (
                              <div key={env} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
                                <div className="mb-3 flex justify-center">
                                  {data ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <X className="w-5 h-5 text-red-400" />
                                  )}
                                </div>
                                <p className="mb-2 text-sm font-medium text-neutral-700 capitalize">{env}</p>
                                {data ? (
                                  <div>
                                    <p className="break-words text-xs font-semibold text-neutral-900">{data.tag}</p>
                                    <p className="mt-1 text-xs text-neutral-500">{data.date}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-neutral-500">Not deployed</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6">
                          <p className="text-sm font-semibold text-neutral-600">No environment deployment data yet.</p>
                        </div>
                      )}
                    </div>

                    {/* Recent Deployments - Organized by Workflow Pipeline */}
                    {selectedRepo.workflowRuns && selectedRepo.workflowRuns.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-neutral-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Server className="w-4 h-4 text-neutral-600" />
                          <p className="text-sm font-semibold text-neutral-900">Recent Deployments</p>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3">
                          {/* CI Pipeline - 1 column */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-bold text-blue-900 mb-3">CI Workflow</p>
                            <div className="grid grid-cols-1 gap-3">
                              {(() => {
                                const ciJobs: (WorkflowJob & { runName: string; runId: number })[] = []
                                selectedRepo.workflowRuns.forEach((run) => {
                                  if (run.name?.includes('CI') && run.jobs) {
                                    run.jobs.forEach((job) => {
                                      ciJobs.push({
                                        ...job,
                                        runName: run.name,
                                        runId: run.id,
                                      })
                                    })
                                  }
                                })

                                return (
                                  <>
                                    {ciJobs.length > 0 ? null : (
                                      <p className="text-xs text-neutral-500">No CI jobs yet</p>
                                    )}
                                  </>
                                )
                              })()}
                            </div>

                            {/* Last CI Run - Debug Display */}
                            {/* Pipeline Runs - Collapsible boxes like CD workflow */}
                            {(() => {
                              const ciRuns = (selectedRepo.workflowRuns || [])
                                .filter(isCiWorkflowRun)
                                .slice(0, 5)
                              console.log('[CI BOXES DEBUG]', { repo: selectedRepo.name, totalRuns: selectedRepo.workflowRuns?.length, ciRunsFiltered: ciRuns.length, runNames: selectedRepo.workflowRuns?.map(r => r.name) })

                              return ciRuns.length > 0 ? (
                                <div className="space-y-3">
                                  {ciRuns.map((run) => {
                                    const isExpanded = expandedCiRuns[selectedRepo.id] === run.id
                                    // Get unique jobs by name - GitHub sometimes returns duplicate jobs
                                    const jobsByName: Record<string, any> = {}
                                    ;(run.jobs || []).forEach((job) => {
                                      if (!jobsByName[job.name]) {
                                        jobsByName[job.name] = job
                                      }
                                    })
                                    const runJobs = Object.values(jobsByName)
                                    console.log(`[CI JOB DEDUP] Run ${run.id}: total jobs=${run.jobs?.length}, unique jobs=${runJobs.length}`, runJobs.map((j: any) => j.name))
                                    // Use the workflow run's actual status from GitHub
                                    const runStatus = run.status === 'in_progress'
                                      ? 'running'
                                      : run.conclusion === 'failure'
                                      ? 'failure'
                                      : run.conclusion === 'success'
                                      ? 'success'
                                      : runJobs.some((j: any) => j.conclusion === 'failure')
                                      ? 'failure'
                                      : runJobs.some(j => !j.conclusion)
                                      ? 'running'
                                      : 'success'

                                    return (
                                      <div key={run.id} className="bg-white border border-blue-200 rounded-lg p-4">
                                        <button
                                          onClick={() =>
                                            setExpandedCiRuns((prev) => ({
                                              ...prev,
                                              [selectedRepo.id]: isExpanded ? null : run.id,
                                            }))
                                          }
                                          className="w-full flex items-center justify-between hover:bg-blue-50 p-2 rounded transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="text-lg leading-none">{isExpanded ? '▼' : '▶'}</div>
                                            <span className="text-xs font-semibold text-blue-700">{formatDate(run.created_at)}</span>
                                            {!isExpanded && (
                                              <div className="flex items-center gap-1">
                                                {runJobs.map((job) => (
                                                  <div key={job.id}>
                                                    {job.conclusion === 'success' ? (
                                                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                                    ) : job.conclusion === 'failure' ? (
                                                      <X className="w-3.5 h-3.5 text-red-500" />
                                                    ) : job.conclusion === 'skipped' ? (
                                                      <div className="w-3.5 h-3.5 rounded-full bg-gray-400" />
                                                    ) : (
                                                      <div className="w-3.5 h-3.5 rounded-full bg-yellow-400" />
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <span
                                            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${getRunStatusClasses(runStatus)}`}
                                          >
                                            <span>
                                              {runStatus === 'success' ? '✅' : runStatus === 'failure' ? '❌' : '⏳'}
                                            </span>
                                            {runStatus === 'success' ? 'Success' : runStatus === 'failure' ? 'Failed' : 'Running'}
                                          </span>
                                        </button>

                                        {isExpanded && (
                                          <div className="mt-4 pt-4 border-t border-blue-100">
                                            {runJobs.map((job) => (
                                              <div key={job.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-blue-50 rounded transition-colors">
                                                <div>
                                                  {job.conclusion === 'success' ? (
                                                    <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                                                  ) : job.conclusion === 'failure' ? (
                                                    <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                  ) : job.conclusion === 'skipped' ? (
                                                    <div className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
                                                  ) : (
                                                    <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                                                  )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-semibold text-neutral-700">{job.name}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : null
                            })()}
                          </div>

                          {/* CD Pipeline - 3 columns, unified runs */}
                          <div className="col-span-3 bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm font-bold text-green-900 mb-3">CD Workflow</p>
                            {(() => {
                              const cdRuns = selectedRepo.workflowRuns
                                ?.filter(isCdWorkflowRun)
                                .slice(0, 5) || []
                              
                              console.log('[CD DEBUG]', { repo: selectedRepo.name, totalRuns: selectedRepo.workflowRuns?.length, allWorkflowNames: selectedRepo.workflowRuns?.map(r => r.name), cdRunsFiltered: cdRuns.length })

                              return cdRuns.length > 0 ? (
                                <div className="space-y-3">
                                  {cdRuns.map((run) => {
                                    const isExpanded = expandedCdRuns[selectedRepo.id] === run.id
                                    
                                    const versionJob = (run.jobs || []).find(j => j.name?.includes('version') || j.name === 'Create Semantic Version')
                                    const allDeployJobs = (run.jobs || []).filter((job) => 
                                      job.name.includes('deploy') || 
                                      job.name.includes('Deploy') ||
                                      ['dev', 'qat', 'prod'].some(env => job.name.toLowerCase().includes(env))
                                    )
                                    
                                    // Use the workflow run's actual status from GitHub
                                    const overallStatus = run.status === 'in_progress'
                                      ? 'running'
                                      : run.conclusion === 'failure'
                                      ? 'failure'
                                      : run.conclusion === 'success'
                                      ? 'success'
                                      : allDeployJobs.some(j => j.conclusion === 'failure')
                                      ? 'failure'
                                      : allDeployJobs.some(j => !j.conclusion)
                                      ? 'running'
                                      : 'success'

                                    return (
                                      <div key={run.id} className="bg-white border border-green-200 rounded-lg p-4">
                                        <button
                                          onClick={() =>
                                            setExpandedCdRuns((prev) => ({
                                              ...prev,
                                              [selectedRepo.id]: isExpanded ? null : run.id,
                                            }))
                                          }
                                          className="w-full flex items-center justify-between hover:bg-green-50 p-2 rounded transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="text-lg leading-none">{isExpanded ? '▼' : '▶'}</div>
                                            <span className="text-xs font-semibold text-green-700">
                                              {formatDate(run.created_at)}
                                            </span>
                                            {!isExpanded && (
                                              <div className="flex items-center gap-1">
                                                {versionJob && (
                                                  <div className="flex items-center">
                                                    {versionJob.conclusion === 'success' ? (
                                                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                                    ) : versionJob.conclusion === 'failure' ? (
                                                      <X className="w-3.5 h-3.5 text-red-500" />
                                                    ) : versionJob.conclusion === 'skipped' ? (
                                                      <div className="w-3.5 h-3.5 rounded-full bg-gray-400" />
                                                    ) : (
                                                      <div className="w-3.5 h-3.5 rounded-full bg-yellow-400" />
                                                    )}
                                                  </div>
                                                )}
                                                {allDeployJobs.map((job) => (
                                                  <div key={job.id} className="flex items-center">
                                                    {job.conclusion === 'success' ? (
                                                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                                    ) : job.conclusion === 'failure' ? (
                                                      <X className="w-3.5 h-3.5 text-red-500" />
                                                    ) : job.conclusion === 'skipped' ? (
                                                      <div className="w-3.5 h-3.5 rounded-full bg-gray-400" />
                                                    ) : (
                                                      <div className="w-3.5 h-3.5 rounded-full bg-yellow-400" />
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <span
                                            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${getRunStatusClasses(overallStatus)}`}
                                          >
                                            <span>
                                              {overallStatus === 'success' ? '✅' : overallStatus === 'failure' ? '❌' : '⏳'}
                                            </span>
                                            {overallStatus === 'success' ? 'Success' : overallStatus === 'failure' ? 'Failed' : 'Running'}
                                          </span>
                                        </button>

                                        {isExpanded && (
                                          <div className="mt-4 pt-4 border-t border-green-100">
                                            {/* Version Job */}
                                            {versionJob && (
                                              <div className="mb-4">
                                                <p className="text-xs font-semibold text-neutral-700 mb-2">Version</p>
                                                <div className="flex items-center gap-2 py-1.5 px-2 bg-green-50 hover:bg-green-100 rounded transition-colors">
                                                  <div>
                                                    {versionJob.conclusion === 'success' ? (
                                                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                    ) : versionJob.conclusion === 'failure' ? (
                                                      <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                    ) : versionJob.conclusion === 'skipped' ? (
                                                      <div className="w-4 h-4 rounded-full bg-gray-400 flex-shrink-0" />
                                                    ) : (
                                                      <div className="w-4 h-4 rounded-full bg-yellow-400 flex-shrink-0" />
                                                    )}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-neutral-700">{versionJob.name}</p>
                                                    <p className="text-xs text-neutral-500">{formatDate(versionJob.completed_at)}</p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {/* Deployments by Environment */}
                                            <div className="grid grid-cols-3 gap-3">
                                              {['dev', 'qat', 'prod'].map((env) => {
                                                const envJobs = allDeployJobs.filter((job) => {
                                                  if (env === 'dev') return job.name.includes('dev') || job.name === 'Deploy to Dev'
                                                  if (env === 'qat') return job.name.includes('qat') || job.name === 'Deploy to QAT'
                                                  if (env === 'prod') return job.name.includes('prod') || job.name === 'Deploy to Prod'
                                                  return false
                                                })

                                                return (
                                                  <div key={env} className="bg-neutral-50 border border-neutral-200 rounded p-3">
                                                    <p className="text-xs font-semibold text-neutral-700 mb-2 capitalize">{env}</p>
                                                    {envJobs.length > 0 ? (
                                                      <div className="space-y-1">
                                                        {envJobs.map((job) => (
                                                          <div key={job.id} className="flex items-center gap-2">
                                                            <div>
                                                              {job.conclusion === 'success' ? (
                                                                <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                                                              ) : job.conclusion === 'failure' ? (
                                                                <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                              ) : job.conclusion === 'skipped' ? (
                                                                <div className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
                                                              ) : (
                                                                <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                                                              )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                              <p className="text-xs text-neutral-700 truncate">{job.name}</p>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    ) : (
                                                      <p className="text-xs text-neutral-500">No jobs</p>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-neutral-500">No CD runs yet</p>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
