export interface GitHubDeployment {
  id: number
  environment: string
  ref: string
  sha: string
  state: string
  created_at: string
  updated_at: string
}

export interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string
}

export interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  updated_at: string
  head_branch: string
  event: string
}

export interface WorkflowJob {
  id: number
  name: string
  status: string
  conclusion: string | null
  created_at: string
  completed_at: string | null
  html_url?: string
}

export interface WorkflowRunWithJobs extends WorkflowRun {
  jobs?: WorkflowJob[]
}

export const STANDARD_ENVIRONMENTS = ['test', 'dev', 'qat', 'prod']

export async function fetchDeployments(
  repoFullName: string,
  accessToken: string
): Promise<GitHubDeployment[]> {
  try {
    console.log('[GITHUB] Fetching deployments for', repoFullName)
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/deployments?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`[GITHUB] Failed to fetch deployments for ${repoFullName}:`, response.status)
      return []
    }

    const deployments = await response.json()
    console.log('[GITHUB] Fetched', deployments?.length || 0, 'deployments for', repoFullName)
    if (deployments && deployments.length > 0) {
      console.log('[GITHUB] Deployment details:', deployments.map((d: any) => ({
        id: d.id,
        environment: d.environment,
        ref: d.ref,
        state: d.state,
        created_at: d.created_at,
      })))
    }
    return deployments || []
  } catch (err) {
    console.error(`[GITHUB] Error fetching deployments for ${repoFullName}:`, err)
    return []
  }
}

export async function fetchReleases(
  repoFullName: string,
  accessToken: string
): Promise<GitHubRelease[]> {
  try {
    console.log('[GITHUB] Fetching releases for', repoFullName)
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/releases?per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`[GITHUB] Failed to fetch releases for ${repoFullName}:`, response.status)
      return []
    }

    const releases = await response.json()
    console.log('[GITHUB] Fetched', releases?.length || 0, 'releases for', repoFullName)
    return releases || []
  } catch (err) {
    console.error(`[GITHUB] Error fetching releases for ${repoFullName}:`, err)
    return []
  }
}

export function groupDeploymentsByEnvironment(deployments: GitHubDeployment[]) {
  const grouped: Record<string, GitHubDeployment> = {}
  
  console.log('[GITHUB] Grouping', deployments.length, 'deployments by environment')
  
  // Map environment names to standard environments
  const normalizeEnvironment = (env: string): string => {
    if (env.startsWith('test-pr-')) return 'test'
    return env
  }
  
  // Get the most recent deployment for each environment
  for (const deployment of deployments) {
    const normalizedEnv = normalizeEnvironment(deployment.environment)
    
    console.log('[GITHUB] Processing deployment:', {
      id: deployment.id,
      environment: deployment.environment,
      normalizedEnv: normalizedEnv,
      state: deployment.state,
      ref: deployment.ref,
    })
    
    // Accept any state - we'll show what we have
    // For PR environments, keep the most recent one regardless
    if (!grouped[normalizedEnv] || 
        new Date(deployment.updated_at) > new Date(grouped[normalizedEnv].updated_at)) {
      grouped[normalizedEnv] = deployment
      console.log('[GITHUB] Updated environment', normalizedEnv, 'with deployment', deployment.id)
    }
  }
  
  console.log('[GITHUB] Grouped deployments:', Object.keys(grouped))
  return grouped
}

export async function fetchTags(
  repoFullName: string,
  accessToken: string
): Promise<Array<{ name: string; commit: { sha: string } }>> {
  try {
    console.log('[GITHUB] Fetching tags for', repoFullName)
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/tags?per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`[GITHUB] Failed to fetch tags for ${repoFullName}:`, response.status)
      return []
    }

    const tags = await response.json()
    console.log('[GITHUB] Fetched', tags?.length || 0, 'tags for', repoFullName)
    return tags || []
  } catch (err) {
    console.error(`[GITHUB] Error fetching tags for ${repoFullName}:`, err)
    return []
  }
}

export async function fetchWorkflowRuns(
  repoFullName: string,
  accessToken: string
): Promise<WorkflowRun[]> {
  try {
    console.log('[GITHUB] Fetching workflow runs for', repoFullName)
    
    // Fetch all workflow runs without filtering by event type
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/actions/runs?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`[GITHUB] Failed to fetch workflow runs for ${repoFullName}`)
      return []
    }

    const data = await response.json()
    const allRuns = data.workflow_runs || []
    
    console.log('[GITHUB] Fetched total runs:', allRuns.length)
    console.log('[GITHUB] All runs:', allRuns.map((r: any) => ({ 
      name: r.name, 
      event: r.event,
      status: r.status
    })))
    
    // Filter for our three workflows by name
    const filteredRuns = allRuns.filter((run: any) => 
      run.name?.includes('CI') || 
      run.name?.includes('CD') || 
      run.name?.includes('Rollback') ||
      run.name?.includes('rollback') ||
      run.name?.includes('Validate') ||
      run.name?.includes('Promote')
    )
    
    // Sort newest-first and return the full filtered window from GitHub.
    // The dashboard applies per-pipeline limits so CI activity does not crowd out CD runs.
    filteredRuns.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    console.log('[GITHUB] Total runs after combining:', filteredRuns.length)
    console.log('[GITHUB] CI runs in results:', filteredRuns.filter((r: any) => r.event === 'pull_request').length)
    console.log('[GITHUB] CD runs in results:', filteredRuns.filter((r: any) => r.event === 'push').length)
    
    return filteredRuns
  } catch (err) {
    console.error(`[GITHUB] Error fetching workflow runs for ${repoFullName}:`, err)
    return []
  }
}

export async function fetchWorkflowRunJobs(
  repoFullName: string,
  runId: number,
  accessToken: string
): Promise<WorkflowJob[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/actions/runs/${runId}/jobs`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`[GITHUB] Failed to fetch jobs for run ${runId}:`, response.status)
      return []
    }

    const data = await response.json()
    const jobs = data.jobs || []
    console.log('[GITHUB] Fetched', jobs.length, 'jobs for run', runId)
    return jobs
  } catch (err) {
    console.error(`[GITHUB] Error fetching jobs for run ${runId}:`, err)
    return []
  }
}
