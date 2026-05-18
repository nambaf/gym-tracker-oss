'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { epley1RM } from '@/lib/progress'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDataStore } from '@/store/data'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Lang } from '@/lib/i18n'

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }
const FAILURE_TAG = 'cedimento'

function shortDay(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short' }).format(d)
}

function shortMonth(d: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { month: 'short' }).format(d)
}

export default function ExerciseProgressPage() {
  const t = useT()
  const lang = useLang()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [name, setName] = useState('')
  const { exercises, sets, loadExercises, loadSets } = useDataStore()
  const [period, setPeriod] = useState<'4w' | '12w' | '6m' | 'all'>('12w')

  useEffect(() => {
    loadExercises(); loadSets()
  }, [loadExercises, loadSets])

  useEffect(() => {
    if (exercises.status === 'success') {
      const ex = exercises.data?.find((e: any) => e.id === params.id)
      setName(ex?.name || String(params.id))
    }
  }, [exercises, params.id])

  const exSets = useMemo(() => {
    if (sets.status !== 'success') return []
    return (sets.data || []).filter((s: any) => s.exerciseId === String(params.id))
      .sort((a: any, b: any) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
  }, [sets, params.id])

  const chartData = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const s of exSets as any[]) {
      const d = new Date(s.ts).toISOString().slice(0, 10)
      const e1 = epley1RM(Number(s.weight), Number(s.reps))
      byDay.set(d, Math.max(byDay.get(d) || 0, e1))
    }
    const rows = Array.from(byDay.entries())
      .map(([date, e1rm]) => ({ date, e1rm: Math.round(e1rm) }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const now = new Date()
    const cutoff = (() => {
      if (period === '4w') { const d = new Date(now); d.setDate(d.getDate() - 28); return d }
      if (period === '12w') { const d = new Date(now); d.setDate(d.getDate() - 84); return d }
      if (period === '6m') { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d }
      return null
    })()
    return cutoff ? rows.filter(r => new Date(r.date) >= cutoff) : rows
  }, [exSets, period])

  const stats = useMemo(() => {
    if (exSets.length === 0) return null
    const allE1rms = exSets.map((s: any) => epley1RM(Number(s.weight), Number(s.reps))).filter(e => e > 0)
    const max1rm = Math.max(...allE1rms)
    const heaviestSet = (exSets as any[]).reduce((acc, s) => {
      const w = Number(s.weight) || 0
      return w > (acc?.weight || 0) ? s : acc
    }, null as any)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const vol7 = (exSets as any[])
      .filter(s => new Date(s.ts) >= weekAgo)
      .reduce((acc, s) => acc + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
    const start = chartData[0]?.e1rm
    const end = chartData[chartData.length - 1]?.e1rm
    const delta = start && end ? end - start : 0
    return {
      max1rm: Math.round(max1rm),
      pr: heaviestSet,
      vol7: Math.round(vol7),
      delta,
      sessionsCount: new Set(exSets.map((s: any) => s.sessionId)).size,
      totalSets: exSets.length,
    }
  }, [exSets, chartData])

  // Suggestion: target RPE 8 at 92% of 1RM, reps 8.
  const suggestion = useMemo(() => {
    if (!stats?.max1rm) return null
    const targetReps = 8
    const intensity = 0.92
    const w = stats.max1rm * intensity / (1 + targetReps / 30)
    return {
      weight: Math.round(w / 2.5) * 2.5,
      reps: targetReps,
      rpe: 8,
    }
  }, [stats])

  const recentSessions = useMemo(() => {
    if (sets.status !== 'success') return []
    const bySession = new Map<string, { ts: string; sets: any[] }>()
    for (const s of exSets as any[]) {
      if (!bySession.has(s.sessionId)) {
        bySession.set(s.sessionId, { ts: s.ts, sets: [] })
      }
      bySession.get(s.sessionId)!.sets.push(s)
    }
    return Array.from(bySession.entries())
      .map(([sessionId, v]) => ({
        sessionId, ts: v.ts,
        sets: v.sets.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()),
        volume: v.sets.reduce((acc, s) => acc + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0),
      }))
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 5)
  }, [exSets, sets.status])

  if (exercises.status !== 'success' || sets.status !== 'success') {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 -ml-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-1 text-muted hover:text-ink"
        ><ChevronLeft size={20} /></button>
        <span className="eyebrow">{t.exercise.eyebrow}</span>
      </div>

      <header>
        <h1 className="display text-[44px] leading-[0.95] tracking-tight2">
          {name}
        </h1>
        <p className="text-xs text-muted mt-3 num">
          {stats?.sessionsCount || 0} {t.exercise.sessionsCount} · {stats?.totalSets || 0} {t.exercise.setsCount}
        </p>
      </header>

      {stats && (
        <div className="card-dark p-6 pb-5 relative overflow-hidden">
          <div className="text-[10px] tracking-[0.16em] uppercase font-semibold opacity-55">
            {t.exercise.oneRMEstimated}
          </div>
          <div className="mt-2">
            <span className="display text-[64px] leading-[0.9] tracking-tight3">
              {stats.max1rm}
            </span>
            <span className="text-base opacity-55 ml-2">kg</span>
          </div>
          <div className="flex items-end justify-between mt-3 text-[11px]">
            <span className="opacity-65">
              {stats.pr && (
                <>{t.exercise.realPR} · <span className="num">{stats.pr.weight} kg × {stats.pr.reps}</span></>
              )}
            </span>
            {stats.delta !== 0 && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-500 text-white num">
                {stats.delta > 0 ? '+' : ''}{stats.delta} {t.exercise.deltaInSuffix} {period}
              </span>
            )}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="label">{t.exercise.chartTitle}</div>
            {chartData.length > 1 && (
              <div className="text-xs text-muted mt-0.5 num">
                {chartData[0].e1rm} → {chartData[chartData.length - 1].e1rm} kg
              </div>
            )}
          </div>
          <div className="seg !p-0.5">
            {(['4w', '12w', '6m', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`seg-btn !text-[11px] !py-1 !px-2 ${period === p ? 'active' : ''}`}
              >{p === 'all' ? t.exercise.periodAll : p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="card p-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="accentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d6492a" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#d6492a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#a8a59c' }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return `${d.getDate()} ${shortMonth(d, lang)}`
                }}
                axisLine={false} tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: '#a8a59c' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  background: '#1a1916', border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 11, padding: '6px 10px',
                }}
                labelFormatter={(v) => new Date(v).toLocaleDateString(LOCALE[lang])}
                formatter={(v: any) => [`${v} kg`, t.exercise.chartTooltipLabel]}
              />
              <Area type="monotone" dataKey="e1rm" stroke="#d6492a" strokeWidth={1.5}
                fill="url(#accentFill)" dot={{ r: 2, fill: '#d6492a' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {suggestion && (
        <section className="rounded-2xl bg-accent-50 p-4 flex items-center gap-3">
          <Sparkles size={18} className="text-accent-500 shrink-0" />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-accent-600">
              {t.exercise.suggestedTitle}
            </div>
            <div className="text-[14px] font-semibold text-ink mt-0.5 num">
              {suggestion.weight} kg × {suggestion.reps} · RPE {suggestion.rpe}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="label mb-3">{t.exercise.recentTitle}</div>
        <div className="space-y-3">
          {recentSessions.map((s, idx) => {
            const d = new Date(s.ts)
            return (
              <div key={s.sessionId}
                className={`pb-3 ${idx < recentSessions.length - 1 ? 'border-b border-ink/[0.06]' : ''}`}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[14px]">
                    <span className="display">{shortDay(d, lang)}</span>{' '}
                    <span className="text-muted">{d.getDate()} {shortMonth(d, lang)}</span>
                  </span>
                  <span className="text-[11px] text-muted num">
                    {Math.round(s.volume).toLocaleString(LOCALE[lang])} kg·rep
                  </span>
                </div>
                <div className="space-y-1">
                  {s.sets.map((set: any, j: number) => (
                    <div key={set.id || j} className="flex items-baseline gap-3 text-[12px]">
                      <span className="label !text-[10px] w-10">{t.exercise.setLabel} {j + 1}</span>
                      <span className="num text-ink font-medium">
                        {set.weight} kg × {set.reps}
                      </span>
                      {set.note?.includes(FAILURE_TAG) && (
                        <span className="text-[10px] text-accent-500 font-semibold">{t.exercise.chipFailure}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {recentSessions.length === 0 && (
            <div className="card p-6 text-center text-muted text-sm">
              {t.exercise.emptyState}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
