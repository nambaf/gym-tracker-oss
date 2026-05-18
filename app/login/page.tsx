'use client'
import { Suspense, useState, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n/I18nProvider'
import { LangSwitcher } from '@/components/LangSwitcher'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}

function LoginFallback() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <span className="w-5 h-5 border-2 border-fg border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

type Stage =
  | { kind: 'credentials' }
  | { kind: 'new-password'; session: string }

function LoginForm() {
  const t = useT()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [stage, setStage] = useState<Stage>({ kind: 'credentials' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, string> = { email, password }
      if (stage.kind === 'new-password') {
        payload.session = stage.session
        payload.newPassword = newPassword
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data.challenge === 'NEW_PASSWORD_REQUIRED') {
        setStage({ kind: 'new-password', session: data.session })
        setLoading(false)
        return
      }

      if (!res.ok) {
        if (res.status === 401) setError(t.login.errors.invalidCredentials)
        else if (data?.error === 'invalid_new_password') setError(data.message || t.login.errors.invalidNewPassword)
        else if (data?.error === 'password_reset_required') setError(t.login.errors.passwordResetRequired)
        else setError(t.login.errors.generic)
        setLoading(false)
        return
      }

      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
      window.location.assign(safeNext)
    } catch {
      setError(t.login.errors.network)
      setLoading(false)
    }
  }

  const isFirstLogin = stage.kind === 'new-password'

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="eyebrow">{t.login.eyebrow}</div>
          <h1 className="display text-[44px] leading-[0.95] tracking-tight2 mt-2">
            {isFirstLogin ? t.login.titleFirst : t.login.title}
          </h1>
          <p className="text-sm text-muted mt-2">
            {isFirstLogin ? t.login.subtitleFirst : t.login.subtitle}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">{t.login.email}</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input mt-1"
              autoFocus={!isFirstLogin}
              disabled={loading || isFirstLogin}
              required
            />
          </div>

          <div>
            <label className="label">{t.login.password}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input mt-1"
              disabled={loading || isFirstLogin}
              required
            />
          </div>

          {isFirstLogin && (
            <div>
              <label className="label">{t.login.newPassword}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input mt-1"
                autoFocus
                disabled={loading}
                required
                minLength={8}
              />
              <p className="text-xs text-muted mt-1">{t.login.passwordRequirements}</p>
            </div>
          )}

          {error && (
            <div className="text-sm text-danger">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || (isFirstLogin && !newPassword)}
            className="btn-primary w-full py-3.5 rounded-full text-[15px] disabled:opacity-40"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isFirstLogin ? t.login.submitFirst : t.login.submit}
          </button>
        </form>

        <div className="flex justify-center pt-2">
          <LangSwitcher />
        </div>
      </div>
    </div>
  )
}
