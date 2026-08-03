'use client'

/**
 * Logging the training that doesn't happen in the gym.
 *
 * Deliberately kept off the workout screen: `/workout` is the plan being
 * executed, and a run has no exercises, no sets and no rest timer. It lands
 * here, on the dashboard, next to the rest of the week's picture.
 *
 * What it writes is a `sessions` row with `kind: 'activity'` — same table, no
 * schema of its own — which every "did you train?" count filters out. See
 * `lib/sessions.ts` for why.
 */
import { useMemo, useState } from 'react'
import { Bike, Footprints, Plus, Trash2, Waves, Activity as ActivityIcon, Trophy, X } from 'lucide-react'
import { useDataStore } from '@/store/data'
import { ACTIVITY_TYPES, activityMinutes, activitySessions } from '@/lib/sessions'
import { weekBounds, localDayKey, parseLocalDate } from '@/lib/dateUtils'
import type { ActivityType, IntensityLevel, Session } from '@/lib/models'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Lang } from '@/lib/i18n'

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }

const ICONS: Record<ActivityType, typeof Footprints> = {
  run: Footprints,
  bike: Bike,
  swim: Waves,
  walk: Footprints,
  sport: Trophy,
  other: ActivityIcon,
}

/** Distance is meaningful for these; asking for the kilometres of a match is not. */
const WITH_DISTANCE = new Set<ActivityType>(['run', 'bike', 'swim', 'walk'])

