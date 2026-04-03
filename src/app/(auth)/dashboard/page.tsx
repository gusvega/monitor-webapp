'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, CheckCircle, GitBranch, Loader, ExternalLink, Star, Server, X } from 'lucide-react'
import Link from 'next/link'
import UserGreeting from '@/components/UserGreeting'
import { fetchDeployments, groupDeploymentsByEnvironment, fetchReleases, fetchWorkflowRuns, fetchTags, fetchWorkflowRunJobs, STANDARD_ENVIRONMENTS, type WorkflowRun, type WorkflowJob } from '@/lib/github'

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
            prev.map((r) => (r.id === repo.id ? { ...r, deployments: deploymentData, workflowRuns: runsWithJobs } : r))
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

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="px-8 py-8">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">Repository Monitor</h1>
          <p className="text-neutral-600">
            {selectedRepoId 
              ? 'View details for selected repository'
              : 'Track all your selected repositories'
            }
            {repos.length === 0 && (
              <span>
                {' '}
                —{' '}
                <Link href="/setup" className="text-blue-600 hover:text-blue-700 underline">
                  Select repositories
                </Link>{' '}
                to get started
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-8 space-y-8">
        <UserGreeting />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-neutral-600 mx-auto mb-2" />
              <p className="text-neutral-600 mb-1">Loading repositories...</p>
              <p className="text-xs text-neutral-500">Please wait</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Repositories</h3>
            <p className="text-red-700 mb-6">{error}</p>
            <Link
              href="/setup"
              className="inline-block px-6 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
            >
              Go to Setup
            </Link>
          </div>
        ) : repos.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
            <GitBranch className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">No repositories selected</h3>
            <p className="text-neutral-600 mb-6">Select repositories to monitor them here</p>
            <Link
              href="/setup"
              className="inline-block px-6 py-2.5 rounded-lg bg-neutral-900 text-white font-semibold hover:bg-neutral-800 transition-colors"
            >
              Select Repositories
            </Link>
          </div>
        ) : (
          <>
            {/* Summary Stats - show for selected repo or all repos if none selected */}
            {(() => {
              const displayRepos = selectedRepoId ? repos.filter(r => r.id === selectedRepoId) : repos
              console.log('[DASHBOARD] Filtering: selectedRepoId=', selectedRepoId, 'total repos=', repos.length, 'display repos=', displayRepos.length)
              return (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                      <p className="text-neutral-600 text-sm font-medium mb-2">Total Repositories</p>
                      <p className="text-3xl font-bold text-neutral-900">{displayRepos.length}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                      <p className="text-neutral-600 text-sm font-medium mb-2">With Stars</p>
                      <p className="text-3xl font-bold text-neutral-900">
                        {displayRepos.filter((r) => r.stars !== '0' && r.stars !== 'N/A').length}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-neutral-200 p-6">
                      <p className="text-neutral-600 text-sm font-medium mb-2">Languages</p>
                      <p className="text-3xl font-bold text-neutral-900">
                        {new Set(displayRepos.filter((r) => r.language !== 'N/A').map((r) => r.language)).size}
                      </p>
                    </div>
                  </div>

                  {/* Repositories Grid */}
                  <div className="space-y-4">
                    {displayRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="bg-white rounded-lg border border-neutral-200 overflow-hidden hover:border-neutral-300 transition-colors"
                >
                  <div className="p-6">
                    {/* Repo Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h2 className="text-xl font-bold text-neutral-900 truncate">{repo.name}</h2>
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-neutral-600 transition-colors flex-shrink-0"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <p className="text-sm text-neutral-600 truncate">{repo.full_name}</p>
                      </div>
                      {repo.stars !== '0' && repo.stars !== 'N/A' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg ml-4 flex-shrink-0">
                          <Star className="w-4 h-4 text-amber-600 fill-amber-600" />
                          <span className="text-sm font-semibold text-amber-700">{repo.stars}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {repo.description !== 'N/A' && (
                      <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{repo.description}</p>
                    )}

                    {/* Repo Info Grid */}
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t border-neutral-200">
                      <div>
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Language</p>
                        <p className="text-neutral-900 font-medium">{repo.language}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Last Updated</p>
                        <p className="text-neutral-900 font-medium">{repo.lastUpdated}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Stars</p>
                        <p className="text-neutral-900 font-medium">{repo.stars}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600 text-xs font-semibold uppercase tracking-wide mb-1">Full Name</p>
                        <p className="text-neutral-900 font-medium truncate">{repo.full_name}</p>
                      </div>
                    </div>

                    {/* Deployments Section */}
                    {deploymentLoading[repo.id] ? (
                      <div className="mt-4 pt-4 border-t border-neutral-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Server className="w-4 h-4 text-neutral-600" />
                          <p className="text-sm font-semibold text-neutral-600">Loading environments...</p>
                        </div>
                      </div>
                    ) : repo.deployments ? (
                      <div className="mt-4 pt-4 border-t border-neutral-200">
                        <div className="flex items-center gap-2 mb-3">
                          <Server className="w-4 h-4 text-neutral-600" />
                          <p className="text-sm font-semibold text-neutral-900">Environments</p>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {STANDARD_ENVIRONMENTS.map((env) => {
                            const data = repo.deployments?.[env]
                            return (
                              <div key={env} className="bg-neutral-50 rounded p-4 text-center">
                                <div className="flex justify-center mb-3">
                                  {data ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <X className="w-5 h-5 text-red-400" />
                                  )}
                                </div>
                                <p className="text-sm font-medium text-neutral-700 mb-2 capitalize">{env}</p>
                                {data ? (
                                  <div>
                                    <p className="text-xs font-semibold text-neutral-900 break-words">{data.tag}</p>
                                    <p className="text-xs text-neutral-500 mt-1">{data.date}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-neutral-500">Not deployed</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Recent Deployments - Organized by Workflow Pipeline */}
                    {repo.workflowRuns && repo.workflowRuns.length > 0 && (
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
                                repo.workflowRuns.forEach((run) => {
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
                                    {ciJobs.length > 0 ? (
                                      <div className="space-y-2">
                                        {/* Pipeline Run Box */}
                                        <div className="bg-white border-2 border-blue-200 rounded p-3">
                                          <button
                                            onClick={() => setExpandedCiRuns((prev) => ({ ...prev, [repo.id]: prev[repo.id] === -1 ? null : -1 }))}
                                            className="w-full text-left flex items-center justify-between hover:bg-blue-50 p-2 rounded transition-colors -m-2 p-2"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="text-lg">
                                                {expandedCiRuns[repo.id] === -1 ? '▼' : '▶'}
                                              </div>
                                              <span className="text-xs font-semibold text-blue-700">Pipeline Run</span>
                                              {expandedCiRuns[repo.id] !== -1 && (
                                                <div className="flex items-center gap-1.5 ml-2">
                                                  {ciJobs.map((job) => (
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
                                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                                              ciJobs.some(j => j.conclusion === 'failure')
                                                ? 'bg-red-100 text-red-700'
                                                : ciJobs.some(j => !j.conclusion)
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-green-100 text-green-700'
                                            }`}>
                                              <span className="inline-block mr-1">
                                                {ciJobs.some(j => j.conclusion === 'failure') ? '❌' : ciJobs.some(j => !j.conclusion) ? '⏳' : '✅'}
                                              </span>
                                              {ciJobs.some(j => j.conclusion === 'failure') ? 'Failed' : ciJobs.some(j => !j.conclusion) ? 'Running' : 'Success'}
                                            </span>
                                          </button>
                                          
                                          {expandedCiRuns[repo.id] === -1 && (
                                            <div className="mt-3 pt-3 border-t border-blue-100 space-y-2">
                                              {ciJobs.map((job) => (
                                                <div key={job.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-blue-50 rounded transition-colors">
                                                  <div>
                                                    {job.conclusion === 'success' ? (
                                                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                    ) : job.conclusion === 'failure' ? (
                                                      <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                    ) : job.conclusion === 'skipped' ? (
                                                      <div className="w-4 h-4 rounded-full bg-gray-400 flex-shrink-0" />
                                                    ) : (
                                                      <div className="w-4 h-4 rounded-full bg-yellow-400 flex-shrink-0" />
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
                                      </div>
                                    ) : (
                                      <p className="text-xs text-neutral-500">No CI jobs yet</p>
                                    )}
                                  </>
                                )
                              })()}
                            </div>

                            {/* Last CI Run - Debug Display */}
                            {/* Pipeline Runs - Collapsible boxes like CD workflow */}
                            {(() => {
                              const ciRuns = (repo.workflowRuns || [])
                                .filter((run) => run.name?.includes('Validate') || run.name?.includes('CI'))
                                .slice(0, 5)
                              console.log('[CI BOXES DEBUG]', { repo: repo.name, totalRuns: repo.workflowRuns?.length, ciRunsFiltered: ciRuns.length, runNames: repo.workflowRuns?.map(r => r.name) })

                              return ciRuns.length > 0 ? (
                                <div className="mt-3 pt-3 border-t border-blue-200 space-y-2">
                                  {ciRuns.map((run) => {
                                    const isExpanded = expandedCiRuns[repo.id] === run.id
                                    // Get unique jobs by name - GitHub sometimes returns duplicate jobs
                                    const jobsByName: Record<string, any> = {}
                                    ;(run.jobs || []).forEach((job) => {
                                      if (!jobsByName[job.name]) {
                                        jobsByName[job.name] = job
                                      }
                                    })
                                    const runJobs = Object.values(jobsByName)
                                    console.log(`[CI JOB DEDUP] Run ${run.id}: total jobs=${run.jobs?.length}, unique jobs=${runJobs.length}`, runJobs.map((j: any) => j.name))
                                    const runStatus = runJobs.some((j: any) => j.conclusion === 'failure')
                                      ? 'failure'
                                      : runJobs.some(j => !j.conclusion)
                                      ? 'running'
                                      : 'success'

                                    return (
                                      <div key={run.id} className="bg-white border border-blue-200 rounded p-2">
                                        <button
                                          onClick={() =>
                                            setExpandedCiRuns((prev) => ({
                                              ...prev,
                                              [repo.id]: isExpanded ? null : run.id,
                                            }))
                                          }
                                          className="w-full flex items-center justify-between hover:bg-blue-50 p-1 rounded transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            <div className="text-sm leading-none">{isExpanded ? '▼' : '▶'}</div>
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
                                            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${
                                              runStatus === 'success'
                                                ? 'bg-green-100 text-green-700'
                                                : runStatus === 'failure'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                            }`}
                                          >
                                            <span>{runStatus === 'success' ? '✅' : runStatus === 'failure' ? '❌' : '⏳'}</span>
                                          </span>
                                        </button>

                                        {isExpanded && (
                                          <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
                                            {runJobs.map((job) => (
                                              <div key={job.id} className="flex items-center gap-2 py-1 px-1 text-xs">
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
                                                <span className="text-neutral-700 truncate">{job.name}</span>
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
                              const cdRuns = repo.workflowRuns
                                ?.filter((run) => run.name?.includes('CD'))
                                .slice(0, 5) || []

                              return cdRuns.length > 0 ? (
                                <div className="space-y-3">
                                  {cdRuns.map((run) => {
                                    const isExpanded = expandedCdRuns[repo.id] === run.id
                                    const versionJob = (run.jobs || []).find(j => j.name?.includes('version') || j.name === 'Create Semantic Version')
                                    const allDeployJobs = (run.jobs || []).filter((job) => 
                                      job.name.includes('deploy') || 
                                      job.name.includes('Deploy') ||
                                      ['dev', 'qat', 'prod'].some(env => job.name.toLowerCase().includes(env))
                                    )
                                    
                                    const overallStatus = allDeployJobs.some(j => j.conclusion === 'failure')
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
                                              [repo.id]: isExpanded ? null : run.id,
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
                                            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${
                                              overallStatus === 'success'
                                                ? 'bg-green-100 text-green-700'
                                                : overallStatus === 'failure'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-yellow-100 text-yellow-700'
                                            }`}
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
                  </div>
                </div>
                    ))}
                  </div>

                  {/* Manage Repos Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => router.push('/setup?manage=true')}
                      className="px-6 py-2.5 rounded-lg border border-neutral-200 text-neutral-900 font-semibold hover:bg-neutral-50 transition-colors"
                    >
                      Manage Repositories
                    </button>
                  </div>
                </>
              )
            })()}
          </>
        )}
      </div>
    </main>
  )
}
