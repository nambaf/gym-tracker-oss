import './globals.css'
import { Inter, Instrument_Serif } from 'next/font/google'
import { Toaster } from 'sonner'
import { BottomNav } from '@/components/BottomNav'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { getLang } from '@/lib/i18n/getLang'
import { AppConfigProvider } from '@/lib/appConfig'
import { isAIEnabled } from '@/lib/ai'

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const serif = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: '400',
  style: ['normal', 'italic'],
})

export const metadata = {
  title: 'Gym Tracker',
  description: 'Mobile-first gym workout tracker, self-hosted on AWS.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Gym Tracker',
    statusBarStyle: 'default' as const,
  },
  formatDetection: { telephone: false },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
  themeColor: '#f4f1ec',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang()
  // Misconfigured AI_PROVIDER must not crash the whole layout — treat as off.
  let aiEnabled = false
  try { aiEnabled = isAIEnabled() } catch { aiEnabled = false }
  return (
    <html lang={lang} className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans antialiased">
        <I18nProvider initialLang={lang}>
          <AppConfigProvider aiEnabled={aiEnabled}>
            <main className="pb-24 max-w-screen-sm mx-auto px-5 pt-6">{children}</main>
            <BottomNav />
          </AppConfigProvider>
        </I18nProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            className: 'font-sans',
            style: { borderRadius: '0.875rem', border: '1px solid rgba(26,25,22,0.08)' },
          }}
        />
      </body>
    </html>
  )
}
