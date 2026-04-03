import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((request) => {
  const pathname = request.nextUrl.pathname
  const isAuthenticated = !!request.auth

  console.log(`[MIDDLEWARE] pathname: ${pathname}, authenticated: ${isAuthenticated}`)

  // Protected routes
  if (pathname.startsWith('/dashboard') || pathname === '/setup') {
    if (!isAuthenticated) {
      console.log(`[MIDDLEWARE] Blocking unauthenticated access to ${pathname}, redirecting to /login`)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // If user is going to /setup but already has repos selected, redirect to dashboard
  if (pathname === '/setup' && isAuthenticated) {
    // We can't check localStorage in middleware, so we'll let the page handle it
    // The setup page will redirect to /dashboard after repos are selected
  }

  // Public routes - redirect authenticated users to setup (first time) or dashboard
  if ((pathname === '/' || pathname === '/login') && isAuthenticated) {
    console.log(`[MIDDLEWARE] Redirecting authenticated user from ${pathname} to /setup`)
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (auth routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
  ],
}
