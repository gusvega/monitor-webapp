import { NextRequest, NextResponse } from 'next/server'

// Store for webhook events - in production, use a real database
const recentEvents: Array<{
  timestamp: number
  event: string
  repo: string
  status: string
}> = []

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-hub-signature-256') || ''
    const payload = await request.text()

    // Verify webhook signature
    const crypto = await import('crypto')
    const secret = process.env.GITHUB_WEBHOOK_SECRET || ''
    
    if (secret) {
      const hmac = crypto.createHmac('sha256', secret)
      hmac.update(payload)
      const digest = 'sha256=' + hmac.digest('hex')
      
      if (signature !== digest) {
        console.error('[WEBHOOK] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const data = JSON.parse(payload)
    
    // Log all webhook events
    console.log('[WEBHOOK] Received event:', data.action, 'from repo:', data.repository?.full_name)
    
    if (data.workflow_run) {
      const workflowRun = data.workflow_run
      const repo = data.repository.full_name
      const status = workflowRun.status
      const conclusion = workflowRun.conclusion
      
      console.log(`[WEBHOOK] Workflow: ${workflowRun.name}`)
      console.log(`[WEBHOOK] Status: ${status}, Conclusion: ${conclusion}`)
      console.log(`[WEBHOOK] ID: ${workflowRun.id}`)
      
      // Store event for debugging
      recentEvents.push({
        timestamp: Date.now(),
        event: `workflow_run.${data.action}`,
        repo,
        status: conclusion || status,
      })
      
      // Keep only last 50 events
      if (recentEvents.length > 50) {
        recentEvents.shift()
      }
      
      // In production, you'd trigger a real-time update here via:
      // - WebSocket broadcast
      // - Server-Sent Events (SSE)
      // - Socket.io
      // For now, we'll just log it
      console.log('[WEBHOOK] Event recorded, will be picked up on next poll')
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook receiver is active',
    recentEvents: recentEvents.slice(-10),
  })
}
