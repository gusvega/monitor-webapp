import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@gusvega/ui/dist/style.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Monitor - Gus Vega',
  description: 'Monitoring dashboard for websites, webapps, and infrastructure.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  )
}
