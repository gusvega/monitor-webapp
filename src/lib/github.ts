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
  
  // Get the most recent deployment for each environment
  for (const deployment of deployments) {
    console.log('[GITHUB] Processing deployment:', {
      id: deployment.id,
      environment: deployment.environment,
      state: deployment.state,
      ref: deployment.ref,
    })
    
    // Accept any state - we'll show what we have
    if (!grouped[deployment.environment] || 
        new Date(deployment.updated_at) > new Date(grouped[deployment.environment].updated_at)) {
      grouped[deployment.environment] = deployment
      console.log('[GITHUB] Updated environment', deployment.environment, 'with deployment', deployment.id)
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
  accessToken: string,
  workflowName: string = 'deploy.yml'
): Promise<WorkflowRun[]> {
  try {
    console.log('[GITHUB] Fetching workflow runs for', repoFullName)
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/actions/workflows/${workflowName}/runs?per_page=3&status=completed`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`[GITHUB] Failed to fetch workflow runs for ${repoFullName}:`, response.status)
      return []
    }

    const data = await response.json()
    const runs = data.workflow_runs || []
    console.log('[GITHUB] Fetched', runs.length, 'workflow runs for', repoFullName)
    return runs
  } catch (err) {
    console.error(`[GITHUB] Error fetching workflow runs for ${repoFullName}:`, err)
    return []
  }
}
