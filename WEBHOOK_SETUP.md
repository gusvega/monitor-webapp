# GitHub Webhook Setup Guide

## Current Status
✅ ngrok is running and exposing your local server at:
```
https://0b9a-2601-600-9b81-fe20-d14-d376-dbf8-b772.ngrok-free.app
```

✅ Webhook receiver endpoint created at:
```
POST https://0b9a-2601-600-9b81-fe20-d14-d376-dbf8-b772.ngrok-free.app/api/webhooks/github
```

## Steps to Configure GitHub Webhook

### 1. Generate a Webhook Secret
Run this command to generate a secure random secret:
```bash
openssl rand -hex 32
```
Copy the output. Example: `a1b2c3d4e5f6...`

### 2. Update .env.local
Add your secret to the `.env.local` file:
```dotenv
GITHUB_WEBHOOK_SECRET=<paste-the-secret-here>
```

### 3. Add Webhook to GitHub Repository
Go to: **Settings → Webhooks → Add webhook**

Fill in:
- **Payload URL**: `https://0b9a-2601-600-9b81-fe20-d14-d376-dbf8-b772.ngrok-free.app/api/webhooks/github`
- **Content type**: `application/json`
- **Secret**: Paste the same secret from step 1
- **Which events would you like to trigger this webhook?**
  - Select: **Workflow runs**
  - Or select **Let me select individual events** and check:
    - ✅ Workflow runs
    - ✅ Push
    - ✅ Pull requests

### 4. Test the Webhook
Once saved, GitHub will send a test payload. You should see:
- ✅ Green checkmark next to the webhook
- In your console: `[WEBHOOK] Received event...` logs

### 5. Monitor Webhook Events
Visit ngrok dashboard at: **http://localhost:4040**
- Watch all incoming webhook requests in real-time
- See request/response details

## How It Works

1. You push code to GitHub or a workflow runs
2. GitHub sends a webhook event to your ngrok URL
3. The webhook is received at `/api/webhooks/github`
4. The event is logged (currently)
5. Next poll (5 seconds) will pick up the updated workflow data

**Note**: Currently, webhooks are logged but don't trigger real-time UI updates. The 5-second polling still refreshes the data. To implement true real-time updates, we'd need to add WebSocket or Server-Sent Events (SSE) support.

## Important Notes

⚠️ **ngrok URLs are temporary**
- Each time you restart ngrok, you get a new URL
- Update the webhook URL in GitHub if you restart ngrok
- For production, use a static ngrok domain or permanent server

⚠️ **Webhook Secret**
- Keep this secret private (don't commit to git)
- GitHub validates requests using this secret
- Your server verifies the signature to prevent spoofed requests

## Troubleshooting

**Webhook not appearing in GitHub?**
- Check internet connectivity
- Verify ngrok is running and shows the tunnel
- Check `.env.local` is loaded (restart dev server after changes)

**Signature validation failing?**
- Ensure the secret in `.env.local` matches GitHub's setting exactly
- Restart the dev server after changing `.env.local`

**No console logs?**
- Check browser console (F12)
- Check terminal where Next.js dev server is running
- Verify webhook endpoint is actually being called (check ngrok dashboard)
