import { auth } from '@/auth'

const GITHUB_API_VERSION = '2022-11-28'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini'

function getErrorRelevantLines(logText: string) {
  const lines = logText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const errorLines = lines.filter((line) =>
    /(error|failed|exception|traceback|permission|denied|unable|cannot|not found|panic|fatal)/i.test(line)
  )

  const chosen = errorLines.length > 0 ? errorLines.slice(-8) : lines.slice(-12)
  return [...new Set(chosen)].slice(0, 8)
}

function buildHeuristicSummary(lines: string[], context: string, failedStep?: string | null) {
  if (lines.length === 0) {
    return `Monitor could not extract a clear ${context} failure message from the GitHub logs.`
  }

  const firstLine = lines[0]
  const stepPrefix = failedStep ? `Failed at "${failedStep}". ` : ''
  return `${stepPrefix}${firstLine}`
}

async function maybeGenerateAiSummary(params: {
  context: string
  failedStep?: string | null
  lines: string[]
}) {
  if (!process.env.OPENAI_API_KEY || params.lines.length === 0) return null

  const prompt = [
    'You are summarizing a failed GitHub Actions job for a monitoring dashboard.',
    'Write a short, plain-English summary for a non-technical or semi-technical user.',
    'Keep it to one or two sentences.',
    'Do not speculate beyond the evidence.',
    params.failedStep ? `Failed step: ${params.failedStep}` : 'Failed step: unknown',
    `Context: ${params.context}`,
    'Relevant log lines:',
    ...params.lines,
  ].join('\n')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: 120,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.warn('[JOB SUMMARY] OpenAI summary failed:', response.status, errorText)
    return null
  }

  const data = await response.json()
  const text =
    data.output_text ||
    data.output?.flatMap((item: any) => item.content || []).map((part: any) => part.text).join('\n') ||
    null

  return text?.trim() || null
}

export async function GET(request: Request) {
  const session = await auth()
  const accessToken = (session as any)?.accessToken as string | undefined

  if (!accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const repoFullName = searchParams.get('repoFullName')
  const jobId = searchParams.get('jobId')
  const context = searchParams.get('context') || 'workflow'

  if (!repoFullName || !jobId) {
    return Response.json({ error: 'Missing repoFullName or jobId' }, { status: 400 })
  }

  const [owner, repo] = repoFullName.split('/')
  if (!owner || !repo) {
    return Response.json({ error: 'Invalid repoFullName' }, { status: 400 })
  }

  try {
    const jobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    })

    if (!jobResponse.ok) {
      return Response.json({ error: 'Unable to fetch job details' }, { status: jobResponse.status })
    }

    const jobData = await jobResponse.json()
    const failedStep =
      jobData.steps?.find((step: any) => step.conclusion === 'failure')?.name ||
      jobData.name ||
      null

    const logsRedirectResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
        },
        redirect: 'manual',
      }
    )

    const logsUrl = logsRedirectResponse.headers.get('location')
    if (!logsUrl) {
      return Response.json({
        summary: `Monitor could not fetch logs for ${jobData.name}. Open the GitHub job for details.`,
        source: 'fallback',
      })
    }

    const rawLogs = await fetch(logsUrl).then((response) => response.text())
    const relevantLines = getErrorRelevantLines(rawLogs)
    const heuristicSummary = buildHeuristicSummary(relevantLines, context, failedStep)
    const aiSummary = await maybeGenerateAiSummary({
      context,
      failedStep,
      lines: relevantLines,
    })

    return Response.json({
      summary: aiSummary || heuristicSummary,
      source: aiSummary ? 'ai' : 'heuristic',
      failedStep,
      relevantLines: relevantLines.slice(0, 5),
      jobName: jobData.name,
    })
  } catch (error) {
    console.error('[JOB SUMMARY] Failed to summarize job', error)
    return Response.json(
      { error: 'Failed to generate job summary' },
      { status: 500 }
    )
  }
}
