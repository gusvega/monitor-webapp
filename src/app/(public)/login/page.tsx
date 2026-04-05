'use client'

import { useEffect, useState } from 'react'
import { GitBranch, Loader, AlertCircle } from 'lucide-react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Container,
} from '@gusvega/ui'
import { hasMonitorRepoSelection } from '@/lib/client-auth'
import LoadingScreen from '@/components/LoadingScreen'

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && (session as any)?.accessToken) {
      router.replace(hasMonitorRepoSelection() ? '/dashboard' : '/setup')
    }
  }, [router, session, status])

  if (status === 'loading') {
    return (
      <LoadingScreen
        title="Checking your sign-in status..."
        description="Getting Monitor ready before you continue."
      />
    )
  }

  if (status === 'authenticated' && (session as any)?.accessToken) {
    return (
      <LoadingScreen
        title="Redirecting to Monitor..."
        description="Taking you to your setup or dashboard."
      />
    )
  }

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn('github', { redirect: true, callbackUrl: '/setup' })
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Failed to sign in with GitHub')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 py-16">
      <Container>
        <div className="mx-auto max-w-md">
          <Card className="overflow-hidden border-white/10 shadow-2xl shadow-black/20">
            <CardHeader className="bg-neutral-950 text-center border-b border-neutral-800">
              <div className="flex justify-center mb-4">
                <div className="rounded-xl bg-white p-3">
                  <GitBranch className="w-8 h-8 text-neutral-900" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white">Monitor</h1>
              <p className="mt-2 text-sm text-neutral-400">
                Track deployments and monitor your infrastructure.
              </p>
            </CardHeader>
            <CardContent className="space-y-6 px-8 py-10">
              <div className="text-center">
                <h2 className="text-xl font-bold text-neutral-900 mb-2">Sign In</h2>
                <p className="text-sm text-neutral-600">
                  Sign in with GitHub to create a Monitor session and authorize this app. Access is limited to approved GitHub accounts.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <Alert title={error}>
                      Please contact support if you believe you should have access.
                    </Alert>
                  </div>
                </div>
              )}

              <Button
                onClick={handleGitHubSignIn}
                disabled={isLoading}
                className="w-full justify-center gap-2.5"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Sign in with GitHub
                  </>
                )}
              </Button>

              <Alert title="Secure authentication">
                Being logged into GitHub in this browser is not enough. You still need to sign in to Monitor, approve this app, and match the allowed GitHub account list.
              </Alert>
            </CardContent>
            <CardFooter className="bg-neutral-50 text-center">
              <p className="w-full text-xs text-neutral-600">
                By signing in, you agree to our terms of service.
              </p>
            </CardFooter>
          </Card>

          <p className="mt-8 text-center text-xs text-neutral-400">
            Monitor v1.0.0 • Built with Next.js and gus-ui
          </p>
        </div>
      </Container>
    </div>
  )
}
