'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Dumbbell, History, ClipboardList } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

// Paths where the bottom navigation is hidden — typically anything reachable
// before authentication. Kept here next to the component so the layout doesn't
// need to know about it.
const HIDDEN_ON = ['/login']

export function BottomNav() {
  const pathname = usePathname()
  const t = useT()

  if (HIDDEN_ON.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return null
  }

  const tabs = [
    { href: '/' as const, label: t.nav.home, icon: Home },
    { href: '/workout' as const, label: t.nav.workout, icon: Dumbbell },
    { href: '/history' as const, label: t.nav.history, icon: History },
    { href: '/plan' as const, label: t.nav.plan, icon: ClipboardList },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-area-bottom
                    bg-paper/85 backdrop-blur-lg border-t border-ink/[0.06]">
      <div className="flex items-center justify-around max-w-screen-sm mx-auto h-[60px] px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 min-w-[3.5rem] py-1.5
                          transition-colors ${
                isActive ? 'text-accent-500' : 'text-muted-2 hover:text-ink-soft'
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.6}
                className={`transition-transform ${isActive ? 'scale-105' : ''}`}
              />
              <span className={`text-[10px] tracking-wide font-semibold ${
                isActive ? '' : 'font-medium'
              }`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
