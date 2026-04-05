import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'

const AUTHORIZED_USERS = (process.env.AUTHORIZED_GITHUB_USERS || 'gusvega')
  .split(',')
  .map((username) => username.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: 'user:email repo public_repo',
        },
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log('[AUTH JWT] Called with account:', !!account, 'profile:', !!profile)
      
      if (account && profile) {
        const username = ((profile as any).login as string).toLowerCase()
        console.log('[AUTH JWT] Setting username:', username)
        
        if (!AUTHORIZED_USERS.includes(username)) {
          console.warn('[AUTH JWT] User not in authorized list:', username)
          throw new Error('User not authorized')
        }
        
        token.username = username
        
        // Store GitHub access token for API calls
        if (account.access_token) {
          console.log('[AUTH JWT] Setting access token, length:', account.access_token.length)
          token.accessToken = account.access_token
        } else {
          console.warn('[AUTH JWT] No access token in account')
        }
      }
      return token
    },
    async session({ session, token }) {
      console.log('[AUTH SESSION] Called, token has accessToken:', !!token.accessToken)
      
      if (session.user) {
        session.user.name = token.username as string
        // Add access token to session
        ;(session as any).accessToken = token.accessToken
        console.log('[AUTH SESSION] Added accessToken to session:', !!(session as any).accessToken)
      }
      return session
    },
  },
})