export default function ActivityLogger() {
  const t = useT()
  const lang = useLang()
  const { sessions, addSessionOptimistic, removeSessionOptimistic, loadSessions } = useDataStore()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [type, setType] = useState<ActivityType>('run')
  const [day, setDay] = useState(() => localDayKey())
  const [minutes, setMinutes] = useState('')
  const [distance, setDistance] = useState('')
  const [effort, setEffort] = useState<IntensityLevel | null>(null)
  const [note, setNote] = useState('')

  const weekActivities = useMemo(() => {
    if (sessions.status !== 'success') return []
    const { monday, sunday } = weekBounds(new Date())
    return activitySessions(sessions.data || [])
      .filter(s => {
        const d = new Date(s.date)
        return !Number.isNaN(d.getTime()) && d >= monday && d <= sunday
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [sessions])

  function reset() {
    setType('run'); setDay(localDayKey()); setMinutes('')
    setDistance(''); setEffort(null); setNote(''); setError('')
  }

  async function save() {
    const mins = Number(minutes)
    if (!Number.isFinite(mins) || mins <= 0) { setError(t.activity.errorDuration); return }
    // A date-only string parses as UTC midnight, which lands on the previous
    // day west of Greenwich. Keep the current clock time when logging today so
    // the timeline orders it against the day's gym session correctly.
    const chosen = parseLocalDate(day)
    if (!chosen) { setError(t.activity.errorDuration); return }
    const isToday = day === localDayKey()
    const when = isToday ? new Date() : chosen

    const dist = Number(distance.replace(',', '.'))
    const payload: Omit<Session, 'id'> = {
      date: when.toISOString(),
      kind: 'activity',
      activity: type,
      duration: Math.round(mins * 60),
      note: note.trim() || undefined,
    }
    if (WITH_DISTANCE.has(type) && Number.isFinite(dist) && dist > 0) payload.distanceKm = dist
    if (effort) payload.effort = effort

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/data/sessions', { method: 'POST', body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(`save activity ${res.status}`)
      const { id } = await res.json()
      addSessionOptimistic({ id, ...payload } as Session)
      if (sessions.status !== 'success') loadSessions(true)
      setOpen(false)
      reset()
    } catch (e) {
      console.error('Failed to save activity:', e)
      setError(t.activity.errorSave)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    removeSessionOptimistic(id)
    try { await fetch(`/api/data/sessions/${id}`, { method: 'DELETE' }) }
    catch (e) { console.error('Failed to delete activity:', e) }
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">{t.activity.title}</h3>
          <p className="text-xs text-muted mt-0.5">{t.activity.subtitle}</p>
        </div>
        <button
          onClick={() => { reset(); setOpen(true) }}
          className="btn-icon shrink-0"
          aria-label={t.activity.addBtn}
        >
          <Plus size={16} strokeWidth={2.4} />
        </button>
      </div>

      {weekActivities.length === 0 ? (
        <p className="text-xs text-muted-2 mt-3">{t.activity.emptyWeek}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {weekActivities.map(a => {
            const Icon = ICONS[a.activity || 'other']
            const mins = activityMinutes(a)
            const bits = [
              mins ? `${mins} ${t.activity.minutesShort}` : null,
              a.distanceKm ? `${a.distanceKm} km` : null,
              a.effort ? `${t.activity.effortShort} ${a.effort}/5` : null,
            ].filter(Boolean)
            return (
              <li
                key={a.id}
                className="flex items-center gap-2.5 rounded-xl bg-paper-sunken px-3 py-2"
              >
                <Icon size={14} strokeWidth={2} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">
                    {t.activity.types[a.activity || 'other']}
                    <span className="text-muted font-normal ml-1.5 text-[11px] capitalize">
                      {new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short' }).format(new Date(a.date))}
                    </span>
                  </div>
                  {bits.length > 0 && (
                    <div className="text-[11px] text-muted num">{bits.join(' · ')}</div>
                  )}
                  {a.note && <div className="text-[11px] text-muted italic truncate">{a.note}</div>}
                </div>
                <button
                  onClick={() => remove(a.id)}
                  aria-label={t.common.delete}
                  className="shrink-0 text-muted-2 hover:text-danger transition-colors"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header flex items-center justify-between">
              <h3 className="display text-2xl">{t.activity.modalTitle}</h3>
              <button onClick={() => setOpen(false)} className="btn-icon" aria-label={t.common.close}>
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="label mb-2">{t.activity.typeLabel}</div>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITY_TYPES.map(k => {
                    const Icon = ICONS[k]
                    return (
                      <button
                        key={k}
                        onClick={() => setType(k)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium border transition-colors
                          ${type === k
                            ? 'bg-ink text-white border-ink'
                            : 'bg-paper-card text-ink-soft border-ink/10'}`}
                      >
                        <Icon size={12} strokeWidth={2.2} /> {t.activity.types[k]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="label block mb-1.5">{t.activity.dateLabel}</span>
                  <input
                    type="date"
                    className="input"
                    value={day}
                    max={localDayKey()}
                    onChange={e => setDay(e.target.value)}
                  />
                </label>
                <label className="flex-1">
                  <span className="label block mb-1.5">{t.activity.durationLabel}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input num"
                    placeholder="45"
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                  />
                </label>
              </div>

              {WITH_DISTANCE.has(type) && (
                <label className="block">
                  <span className="label block mb-1.5">{t.activity.distanceLabel}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    className="input num"
                    placeholder="8"
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                  />
                </label>
              )}

              <div>
                <div className="label mb-2">{t.activity.effortLabel}</div>
                <div className="seg grid grid-cols-5">
                  {([1, 2, 3, 4, 5] as IntensityLevel[]).map(n => (
                    <button
                      key={n}
                      onClick={() => setEffort(effort === n ? null : n)}
                      className={`seg-btn num ${effort === n ? 'active' : ''}`}
                    >{n}</button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="label block mb-1.5">{t.activity.noteLabel}</span>
                <input
                  type="text"
                  className="input"
                  placeholder={t.activity.notePlaceholder}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </label>

              {error && <div className="text-[13px] text-danger">{error}</div>}

              <button
                onClick={save}
                disabled={saving}
                className="btn-primary w-full py-3.5 rounded-full disabled:opacity-40"
              >
                {saving ? t.common.saving : t.activity.saveBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
