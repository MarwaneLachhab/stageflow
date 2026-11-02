import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { BRAND } from '@/lib/constants'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    'Déposez votre candidature de stage en quelques minutes, centralisez vos documents et suivez votre demande à chaque étape.',
  applicationName: BRAND.name,
  // Route groups and private areas must never be indexed.
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563EB',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
