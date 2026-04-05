import type { WorkflowRun } from '@/lib/github'

export interface EnvironmentDeployment {
  tag: string
  date: string
}

export interface DeploymentTimelineEntry {
  id: number
  environment: string
  tag: string
  date: string
  state: string
}

export interface RepoInsightShape {
  deployments?: Record<string, EnvironmentDeployment | null>
  workflowRuns?: WorkflowRun[]
  deploymentTimeline?: DeploymentTimelineEntry[]
}

export function getLatestRunStatus(run?: WorkflowRun | null) {
  if (!run) return 'unknown'
  if (run.status === 'in_progress') return 'running'
  if (run.conclusion === 'failure') return 'failure'
  if (run.conclusion === 'success') return 'success'
  return 'unknown'
}

export function getLatestRun(
  runs: WorkflowRun[] = [],
  predicate?: (run: WorkflowRun) => boolean
) {
  const filtered = predicate ? runs.filter(predicate) : runs
  return [...filtered].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

export function getVersionDrift(repo: RepoInsightShape) {
  const envOrder = ['dev', 'qat', 'prod']
  const tags = envOrder
    .map((env) => ({ env, tag: repo.deployments?.[env]?.tag || null }))
    .filter((item) => item.tag)

  const uniqueTags = [...new Set(tags.map((item) => item.tag))]

  if (uniqueTags.length <= 1) {
    return {
      status: 'aligned' as const,
      summary: uniqueTags[0] ? `All environments aligned on ${uniqueTags[0]}` : 'No deployment versions available',
    }
  }

  const prod = repo.deployments?.prod?.tag || null
  const qat = repo.deployments?.qat?.tag || null
  const dev = repo.deployments?.dev?.tag || null

  if (!prod) {
    return {
      status: 'warning' as const,
      summary: 'Production is not deployed yet',
    }
  }

  if (qat && prod !== qat) {
    return {
      status: 'warning' as const,
      summary: `Production (${prod}) is behind QAT (${qat})`,
    }
  }

  if (dev && prod !== dev) {
    return {
      status: 'warning' as const,
      summary: `Production (${prod}) differs from Dev (${dev})`,
    }
  }

  return {
    status: 'warning' as const,
    summary: `Environment versions differ: ${uniqueTags.join(', ')}`,
  }
}

export function getRepoAttentionItems(
  repo: RepoInsightShape,
  isCiWorkflowRun: (run: WorkflowRun) => boolean,
  isCdWorkflowRun: (run: WorkflowRun) => boolean
) {
  const items: string[] = []
  const latestCd = getLatestRun(repo.workflowRuns, isCdWorkflowRun)
  const latestCi = getLatestRun(repo.workflowRuns, isCiWorkflowRun)
  const drift = getVersionDrift(repo)

  if (!repo.deployments?.prod) items.push('Production has no recorded deployment')
  if (getLatestRunStatus(latestCd) === 'failure') items.push('Latest CD workflow failed')
  if (getLatestRunStatus(latestCi) === 'failure') items.push('Latest CI workflow failed')
  if (drift.status !== 'aligned' && repo.deployments?.prod) items.push(drift.summary)
  if (!repo.deploymentTimeline?.length) items.push('No deployment timeline available yet')

  return items
}

export function getRepoHealth(
  repo: RepoInsightShape,
  isCiWorkflowRun: (run: WorkflowRun) => boolean,
  isCdWorkflowRun: (run: WorkflowRun) => boolean
) {
  const attention = getRepoAttentionItems(repo, isCiWorkflowRun, isCdWorkflowRun)
  const latestCd = getLatestRun(repo.workflowRuns, isCdWorkflowRun)

  if (attention.some((item) => item.includes('failed'))) {
    return {
      tone: 'critical' as const,
      label: 'Needs attention',
      summary: attention[0],
    }
  }

  if (!repo.deployments?.prod) {
    return {
      tone: 'warning' as const,
      label: 'Partial coverage',
      summary: 'Production is not deployed yet',
    }
  }

  if (getLatestRunStatus(latestCd) === 'running') {
    return {
      tone: 'warning' as const,
      label: 'Deployment in progress',
      summary: 'Latest CD workflow is still running',
    }
  }

  return {
    tone: 'healthy' as const,
    label: 'Healthy',
    summary: 'Deployments and workflows look stable',
  }
}

export function getLatestDeployment(repo: RepoInsightShape) {
  return repo.deploymentTimeline?.[0] || null
}

export function formatDeploymentVersionLabel(version?: string | null) {
  if (!version) {
    return {
      primary: 'Unknown version',
      secondary: 'No release tag found',
      kind: 'unknown' as const,
    }
  }

  const normalized = version.trim()
  const isSha = /^[a-f0-9]{40}$/i.test(normalized)

  if (isSha) {
    return {
      primary: `Commit ${normalized.slice(0, 7)}`,
      secondary: 'Deployed from an untagged commit',
      kind: 'commit' as const,
    }
  }

  return {
    primary: normalized,
    secondary: normalized.startsWith('v') ? 'Tagged release' : 'Deployment version',
    kind: 'tag' as const,
  }
}

export function getMeaningfulDeploymentTimeline(entries: DeploymentTimelineEntry[] = []) {
  const deduped = entries.filter((entry, index, source) => {
    const prior = source[index - 1]
    if (!prior) return true
    return !(
      prior.environment === entry.environment &&
      prior.tag === entry.tag &&
      prior.state === entry.state
    )
  })

  const hasTaggedRelease = deduped.some((entry) => formatDeploymentVersionLabel(entry.tag).kind === 'tag')
  const uniqueEnvironments = new Set(deduped.map((entry) => entry.environment.toLowerCase()))

  if (!hasTaggedRelease && uniqueEnvironments.size <= 1) {
    return []
  }

  return deduped.slice(0, 8)
}
