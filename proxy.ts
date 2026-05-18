import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, verifyAuthToken } from '@/lib/auth'

// Paths reachable without an authenticated session. Keep this list tight:
// every entry widens the unauthenticated attack surface.
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',  // prefix — covers /api/health/datastore
]

function isPublic(pathname: string): boolean {
  for (const p of PUBLIC_PATHS) {
    if (pathname === p) return true
    if (pathname.startsWith(p + '/')) return true
  }
  return false
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get(AUTH_COOKIE)?.value
  const ok = await verifyAuthToken(token)
  if (ok) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  // Preserve the original destination (including query string) so the login
  // page can bounce the user back where they were.
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search}`)
  }
  return NextResponse.redirect(loginUrl)
}

// The matcher decides whether the proxy runs at all. Anything matched by the
// negative lookahead bypasses it entirely (static assets, Next internals).
// `app/icon.svg` is served at `/icon.svg` and is covered by the `.svg` rule.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|map|js|css|json|xml|txt)$).*)',
  ],
}
