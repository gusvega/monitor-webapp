'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, CheckCircle, ExternalLink, GitBranch, Server, Star, X } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  SectionIntro,
  Skeleton,
  Spinner,
} from '@gusvega/ui'
import {
  fetchDeployments,
  fetchTags,
  fetchWorkflowRunJobs,
  fetchWorkflowRuns,
  groupDeploymentsByEnvironment,
  STANDARD_ENVIRONMENTS,
  type WorkflowJob,
  type WorkflowRun,
} from '@/lib/github'
import { formatDeploymentVersionLabel, getLatestDeployment, getLatestRun, getLatestRunStatus, getMeaningfulDeploymentTimeline, getRepoAttentionItems, getRepoHealth, getVersionDrift, type DeploymentTimelineEntry } from '@/lib/monitor-insights'
import { toRepoSlug } from '@/lib/repo-routing'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description?: string | null
  language?: string | null
  stargazers_count?: number
  html_url?: string
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

interface JobSummaryState {
  summary: string
  source: 'ai' | 'heuristic' | 'fallback'
}

const formatDate = (dateString?: string | null) => {
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

const getRunStatus = (run: WorkflowRun, jobs: WorkflowJob[] = []) => {
  if (run.status === 'in_progress') return 'running' as const
  if (run.conclusion === 'failure') return 'failure' as const
  if (run.conclusion === 'success') return 'success' as const
  if (jobs.some((job) => job.conclusion === 'failure')) return 'failure' as const
  if (jobs.some((job) => !job.conclusion)) return 'running' as const
  return 'success' as const
}

const getFailedJobName = (jobs: WorkflowJob[] = []) =>
  jobs.find((job) => job.conclusion === 'failure')?.name || null

const getDeployEnvironmentsFromJobs = (jobs: WorkflowJob[] = []) => {
  const envs = ['dev', 'qat', 'prod'].filter((env) =>
    jobs.some((job) => job.name.toLowerCase().includes(env))
  )
  return envs
}

const getFailureTooltipText = (jobName: string, context: 'ci' | 'cd') => {
  if (context === 'ci') {
    return `Monitor summary:\n${jobName} failed during validation.\nOpen the GitHub job for the exact failing step and raw logs.`
  }

  return `Monitor summary:\n${jobName} failed during deployment or promotion.\nOpen the GitHub job for the exact failing step and raw logs.`
}

function FailureTooltip({
  text,
  onOpen,
  isLoading = false,
  children,
}: {
  text: string
  onOpen?: () => void
  isLoading?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className="group relative inline-flex min-w-0"
      onMouseEnter={onOpen}
      onFocus={onOpen}
    >
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded bg-neutral-900 px-3 py-2 text-xs leading-5 text-white shadow-lg whitespace-pre-line group-hover:block">
        {isLoading ? (
          <span className="flex items-center gap-2 whitespace-normal">
            <Spinner size="sm" className="h-3.5 w-3.5 text-white" />
            <span>Generating summary from the failed GitHub job logs...</span>
          </span>
        ) : (
          text
        )}
        <span
          className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-neutral-900"
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

function RepoPageSkeleton() {
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white">
        <div className="px-8 py-8">
          <div className="space-y-3">
            <Skeleton variant="text" width="12%" />
            <Skeleton variant="text" width="28%" height={36} />
            <Skeleton variant="text" width="42%" />
          </div>
        </div>
      </div>

      <div className="space-y-8 px-8 py-8">
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <Skeleton variant="text" width="24%" height={28} />
              <Skeleton variant="text" width="36%" />
              <Skeleton variant="text" width="70%" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <Skeleton variant="text" width="35%" />
                  <Skeleton variant="text" width="60%" className="mt-3" />
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <Skeleton variant="text" width="38%" />
                  <Skeleton variant="text" width="55%" height={28} className="mt-3" />
                  <Skeleton variant="text" width="70%" className="mt-2" />
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              {[...Array(2)].map((_, index) => (
                <div key={index} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <Skeleton variant="text" width="28%" />
                  <div className="mt-4 space-y-2">
                    <Skeleton variant="text" width="90%" />
                    <Skeleton variant="text" width="75%" />
                    <Skeleton variant="text" width="80%" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function RepoEnvironmentSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
      <div className="mb-3 flex justify-center">
        <Skeleton variant="circular" width={20} height={20} />
      </div>
      <Skeleton variant="text" width="40%" className="mx-auto" />
      <Skeleton variant="text" width="72%" className="mx-auto mt-3" />
      <Skeleton variant="text" width="48%" className="mx-auto mt-2" />
    </div>
  )
}

export default function RepoDashboardPage() {
  const params = useParams<{ repoName: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const [repos, setRepos] = useState<RepoDisplay[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deploymentLoading, setDeploymentLoading] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [expandedCiRuns, setExpandedCiRuns] = useState<Record<number, number | null>>({})
  const [expandedCdRuns, setExpandedCdRuns] = useState<Record<number, number | null>>({})
  const [jobSummaries, setJobSummaries] = useState<Record<number, JobSummaryState>>({})
  const [jobSummaryLoading, setJobSummaryLoading] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let mounted = true

    try {
      const saved = localStorage.getItem('userRepos')

      if (!saved) {
        if (mounted) {
          setRepos([])
          setIsLoading(false)
        }
        return
      }

      const repoData: GitHubRepo[] = JSON.parse(saved)
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
        setRepos(displayRepos)
        setIsLoading(false)
      }
    } catch (err) {
      if (mounted) {
        setError(err instanceof Error ? err.message : 'Failed to load repository data')
        setIsLoading(false)
      }
    }

    return () => {
      mounted = false
    }
  }, [])

  const selectedRepo = repos.find((repo) => toRepoSlug(repo.name) === params.repoName) ?? null
  const selectedRepoId = selectedRepo?.id ?? null
  const selectedRepoFullName = selectedRepo?.full_name ?? null

  const loadJobSummary = async (job: WorkflowJob, context: 'ci' | 'cd') => {
    if (!selectedRepoFullName || jobSummaries[job.id] || jobSummaryLoading[job.id]) return

    setJobSummaryLoading((prev) => ({ ...prev, [job.id]: true }))

    try {
      const response = await fetch(
        `/api/workflows/job-summary?repoFullName=${encodeURIComponent(selectedRepoFullName)}&jobId=${job.id}&context=${context}`
      )

      if (!response.ok) {
        throw new Error(`Failed to load job summary: ${response.status}`)
      }

      const data = await response.json()
      setJobSummaries((prev) => ({
        ...prev,
        [job.id]: {
          summary:
            data.summary ||
            getFailureTooltipText(job.name, context),
          source: data.source || 'fallback',
        },
      }))
    } catch (summaryError) {
      console.error('[REPO DASHBOARD] Failed to load job summary', summaryError)
      setJobSummaries((prev) => ({
        ...prev,
        [job.id]: {
          summary: getFailureTooltipText(job.name, context),
          source: 'fallback',
        },
      }))
    } finally {
      setJobSummaryLoading((prev) => ({ ...prev, [job.id]: false }))
    }
  }

  const getJobTooltipText = (job: WorkflowJob, context: 'ci' | 'cd') => {
    if (jobSummaryLoading[job.id]) {
      return 'Monitor is reading the failed GitHub job logs...'
    }

    const summary = jobSummaries[job.id]
    if (!summary) {
      return 'Hover to load a short Monitor summary from the failed GitHub job logs.'
    }

    const sourceLabel =
      summary.source === 'ai'
        ? 'AI summary'
        : summary.source === 'heuristic'
          ? 'Monitor summary'
          : 'Fallback summary'

    return `${sourceLabel}:\n${summary.summary}`
  }

  useEffect(() => {
    if (!selectedRepoId) return

    localStorage.setItem('selectedRepoId', selectedRepoId.toString())
    window.dispatchEvent(new CustomEvent('repoSelected', { detail: { repoId: selectedRepoId } }))
  }, [selectedRepoId])

  useEffect(() => {
    const accessToken = (session as any)?.accessToken
    if (!accessToken || !selectedRepoId || !selectedRepoFullName) return

    setDeploymentLoading((prev) =>
      prev[selectedRepoId] ? prev : { ...prev, [selectedRepoId]: true }
    )

    Promise.all([
      fetchDeployments(selectedRepoFullName, accessToken),
      fetchWorkflowRuns(selectedRepoFullName, accessToken),
      fetchTags(selectedRepoFullName, accessToken),
    ])
      .then(async ([deployments, workflowRuns, tags]) => {
        const grouped = groupDeploymentsByEnvironment(deployments)
        const shaToTag: Record<string, string> = {}

        tags.forEach((tag: { name: string; commit: { sha: string } }) => {
          shaToTag[tag.commit.sha] = tag.name
        })
        const deploymentTimeline: DeploymentTimelineEntry[] = deployments
          .slice()
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 12)
          .map((deployment) => ({
            id: deployment.id,
            environment: deployment.environment,
            tag: shaToTag[deployment.sha] || deployment.ref.replace('refs/tags/', '').replace('refs/heads/', ''),
            date: formatDate(deployment.updated_at),
            state: deployment.state,
          }))

        const deploymentData: Record<string, { tag: string; date: string } | null> = {}

        for (const env of STANDARD_ENVIRONMENTS) {
          if (grouped[env]) {
            const deployment = grouped[env]
            deploymentData[env] = {
              tag: shaToTag[deployment.sha] || deployment.ref.replace('refs/tags/', '').replace('refs/heads/', ''),
              date: formatDate(deployment.updated_at),
            }
          } else {
            deploymentData[env] = null
          }
        }

        const jobsArray = await Promise.all(
          workflowRuns.map((run) => fetchWorkflowRunJobs(selectedRepoFullName, run.id, accessToken))
        )

        const runsWithJobs = workflowRuns.map((run, index) => ({
          ...run,
          jobs: jobsArray[index],
        }))

        setRepos((prev) =>
          prev.map((repo) =>
            repo.id === selectedRepoId
              ? { ...repo, deployments: deploymentData, deploymentTimeline, workflowRuns: runsWithJobs }
              : repo
          )
        )
      })
      .catch((err) => {
        console.error('[REPO DASHBOARD] Failed to load repo data', err)
        setError(err instanceof Error ? err.message : 'Failed to load repository details')
      })
      .finally(() => {
        setDeploymentLoading((prev) => ({ ...prev, [selectedRepoId]: false }))
      })
  }, [selectedRepoFullName, selectedRepoId, session])

  useEffect(() => {
    const accessToken = (session as any)?.accessToken
    if (!accessToken || !selectedRepoId || !selectedRepoFullName) return

    const pollInterval = setInterval(async () => {
      try {
        const workflowRuns = await fetchWorkflowRuns(selectedRepoFullName, accessToken)
        const jobsArray = await Promise.all(
          workflowRuns.map((run) => fetchWorkflowRunJobs(selectedRepoFullName, run.id, accessToken))
        )

        const runsWithJobs = workflowRuns.map((run, index) => ({
          ...run,
          jobs: jobsArray[index],
        }))

        setRepos((prev) =>
          prev.map((repo) => (repo.id === selectedRepoId ? { ...repo, workflowRuns: runsWithJobs } : repo))
        )
      } catch (err) {
        console.error('[REPO DASHBOARD] Failed to poll workflow runs', err)
      }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [selectedRepoFullName, selectedRepoId, session])

  if (isLoading) {
    return <RepoPageSkeleton />
  }

  if (error) {
    return (
      <main className="min-h-screen bg-neutral-50 px-8 py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-600" />
            <div className="mx-auto max-w-xl">
              <Alert title="Error loading repository">{error}</Alert>
            </div>
            <div className="mt-6">
              <Button onClick={() => router.push('/dashboard')}>Back to Overview</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!selectedRepo) {
    return (
      <main className="min-h-screen bg-neutral-50 px-8 py-8">
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={<GitBranch className="h-10 w-10 text-neutral-300" />}
              title="Repository not found"
              description="This repository is not in your current Monitor selection."
              action={
                <Button onClick={() => router.push('/dashboard')}>Back to Overview</Button>
              }
            />
          </CardContent>
        </Card>
      </main>
    )
  }

  const ciRuns = (selectedRepo.workflowRuns || []).filter(isCiWorkflowRun).slice(0, 5)
  const cdRuns = (selectedRepo.workflowRuns || []).filter(isCdWorkflowRun).slice(0, 5)
  const health = getRepoHealth(selectedRepo, isCiWorkflowRun, isCdWorkflowRun)
  const attentionItems = getRepoAttentionItems(selectedRepo, isCiWorkflowRun, isCdWorkflowRun)
  const versionDrift = getVersionDrift(selectedRepo)
  const latestDeployment = getLatestDeployment(selectedRepo)
  const latestCi = ciRuns[0] || null
  const latestCd = cdRuns[0] || null
  const meaningfulTimeline = getMeaningfulDeploymentTimeline(selectedRepo.deploymentTimeline)
  const latestCiStatus = latestCi ? getRunStatus(latestCi, latestCi.jobs || []) : null
  const latestCdStatus = latestCd ? getRunStatus(latestCd, latestCd.jobs || []) : null
  const ciSuccessCount = ciRuns.filter((run) => getRunStatus(run, run.jobs || []) === 'success').length
  const latestCdVersion = latestDeployment ? formatDeploymentVersionLabel(latestDeployment.tag) : null

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="border-b border-neutral-200 bg-white">
        <div className="px-8 py-8">
          <SectionIntro eyebrow="Repository" title={selectedRepo.name} smaller className="px-0">
            <p className="text-neutral-600">
              Focused deployment and workflow status for <span className="font-medium text-neutral-900">{selectedRepo.full_name}</span>.
            </p>
          </SectionIntro>
        </div>
      </div>

      <div className="space-y-8 px-8 py-8">
        <div className="overflow-hidden">
          <Card className="transition-colors hover:border-neutral-300">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="truncate text-xl font-bold text-neutral-900">{selectedRepo.name}</h2>
                    <a
                      href={selectedRepo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-neutral-400 transition-colors hover:text-neutral-600"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <p className="truncate text-sm text-neutral-600">{selectedRepo.full_name}</p>
                </div>
                {selectedRepo.stars !== '0' && selectedRepo.stars !== 'N/A' && (
                  <div className="ml-4 flex flex-shrink-0 items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-600 text-amber-600" />
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      {selectedRepo.stars} stars
                    </Badge>
                  </div>
                )}
              </div>

              {selectedRepo.description !== 'N/A' && (
                <p className="mb-4 line-clamp-2 text-sm text-neutral-600">{selectedRepo.description}</p>
              )}

              <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">Language</p>
                  <p className="font-medium text-neutral-900">{selectedRepo.language}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">Last Updated</p>
                  <p className="font-medium text-neutral-900">{selectedRepo.lastUpdated}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">Route</p>
                  <p className="truncate font-medium text-neutral-900">/dashboard/{toRepoSlug(selectedRepo.name)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Health</p>
                  <p className="mt-2 text-lg font-bold text-neutral-900">{health.label}</p>
                  <p className="mt-1 text-sm text-neutral-600">{health.summary}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Current Prod</p>
                  <p className="mt-2 text-lg font-bold text-neutral-900">{selectedRepo.deployments?.prod?.tag || 'Not deployed'}</p>
                  <p className="mt-1 text-sm text-neutral-600">{selectedRepo.deployments?.prod?.date || 'No production deployment yet'}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Latest CI</p>
                  <p className="mt-2 text-lg font-bold text-neutral-900">{latestCi ? getLatestRunStatus(latestCi) : 'No data'}</p>
                  <p className="mt-1 text-sm text-neutral-600">{latestCi ? formatDate(latestCi.created_at) : 'No CI run found'}</p>
                </div>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Latest CD</p>
                  <p className="mt-2 text-lg font-bold text-neutral-900">{latestCd ? getLatestRunStatus(latestCd) : 'No data'}</p>
                  <p className="mt-1 text-sm text-neutral-600">{latestDeployment ? `${latestDeployment.environment} · ${latestDeployment.date}` : 'No deployment activity yet'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <p className="text-base font-semibold text-neutral-900">Attention Needed</p>
                  </div>
                  {attentionItems.length === 0 ? (
                    <p className="text-sm text-neutral-600">No urgent issues detected for this repository.</p>
                  ) : (
                    <div className="space-y-2">
                      {attentionItems.map((item) => (
                        <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-sm text-neutral-800">{item}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-neutral-700" />
                    <p className="text-base font-semibold text-neutral-900">Environment Drift</p>
                  </div>
                  <p className="mb-4 text-sm text-neutral-600">{versionDrift.summary}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {['dev', 'qat', 'prod'].map((env) => (
                      <div key={env} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{env}</p>
                        <p className="mt-2 text-sm font-semibold text-neutral-900">{selectedRepo.deployments?.[env]?.tag || 'Not deployed'}</p>
                        <p className="mt-1 text-xs text-neutral-500">{selectedRepo.deployments?.[env]?.date || 'No deployment recorded'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-neutral-100 p-2">
                      <Server className="h-4 w-4 text-neutral-700" />
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
                      <RepoEnvironmentSkeleton key={env} />
                    ))}
                  </div>
                ) : selectedRepo.deployments ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {STANDARD_ENVIRONMENTS.map((env) => {
                      const data = selectedRepo.deployments?.[env]
                      return (
                        <div key={env} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center">
                          <div className="mb-3 flex justify-center">
                            {data ? <CheckCircle className="h-5 w-5 text-green-600" /> : <X className="h-5 w-5 text-red-400" />}
                          </div>
                          <p className="mb-2 text-sm font-medium capitalize text-neutral-700">{env}</p>
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

              {selectedRepo.workflowRuns && selectedRepo.workflowRuns.length > 0 && (
                <div className="mt-4 border-t border-neutral-200 pt-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Server className="h-4 w-4 text-neutral-600" />
                    <p className="text-sm font-semibold text-neutral-900">Recent Deployments</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 lg:col-span-1">
                      <p className="mb-3 text-sm font-bold text-blue-900">CI Workflow</p>
                      <div className="mb-4 rounded-lg border border-blue-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Latest CI Status</p>
                        <p className="mt-1 text-sm font-semibold text-neutral-900">
                          {latestCi
                            ? latestCiStatus === 'success'
                              ? 'Validation is passing'
                              : latestCiStatus === 'failure'
                                ? 'Validation needs attention'
                                : 'Validation is running'
                            : 'No CI runs yet'}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          {latestCi
                            ? `${formatDate(latestCi.created_at)} · ${ciSuccessCount}/${ciRuns.length || 1} recent runs passed`
                            : 'Recent workflow activity will appear here'}
                        </p>
                      </div>
                      {ciRuns.length > 0 ? (
                        <div className="space-y-3">
                          {ciRuns.map((run) => {
                            const isExpanded = expandedCiRuns[selectedRepo.id] === run.id
                            const jobsByName: Record<string, WorkflowJob> = {}

                            ;(run.jobs || []).forEach((job) => {
                              if (!jobsByName[job.name]) jobsByName[job.name] = job
                            })

                            const runJobs = Object.values(jobsByName)
                            const runStatus = getRunStatus(run, runJobs)
                            const failedJobName = getFailedJobName(runJobs)

                            return (
                              <div key={run.id} className="rounded-lg border border-blue-200 bg-white p-4">
                                <button
                                  onClick={() =>
                                    setExpandedCiRuns((prev) => ({
                                      ...prev,
                                      [selectedRepo.id]: isExpanded ? null : run.id,
                                    }))
                                  }
                                  className="w-full rounded p-2 text-left transition-colors hover:bg-blue-50"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex items-start gap-2">
                                      <div className="pt-0.5 text-lg leading-none">{isExpanded ? '▼' : '▶'}</div>
                                      <div className="min-w-0">
                                        {runStatus === 'failure' ? (
                                          <FailureTooltip
                                            text={
                                              failedJobName
                                                ? getJobTooltipText(
                                                    runJobs.find((job) => job.name === failedJobName && job.conclusion === 'failure') || {
                                                      id: run.id,
                                                      name: failedJobName,
                                                      status: 'completed',
                                                      conclusion: 'failure',
                                                      created_at: run.created_at,
                                                      completed_at: run.updated_at,
                                                    },
                                                    'ci'
                                                  )
                                                : getFailureTooltipText('Validation job', 'ci')
                                            }
                                            isLoading={Boolean(
                                              failedJobName &&
                                                runJobs.find((job) => job.name === failedJobName && job.conclusion === 'failure') &&
                                                jobSummaryLoading[
                                                  (
                                                    runJobs.find((job) => job.name === failedJobName && job.conclusion === 'failure') as WorkflowJob
                                                  ).id
                                                ]
                                            )}
                                            onOpen={() => {
                                              const failedJob = runJobs.find((job) => job.name === failedJobName && job.conclusion === 'failure')
                                              if (failedJob) void loadJobSummary(failedJob, 'ci')
                                            }}
                                          >
                                            <p className="truncate text-sm font-semibold text-neutral-900">
                                              {`Validation failed${failedJobName ? ` in ${failedJobName}` : ''}`}
                                            </p>
                                          </FailureTooltip>
                                        ) : (
                                          <p className="truncate text-sm font-semibold text-neutral-900">
                                            {runStatus === 'success'
                                              ? `Commit ${run.head_branch || 'default'} passed validation`
                                              : 'Validation is currently running'}
                                          </p>
                                        )}
                                        <p className="mt-1 text-xs text-neutral-500">
                                          {formatDate(run.created_at)} · {runJobs.length} jobs checked
                                        </p>
                                      </div>
                                    </div>
                                    <span className={`inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getRunStatusClasses(runStatus)}`}>
                                      {runStatus === 'success' ? 'Success' : runStatus === 'failure' ? 'Failed' : 'Running'}
                                    </span>
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="mt-4 border-t border-blue-100 pt-4">
                                    {runJobs.map((job) => (
                                      <div key={job.id} className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-blue-50">
                                        {job.conclusion === 'success' ? (
                                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-600" />
                                        ) : job.conclusion === 'failure' ? (
                                          <X className="h-3 w-3 flex-shrink-0 text-red-500" />
                                        ) : job.conclusion === 'skipped' ? (
                                          <div className="h-3 w-3 flex-shrink-0 rounded-full bg-gray-400" />
                                        ) : (
                                          <div className="h-3 w-3 flex-shrink-0 rounded-full bg-yellow-400" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-2">
                                            {job.conclusion === 'failure' ? (
                                              <FailureTooltip
                                                text={getJobTooltipText(job, 'ci')}
                                                isLoading={Boolean(jobSummaryLoading[job.id])}
                                                onOpen={() => void loadJobSummary(job, 'ci')}
                                              >
                                                <p className="text-xs font-semibold text-neutral-700">{job.name}</p>
                                              </FailureTooltip>
                                            ) : (
                                              <p className="text-xs font-semibold text-neutral-700">{job.name}</p>
                                            )}
                                            {job.html_url && (
                                              <a
                                                href={job.html_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-neutral-400 transition-colors hover:text-neutral-700"
                                                title="Open job in GitHub"
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">No CI jobs yet</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 lg:col-span-3">
                      <p className="mb-3 text-sm font-bold text-green-900">Release Activity</p>
                      <div className="mb-4 rounded-lg border border-green-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Latest Deployment Status</p>
                        <p className="mt-1 text-sm font-semibold text-neutral-900">
                          {latestCd
                            ? latestCdStatus === 'success'
                              ? 'Latest release completed successfully'
                              : latestCdStatus === 'failure'
                                ? 'Latest release needs attention'
                                : 'A release is currently running'
                            : 'No release activity yet'}
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          {latestCd && latestCdVersion
                            ? `${latestCdVersion.primary} · ${formatDate(latestCd.created_at)}`
                            : 'Recent release activity will appear here'}
                        </p>
                      </div>
                      {cdRuns.length > 0 ? (
                        <div className="space-y-3">
                          {cdRuns.map((run) => {
                            const isExpanded = expandedCdRuns[selectedRepo.id] === run.id
                            const versionJob = (run.jobs || []).find((job) => job.name?.includes('version') || job.name === 'Create Semantic Version')
                            const allDeployJobs = (run.jobs || []).filter(
                              (job) =>
                                job.name.includes('deploy') ||
                                job.name.includes('Deploy') ||
                                ['dev', 'qat', 'prod'].some((env) => job.name.toLowerCase().includes(env))
                            )

                            const overallStatus = getRunStatus(run, allDeployJobs)
                            const failedDeployJob = getFailedJobName(allDeployJobs)
                            const deployEnvironments = getDeployEnvironmentsFromJobs(allDeployJobs)
                            const versionLabel = formatDeploymentVersionLabel(
                              selectedRepo.deploymentTimeline?.find((entry) => formatDate(run.created_at) === entry.date)?.tag ||
                              versionJob?.name ||
                              ''
                            )

                            return (
                              <div key={run.id} className="rounded-lg border border-green-200 bg-white p-4">
                                <button
                                  onClick={() =>
                                    setExpandedCdRuns((prev) => ({
                                      ...prev,
                                      [selectedRepo.id]: isExpanded ? null : run.id,
                                    }))
                                  }
                                  className="w-full rounded p-2 text-left transition-colors hover:bg-green-50"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex items-start gap-2">
                                      <div className="pt-0.5 text-lg leading-none">{isExpanded ? '▼' : '▶'}</div>
                                      <div className="min-w-0">
                                        {overallStatus === 'failure' ? (
                                          <FailureTooltip
                                            text={
                                              failedDeployJob
                                                ? getJobTooltipText(
                                                    allDeployJobs.find((job) => job.name === failedDeployJob && job.conclusion === 'failure') || {
                                                      id: run.id,
                                                      name: failedDeployJob,
                                                      status: 'completed',
                                                      conclusion: 'failure',
                                                      created_at: run.created_at,
                                                      completed_at: run.updated_at,
                                                    },
                                                    'cd'
                                                  )
                                                : getFailureTooltipText('Deployment step', 'cd')
                                            }
                                            isLoading={Boolean(
                                              failedDeployJob &&
                                                allDeployJobs.find((job) => job.name === failedDeployJob && job.conclusion === 'failure') &&
                                                jobSummaryLoading[
                                                  (
                                                    allDeployJobs.find((job) => job.name === failedDeployJob && job.conclusion === 'failure') as WorkflowJob
                                                  ).id
                                                ]
                                            )}
                                            onOpen={() => {
                                              const failedJob = allDeployJobs.find((job) => job.name === failedDeployJob && job.conclusion === 'failure')
                                              if (failedJob) void loadJobSummary(failedJob, 'cd')
                                            }}
                                          >
                                            <p className="truncate text-sm font-semibold text-neutral-900">
                                              {`${versionLabel.primary} failed${failedDeployJob ? ` at ${failedDeployJob}` : ''}`}
                                            </p>
                                          </FailureTooltip>
                                        ) : (
                                          <p className="truncate text-sm font-semibold text-neutral-900">
                                            {overallStatus === 'success'
                                              ? `${versionLabel.primary} deployed${deployEnvironments.length ? ` to ${deployEnvironments.join(', ')}` : ''}`
                                              : `${versionLabel.primary} is deploying`}
                                          </p>
                                        )}
                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                          <span className="text-xs text-neutral-500">{formatDate(run.created_at)}</span>
                                          {deployEnvironments.map((env) => (
                                            <span
                                              key={`${run.id}-${env}`}
                                              className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700"
                                            >
                                              {env}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <span className={`inline-flex w-fit items-center gap-1 rounded px-2 py-1 text-xs font-medium ${getRunStatusClasses(overallStatus)}`}>
                                      {overallStatus === 'success' ? 'Success' : overallStatus === 'failure' ? 'Failed' : 'Running'}
                                    </span>
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="mt-4 border-t border-green-100 pt-4">
                                    {versionJob && (
                                      <div className="mb-4">
                                        <p className="mb-2 text-xs font-semibold text-neutral-700">Version</p>
                                      <div className="flex items-center gap-2 rounded bg-green-50 px-2 py-1.5 transition-colors hover:bg-green-100">
                                          {versionJob.conclusion === 'success' ? (
                                            <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
                                          ) : versionJob.conclusion === 'failure' ? (
                                            <X className="h-4 w-4 flex-shrink-0 text-red-500" />
                                          ) : versionJob.conclusion === 'skipped' ? (
                                            <div className="h-4 w-4 flex-shrink-0 rounded-full bg-gray-400" />
                                          ) : (
                                            <div className="h-4 w-4 flex-shrink-0 rounded-full bg-yellow-400" />
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                              {versionJob.conclusion === 'failure' ? (
                                                <FailureTooltip
                                                  text={getJobTooltipText(versionJob, 'cd')}
                                                  isLoading={Boolean(jobSummaryLoading[versionJob.id])}
                                                  onOpen={() => void loadJobSummary(versionJob, 'cd')}
                                                >
                                                  <p className="text-xs font-semibold text-neutral-700">{versionJob.name}</p>
                                                </FailureTooltip>
                                              ) : (
                                                <p className="text-xs font-semibold text-neutral-700">{versionJob.name}</p>
                                              )}
                                              {versionJob.html_url && (
                                                <a
                                                  href={versionJob.html_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-neutral-400 transition-colors hover:text-neutral-700"
                                                  title="Open job in GitHub"
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                </a>
                                              )}
                                            </div>
                                            <p className="text-xs text-neutral-500">{formatDate(versionJob.completed_at)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                      {['dev', 'qat', 'prod'].map((env) => {
                                        const envJobs = allDeployJobs.filter((job) => {
                                          if (env === 'dev') return job.name.includes('dev') || job.name === 'Deploy to Dev'
                                          if (env === 'qat') return job.name.includes('qat') || job.name === 'Deploy to QAT'
                                          if (env === 'prod') return job.name.includes('prod') || job.name === 'Deploy to Prod'
                                          return false
                                        })

                                        return (
                                          <div key={env} className="rounded border border-neutral-200 bg-neutral-50 p-3">
                                            <p className="mb-2 text-xs font-semibold capitalize text-neutral-700">{env}</p>
                                            {envJobs.length > 0 ? (
                                              <div className="space-y-1">
                                                {envJobs.map((job) => (
                                                  <div key={job.id} className="flex items-center gap-2">
                                                    {job.conclusion === 'success' ? (
                                                      <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-600" />
                                                    ) : job.conclusion === 'failure' ? (
                                                      <X className="h-3 w-3 flex-shrink-0 text-red-500" />
                                                    ) : job.conclusion === 'skipped' ? (
                                                      <div className="h-3 w-3 flex-shrink-0 rounded-full bg-gray-400" />
                                                    ) : (
                                                      <div className="h-3 w-3 flex-shrink-0 rounded-full bg-yellow-400" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-center justify-between gap-2">
                                                        {job.conclusion === 'failure' ? (
                                                          <FailureTooltip
                                                            text={getJobTooltipText(job, 'cd')}
                                                            isLoading={Boolean(jobSummaryLoading[job.id])}
                                                            onOpen={() => void loadJobSummary(job, 'cd')}
                                                          >
                                                            <p className="truncate text-xs text-neutral-700">{job.name}</p>
                                                          </FailureTooltip>
                                                        ) : (
                                                          <p className="truncate text-xs text-neutral-700">{job.name}</p>
                                                        )}
                                                        {job.html_url && (
                                                          <a
                                                            href={job.html_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-neutral-400 transition-colors hover:text-neutral-700"
                                                            title="Open job in GitHub"
                                                          >
                                                            <ExternalLink className="h-3 w-3" />
                                                          </a>
                                                        )}
                                                      </div>
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
                      )}
                    </div>
                  </div>
                </div>
              )}

              {meaningfulTimeline.length > 0 && (
                <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Server className="h-4 w-4 text-neutral-700" />
                    <p className="text-base font-semibold text-neutral-900">Release Activity</p>
                  </div>
                  <div className="space-y-3">
                    {meaningfulTimeline.map((entry) => {
                      const versionLabel = formatDeploymentVersionLabel(entry.tag)

                      return (
                        <div key={entry.id} className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{entry.environment}</Badge>
                              <p className="truncate text-sm font-semibold text-neutral-900">{versionLabel.primary}</p>
                            </div>
                            <p className="mt-1 text-xs text-neutral-500">{versionLabel.secondary}</p>
                            <p className="mt-1 text-xs text-neutral-500">{entry.date}</p>
                          </div>
                          <Badge variant={entry.state === 'success' ? 'secondary' : 'outline'}>{entry.state}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </main>
  )
}
