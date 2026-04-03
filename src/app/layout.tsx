import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
// @ts-expect-error CSS import
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Monitor - Gus Vega',
  description: 'Monitoring dashboard for websites, webapps, and infrastructure.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-neutral-50">
        {children}
      </body>
    </html>
  )
}
// Triggered automated deployment at Thu Apr  2 21:45:21 PDT 2026
