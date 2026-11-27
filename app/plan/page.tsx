'use client'
import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@/store/data'
import { analyzePlanCompleteness, analyzeSessionVolume, getCompletenessStatusBadge } from '@/lib/planAnalysis'
import { WorkoutAIChat } from '@/components/WorkoutAIChat'
import MuscleChips from '@/components/MuscleChips'
import { planDays } from '@/lib/plan/days'
import { apiFetch, apiJson } from '@/lib/api'
import { weekBounds } from '@/lib/dateUtils'
import { strengthSessions } from '@/lib/sessions'
import type { Exercise, PlanRow } from '@/lib/models'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Trash2, ArrowUp, ArrowDown, Plus, Check, AlertTriangle, MoreHorizontal, Copy, Star } from 'lucide-react'
import type { TrainingMode } from '@/lib/hypertrophyThresholds'
import { useT, useLang } from '@/lib/i18n/I18nProvider'
import type { Lang } from '@/lib/i18n'

export type Row = {
  id: string
  day: string
  exerciseId: string
  targetSets: number
  targetReps: string
  targetRpe?: number | null
  order?: number
  note?: string
}
type PlanItem = {
  id: string
  name: string
  createdAt: string
  isActive: boolean
  description?: string
  rows: Row[]
  dayOrder: string[]
}

const LOCALE: Record<Lang, string> = { it: 'it-IT', en: 'en-US' }

function getNextRowId(existingRows: Row[]): string {
  const maxId = existingRows
    .map(r => parseInt(r.id) || 0)
    .reduce((max, curr) => Math.max(max, curr), 0)
  return String(maxId + 1)
}

function newPlanId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

function toPlanRow(r: Row): PlanRow {
  return {
    day: r.day, exerciseId: r.exerciseId, targetSets: r.targetSets,
    targetReps: r.targetReps, targetRpe: r.targetRpe ?? undefined,
  }
}

function normalizeRow(raw: unknown, fallbackIdx = 0): Row {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    id: r.id && /^\d+$/.test(String(r.id)) ? String(r.id) : String(fallbackIdx + 1),
    day: String(r.day ?? ''),
    exerciseId: String(r.exerciseId ?? ''),
    targetSets: Number(r.targetSets ?? 0),
    targetReps: String(r.targetReps ?? ''),
    targetRpe: r.targetRpe != null && r.targetRpe !== '' ? Number(r.targetRpe) : null,
    order: r.order != null ? Number(r.order) : 0,
    note: r.note ? String(r.note) : '',
  }
}

/**
 * Short labels for the day strip, unique within the plan.
 *
 * "Giorno 1" / "Day 1" → "G1" / "D1", anything else its first three letters.
 * Labels that collide ("Giorno A" / "Giorno B" are both "GIO") get the start of
 * their last word appended, and whatever still collides falls back to its
 * 1-based position.
 */
function dayStripLabels(days: string[], prefix: string): string[] {
  const short = days.map(d => {
    const m = d.match(/^(?:giorno|day)\s+(\d+)$/i)
    return m ? `${prefix}${m[1]}` : d.slice(0, 3).toUpperCase()
  })
  const withSuffix = days.map((d, i) => {
    const words = d.trim().split(/\s+/)
    if (words.length < 2) return short[i]
    return `${words[0].slice(0, 3)} ${words[words.length - 1].slice(0, 3)}`.toUpperCase()
  })
  const isUnique = (labels: string[], i: number) => labels.indexOf(labels[i]) === labels.lastIndexOf(labels[i])

  const labels = short.map((label, i) => (isUnique(short, i) ? label : withSuffix[i]))
  return labels.map((label, i) => {
    if (isUnique(labels, i)) return label
    const positional = `${prefix}${i + 1}`
    return labels.includes(positional) ? `#${i + 1}` : positional
  })
}

export default function PlanPage() {
  const t = useT()
  const lang = useLang()

  const [plans, setPlans] = useState<PlanItem[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [planMenuOpen, setPlanMenuOpen] = useState(false)

  const [rows, setRows] = useState<Row[]>([])
  const [days, setDays] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showAddDay, setShowAddDay] = useState(false)
  const [newDayName, setNewDayName] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  const {
    exercises, loadExercises, loadSettings, loadPlan,
    deloadActive, setDeloadActive,
    trainingMode, setTrainingMode,
    sessions, sets, loadSessions, loadSets,
    storedSettings,
  } = useDataStore()

  useEffect(() => {
    loadExercises(); loadSettings(); loadSessions(); loadSets()
  }, [loadExercises, loadSettings, loadSessions, loadSets])

  useEffect(() => {
    let canceled = false
    ;(async () => {
      setLoading(true)
      try {
        const plansRaw = await apiJson<unknown>('/api/data/plans')
        const list = (Array.isArray(plansRaw) ? plansRaw : []) as Record<string, unknown>[]
        const normalized: PlanItem[] = list.map(p => {
          const rows: Row[] = Array.isArray(p.rows) ? p.rows.map((r, i) => normalizeRow(r, i)) : []
          const storedOrder = Array.isArray(p.dayOrder)
            ? p.dayOrder.filter((d): d is string => typeof d === 'string')
            : undefined
          return {
            id: String(p.id),
            name: String(p.name || t.plan.untitledPlan),
            createdAt: String(p.createdAt || new Date().toISOString()),
            isActive: Boolean(p.isActive),
            description: p.description ? String(p.description) : undefined,
            rows,
            dayOrder: planDays({ rows: rows.map(toPlanRow), dayOrder: storedOrder }),
          }
        })

        normalized.sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
          return b.createdAt.localeCompare(a.createdAt)
        })

        if (canceled) return
        setPlans(normalized)
        const active = normalized.find(p => p.isActive) || normalized[0]
        setSelectedPlanId(active ? active.id : '')
        applyPlan(active)
        setDirty(false)
      } catch {
        if (!canceled) setError(t.plan.errors.load)
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [t.plan.errors.load, t.plan.untitledPlan])

  function applyPlan(plan: Pick<PlanItem, 'rows' | 'dayOrder'> | undefined) {
    const reindexed = (plan?.rows ?? []).map((r, i) => ({ ...r, id: String(i + 1) }))
    setRows(reindexed)
    setDays(planDays({ rows: reindexed.map(toPlanRow), dayOrder: plan?.dayOrder }))
  }

  function markDirty() { setDirty(true) }

  async function runSeed() {
    if (seeding) return
    setSeedError(null)
    setSeeding(true)
    try {
      const res = await fetch('/api/data/exercises/seed', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      await loadExercises(true)
    } catch {
      setSeedError(t.plan.seed.error)
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    if (!days.includes(selectedDay)) setSelectedDay(days[0] ?? '')
  }, [days, selectedDay])

  const exById = useMemo(
    () => new Map((exercises.data || []).map((e: Exercise) => [e.id, e])),
    [exercises.data]
  )

  const stripLabels = useMemo(
    () => dayStripLabels(days, t.plan.dayLabelPrefix),
    [days, t.plan.dayLabelPrefix]
  )

  const weeklyData = useMemo(() => {
    if (sessions.status !== 'success' || sets.status !== 'success') {
      return { weekSessions: [], weekSets: [] }
    }
    const { monday, sunday } = weekBounds()
    const weekSessions = strengthSessions(sessions.data || []).filter(s => {
      const d = new Date(s.date)
      return d >= monday && d <= sunday
    })
    const sessionIds = new Set(weekSessions.map(s => s.id))
    const weekSets = (sets.data || []).filter(s => sessionIds.has(s.sessionId))
    return { weekSessions, weekSets }
  }, [sessions, sets])

  const planSummary = useMemo(() => {
    if (exercises.status !== 'success' || rows.length === 0) return []
    return analyzePlanCompleteness(rows.map(toPlanRow), exercises.data || [], trainingMode, {
      recommendedSets: storedSettings.recommendedSets,
    })
  }, [rows, exercises, trainingMode, storedSettings.recommendedSets])

  const sessionWarnings = useMemo(() => {
    if (exercises.status !== 'success' || rows.length === 0) return []
    return analyzeSessionVolume(rows.map(toPlanRow), exercises.data || [], {
      maxSetsPerSessionPerMuscle: storedSettings.maxSetsPerSessionPerMuscle,
    })
  }, [rows, exercises, storedSettings.maxSetsPerSessionPerMuscle])

  function switchPlan(id: string) {
    if (dirty && !confirm(t.plan.prompts.switchDirty)) return
    const next = plans.find(p => p.id === id)
    if (!next) return
    setSelectedPlanId(id)
    applyPlan(next)
    setSelectedDay('')
    setDirty(false)
    setPlanMenuOpen(false)
  }

  async function createPlan(opts: { duplicate?: boolean }) {
    const baseName = opts.duplicate
      ? `${currentPlan?.name || t.plan.headerEyebrow}${t.plan.prompts.copySuffix}`
      : t.plan.prompts.newPlanDefaultName
    const name = prompt(t.plan.prompts.askNewPlanName, baseName)?.trim()
    if (!name) return
    const newPlan: PlanItem = {
      id: newPlanId(),
      name,
      createdAt: new Date().toISOString(),
      isActive: false,
      rows: opts.duplicate ? rows : [],
      dayOrder: opts.duplicate ? days : [],
    }
    setSaving(true)
    try {
      await apiFetch('/api/data/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan),
      })
      setPlans(prev => [newPlan, ...prev])
      setSelectedPlanId(newPlan.id)
      applyPlan(newPlan)
      setDirty(false)
    } catch {
      toast.error(t.common.saveFailed)
    } finally {
      setSaving(false)
      setPlanMenuOpen(false)
    }
  }

  async function activatePlan() {
    if (!currentPlan) return
    if (currentPlan.isActive) { setPlanMenuOpen(false); return }
    setSaving(true)
    try {
      await apiFetch(`/api/data/plans/${currentPlan.id}/activate`, { method: 'POST' })
      setPlans(prev => prev.map(p => ({ ...p, isActive: p.id === currentPlan.id })))
      void loadPlan(true)
    } catch {
      toast.error(t.common.saveFailed)
    } finally {
      setSaving(false)
      setPlanMenuOpen(false)
    }
  }

  async function deletePlan() {
    if (!currentPlan) return
    if (currentPlan.isActive) { alert(t.plan.errors.cantDeleteActive); return }
    if (!confirm(interpolate(t.plan.prompts.askDelete, { name: currentPlan.name }))) return
    setSaving(true)
    try {
      await apiFetch(`/api/data/plans/${currentPlan.id}`, { method: 'DELETE' })
      const remaining = plans.filter(p => p.id !== currentPlan.id)
      setPlans(remaining)
      const nextActive = remaining.find(p => p.isActive) || remaining[0]
      setSelectedPlanId(nextActive ? nextActive.id : '')
      applyPlan(nextActive)
      setDirty(false)
    } catch {
      toast.error(t.common.saveFailed)
    } finally {
      setSaving(false)
      setPlanMenuOpen(false)
    }
  }

  async function renamePlan() {
    if (!currentPlan) return
    const name = prompt(t.plan.prompts.askRename, currentPlan.name)?.trim()
    if (!name || name === currentPlan.name) { setPlanMenuOpen(false); return }
    const updated = { ...currentPlan, name }
    setSaving(true)
    try {
      await apiFetch(`/api/data/plans/${currentPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setPlans(prev => prev.map(p => p.id === currentPlan.id ? updated : p))
    } catch {
      toast.error(t.common.saveFailed)
    } finally {
      setSaving(false)
      setPlanMenuOpen(false)
    }
  }

  function addDayInline() {
    const name = newDayName.trim()
    if (!name) return
    setDays(d => (d.includes(name) ? d : [...d, name]))
    setSelectedDay(name)
    setNewDayName('')
    setShowAddDay(false)
    markDirty()
  }

  function addItem(day: string) {
    setDays(d => (d.includes(day) ? d : [...d, day]))
    setRows(r => {
      const dayRows = r.filter(row => row.day === day)
      const maxOrder = dayRows.length > 0 ? Math.max(...dayRows.map(row => row.order || 0)) : 0
      return [...r, {
        id: getNextRowId(r), day, exerciseId: '', targetSets: 5, targetReps: '5',
        targetRpe: 8, order: maxOrder + 1, note: '',
      }]
    })
    markDirty()
  }

  function delItem(id: string) { setRows(r => r.filter(row => row.id !== id)); markDirty() }

  function update(id: string, patch: Partial<Row>) {
    setRows(r => r.map(row => (row.id === id ? { ...row, ...patch } : row)))
    markDirty()
  }

  function move(id: string, dir: -1 | 1) {
    setRows(r => {
      const currentRow = r.find(x => x.id === id)
      if (!currentRow) return r
      const dayRows = r.filter(row => row.day === currentRow.day)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      const dayIdx = dayRows.findIndex(x => x.id === id)
      if (dayIdx === -1) return r
      const targetDayIdx = dayIdx + dir
      if (targetDayIdx < 0 || targetDayIdx >= dayRows.length) return r
      const targetRow = dayRows[targetDayIdx]
      const currentOrder = currentRow.order || 0
      const targetOrder = targetRow.order || 0
      return r.map(row => {
        if (row.id === id) return { ...row, order: targetOrder }
        if (row.id === targetRow.id) return { ...row, order: currentOrder }
        return row
      })
    })
    markDirty()
  }

  function renameDay(oldName: string) {
    const name = prompt(t.plan.prompts.askRenameDay, oldName)?.trim()
    if (!name || name === oldName) return
    // Renaming onto an existing day merges the two: keep that day's slot.
    setDays(d => (d.includes(name) ? d.filter(x => x !== oldName) : d.map(x => (x === oldName ? name : x))))
    setRows(r => r.map(row => (row.day === oldName ? { ...row, day: name } : row)))
    if (selectedDay === oldName) setSelectedDay(name)
    markDirty()
  }

  function moveDay(name: string, dir: -1 | 1) {
    const from = days.indexOf(name)
    const to = from + dir
    if (from === -1 || to < 0 || to >= days.length) return
    const next = [...days]
    next[from] = days[to]
    next[to] = name
    setDays(next)
    markDirty()
  }

  function removeDay(name: string) {
    if (!confirm(interpolate(t.plan.prompts.askRemoveDay, { name }))) return
    setDays(d => d.filter(x => x !== name))
    setRows(r => r.filter(row => row.day !== name))
    markDirty()
  }

  async function save() {
    if (!currentPlan) return
    try {
      setSaving(true)
      setError(null)
      const payload: PlanItem = {
        ...currentPlan,
        rows: rows.map(r => ({ ...r, targetRpe: r.targetRpe ?? null })),
        dayOrder: days,
      }
      await apiFetch(`/api/data/plans/${currentPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setPlans(prev => prev.map(p => p.id === currentPlan.id ? payload : p))
      setDirty(false)
      void loadPlan(true)
    } catch {
      toast.error(t.common.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const currentPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  )

  const dayRows = useMemo(
    () => rows.filter(r => r.day === selectedDay).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [rows, selectedDay]
  )
  const dayStats = useMemo(() => ({
    exercises: dayRows.length,
    sets: dayRows.reduce((acc, r) => acc + (r.targetSets || 0), 0),
    avgRpe: dayRows.length > 0
      ? (dayRows.reduce((acc, r) => acc + (r.targetRpe || 0), 0) / dayRows.filter(r => r.targetRpe).length || 0)
      : 0,
  }), [dayRows])

  if (loading || exercises.status !== 'success') {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-48 w-full" />
      </div>
    )
  }

  const isEmptyExercises = (exercises.data || []).length === 0

  return (
    <div className="space-y-5">
      {isEmptyExercises && (
        <section className="card p-4 border border-warning/30 bg-warning/5">
          <h3 className="text-sm font-semibold mb-1">{t.plan.seed.title}</h3>
          <p className="text-xs text-muted mb-3">{t.plan.seed.body}</p>
          <button
            onClick={runSeed}
            disabled={seeding}
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {seeding ? t.plan.seed.btnRunning : t.plan.seed.btn}
          </button>
          {seedError && (
            <p className="text-xs text-danger mt-2">{seedError}</p>
          )}
        </section>
      )}

      {/* PLAN SELECTOR */}
      <section className="card p-3">
        <div className="flex items-center gap-2">
          <select
            className="input flex-1 !py-2 !text-sm"
            value={selectedPlanId}
            onChange={e => switchPlan(e.target.value)}
            disabled={plans.length === 0}
          >
            {plans.length === 0 && <option value="">{t.plan.selectorEmpty}</option>}
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isActive ? t.plan.selectorActiveSuffix : ''}
              </option>
            ))}
          </select>
          <div className="relative">
            <button
              onClick={() => setPlanMenuOpen(v => !v)}
              className="btn-icon"
              title={t.plan.menuTitle}
            ><MoreHorizontal size={16} /></button>
            {planMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-10 w-56 bg-paper-card border border-ink/[0.08] rounded-xl shadow-lg overflow-hidden"
                onMouseLeave={() => setPlanMenuOpen(false)}
              >
                <MenuButton onClick={() => createPlan({})} icon={<Plus size={14} />} label={t.plan.menuNewEmpty} />
                <MenuButton onClick={() => createPlan({ duplicate: true })} icon={<Copy size={14} />} label={t.plan.menuDuplicate} disabled={!currentPlan} />
                <MenuButton onClick={activatePlan} icon={<Star size={14} />} label={t.plan.menuActivate} disabled={!currentPlan || currentPlan.isActive} />
                <MenuButton onClick={renamePlan} icon={<MoreHorizontal size={14} />} label={t.plan.menuRename} disabled={!currentPlan} />
                <MenuButton onClick={deletePlan} icon={<Trash2 size={14} />} label={t.plan.menuDelete} disabled={!currentPlan || currentPlan.isActive} danger />
              </div>
            )}
          </div>
        </div>
        {currentPlan && (
          <div className="text-[11px] text-muted mt-2 num">
            {t.plan.createdAt} {new Date(currentPlan.createdAt).toLocaleDateString(LOCALE[lang])}
            {currentPlan.isActive && <span className="ml-2 chip-accent !text-[10px]">{t.plan.activeChip}</span>}
          </div>
        )}
      </section>

      {/* HEADER */}
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">{currentPlan?.name || t.plan.headerEyebrow}</div>
          <h1 className="display text-[44px] leading-[0.95] tracking-tight2 mt-2">
            {selectedDay || t.plan.headerEyebrow}
          </h1>
          <p className="text-sm text-muted mt-2">
            {days.length} {t.plan.daysCount} · {rows.length} {t.plan.exercisesTotal}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !currentPlan || !dirty}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors
            ${dirty
              ? 'bg-accent-500 text-white hover:bg-accent-600'
              : 'bg-paper-sunken text-muted'}`}
          title={dirty ? t.plan.saveTooltipDirty : t.plan.saveTooltipClean}
        >
          {saving
            ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Check size={14} strokeWidth={2.6} />}
          {saving ? t.plan.saveBtnSaving : dirty ? t.plan.saveBtnDirty : t.plan.saveBtnClean}
        </button>
      </header>

      {error && (
        <div className="card p-3 text-sm text-danger bg-accent-50 border-accent-200">
          {error}
        </div>
      )}

      {/* DAY STRIP */}
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex items-start gap-2">
          {days.map((d, i) => {
            const isActive = d === selectedDay
            const count = rows.filter(r => r.day === d).length
            return (
              <div key={d} className="flex-shrink-0 w-[68px]">
                <button
                  onClick={() => setSelectedDay(d)}
                  onDoubleClick={() => renameDay(d)}
                  title={d}
                  className={`w-full h-[76px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all
                    ${isActive
                      ? 'bg-ink text-white'
                      : count === 0
                        ? 'bg-transparent border border-dashed border-ink/15 text-muted-2'
                        : 'bg-paper-card border border-ink/[0.06] text-ink'
                    }`}
                >
                  <span className="text-[9px] uppercase tracking-[0.12em] font-bold opacity-80">
                    {stripLabels[i]}
                  </span>
                  <span className="display text-xl leading-none num">{count || '—'}</span>
                  <span className="text-[9px] font-semibold opacity-70">
                    {count > 0 ? `${count} ${t.plan.dayStripExSuffix}` : t.plan.dayStripEmpty}
                  </span>
                </button>
                {isActive && days.length > 1 && (
                  <div className="flex justify-between mt-1">
                    <button
                      onClick={() => moveDay(d, -1)}
                      disabled={i === 0}
                      aria-label={t.plan.moveDayEarlier}
                      title={t.plan.moveDayEarlier}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-paper-card hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    ><ChevronLeft size={16} /></button>
                    <button
                      onClick={() => moveDay(d, 1)}
                      disabled={i === days.length - 1}
                      aria-label={t.plan.moveDayLater}
                      title={t.plan.moveDayLater}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-paper-card hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    ><ChevronRight size={16} /></button>
                  </div>
                )}
              </div>
            )
          })}
          {!showAddDay ? (
            <button
              onClick={() => setShowAddDay(true)}
              className="flex-shrink-0 w-[68px] h-[76px] rounded-2xl border border-dashed border-ink/15 text-muted-2 flex items-center justify-center"
            ><Plus size={18} /></button>
          ) : (
            <div className="flex-shrink-0 h-[76px] flex items-center gap-1 bg-paper-card rounded-2xl px-2 border border-ink/[0.06]">
              <input
                value={newDayName}
                onChange={e => setNewDayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDayInline()}
                placeholder={t.plan.dayNamePlaceholder}
                className="bg-transparent text-sm w-24 py-2 focus:outline-none"
                autoFocus
              />
              <button onClick={addDayInline} className="text-accent-500 font-semibold text-sm">OK</button>
            </div>
          )}
        </div>
      </div>

      {/* DAY STATS */}
      {dayRows.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <DayStat label={t.plan.dayStatExercises} value={dayStats.exercises} />
          <DayStat label={t.plan.dayStatSets} value={dayStats.sets} />
          <DayStat label={t.plan.dayStatRpe} value={dayStats.avgRpe > 0 ? dayStats.avgRpe.toFixed(1) : '—'} />
          <DayStat label={t.plan.dayStatEst} value={`${Math.round(dayStats.sets * 2.5)}${t.plan.minutesShort}`} />
        </div>
      )}

      {/* VOLUME WARNINGS */}
      {sessionWarnings.length > 0 && (
        <section className="card p-4 bg-accent-50/40 border-accent-200">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle size={14} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-accent-700">
                {t.plan.sessionWarningsTitle}
              </div>
              <p className="text-xs text-accent-600 mt-1">
                {t.plan.sessionWarningsBody}
              </p>
              <div className="space-y-1.5 mt-3">
                {sessionWarnings.slice(0, 3).map((w, i) => (
                  <div key={i} className="text-xs text-accent-600 bg-white/60 rounded-lg p-2">
                    <strong>{w.day}</strong> · <strong>{t.muscles[w.muscle] || w.muscleName}</strong>: {w.sets} {interpolate(t.plan.sessionWarningsLimit, { limit: w.limit })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* EXERCISES OF DAY */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="display text-2xl">
            {dayRows.length} {dayRows.length === 1 ? t.plan.exerciseSingular : t.plan.exercisePlural},{' '}
            <span className="italic text-muted">~{Math.round(dayStats.sets * 2.5)} {t.plan.minutesApprox}</span>
          </h3>
          {selectedDay && (
            <button
              onClick={() => removeDay(selectedDay)}
              className="text-[11px] text-muted hover:text-danger transition-colors"
            >{t.plan.deleteDayBtn}</button>
          )}
        </div>

        <div className="space-y-2">
          {dayRows.map((r) => {
            const exercise = exById.get(r.exerciseId)
            const name = exercise?.name
            const isExpanded = expandedRow === r.id
            return (
              <div key={r.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-ink text-white text-[11px] font-bold flex items-center justify-center num shrink-0">
                    {(dayRows.indexOf(r) + 1).toString().padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[15px] text-ink truncate">
                      {name || <span className="italic text-muted-2">{t.plan.rowSelectExercise}</span>}
                    </div>
                    <div className="text-xs text-muted mt-0.5 num">
                      {r.targetSets} {t.plan.rowSets.toLowerCase()} · {r.targetReps} {t.plan.rowReps.toLowerCase()}
                      {r.targetRpe ? ` · ${t.plan.rowRpe} ${r.targetRpe}` : ''}
                    </div>
                    {exercise?.primaryMuscles?.length ? (
                      <div className="mt-1.5">
                        <MuscleChips primaryMuscles={exercise.primaryMuscles} size="sm" />
                      </div>
                    ) : null}
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-2" /> : <ChevronDown size={16} className="text-muted-2" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ink/[0.06]">
                    <div>
                      <label className="label">{t.plan.rowExercise}</label>
                      <select
                        className="input mt-1"
                        value={r.exerciseId}
                        onChange={e => update(r.id, { exerciseId: e.target.value })}
                      >
                        <option value="">{t.plan.rowSelectPlaceholder}</option>
                        {(exercises.data || []).map((e: Exercise) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label">{t.plan.rowSets}</label>
                        <input className="input mt-1 text-center num" inputMode="numeric"
                          value={r.targetSets}
                          onChange={e => update(r.id, { targetSets: Number(e.target.value || 0) })} />
                      </div>
                      <div>
                        <label className="label">{t.plan.rowReps}</label>
                        <input className="input mt-1 text-center num" placeholder={t.plan.rowRepsPlaceholder}
                          value={r.targetReps}
                          onChange={e => update(r.id, { targetReps: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">{t.plan.rowRpe}</label>
                        <input className="input mt-1 text-center num" inputMode="decimal" placeholder={t.plan.rowRpePlaceholder}
                          value={r.targetRpe ?? ''}
                          onChange={e => update(r.id, { targetRpe: e.target.value ? Number(e.target.value) : null })} />
                      </div>
                    </div>
                    <div>
                      <label className="label">{t.plan.rowNote}</label>
                      <input className="input mt-1" placeholder={t.plan.rowNotePlaceholder}
                        value={r.note ?? ''}
                        onChange={e => update(r.id, { note: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-icon" onClick={() => move(r.id, -1)} title={t.plan.rowMoveUp}>
                        <ArrowUp size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => move(r.id, 1)} title={t.plan.rowMoveDown}>
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="btn-ghost text-danger ml-auto text-sm"
                        onClick={() => delItem(r.id)}
                      >
                        <Trash2 size={14} /> {t.plan.rowRemove}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {selectedDay && (
            <button
              onClick={() => addItem(selectedDay)}
              className="w-full py-3.5 rounded-2xl border border-dashed border-ink/15 text-muted font-medium text-sm
                         hover:bg-paper-card hover:text-ink transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} /> {t.plan.addExerciseBtn}
            </button>
          )}
        </div>
      </section>

      {/* COMPLETENESS */}
      {planSummary.length > 0 && (
        <section className="card p-4">
          <h3 className="text-sm font-semibold mb-3">{t.plan.coverageTitle}</h3>
          <div className="grid grid-cols-3 gap-2">
            {planSummary.map(({ muscle, totalSets, status }) => {
              const badge = getCompletenessStatusBadge(status)
              const tone =
                status === 'complete' ? 'bg-success/10 text-success'
                  : status === 'minimal' ? 'bg-warning/10 text-warning'
                    : status === 'insufficient' ? 'bg-paper-sunken text-danger'
                      : 'bg-paper-sunken text-muted'
              return (
                <div key={muscle} className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${tone}`}>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium">{t.muscles[muscle] || muscle}</span>
                    <span className="text-[10px] opacity-70 num">{totalSets} {t.plan.coverageSetsSuffix}</span>
                  </div>
                  <span className="text-base">{badge}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* SETTINGS */}
      <section className="card overflow-hidden">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{t.plan.settings}</span>
            {deloadActive && <span className="chip-accent">{t.plan.deloadChip}</span>}
          </div>
          {showSettings ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </button>

        {showSettings && (
          <div className="px-4 pb-4 space-y-4 border-t border-ink/[0.06] pt-4">
            <div>
              <label className="label mb-2 block">{t.plan.trainingModeLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(t.trainingModes) as TrainingMode[]).map(mode => {
                  const { label, desc } = t.trainingModes[mode]
                  return (
                    <button
                      key={mode}
                      onClick={async () => { if (!(await setTrainingMode(mode))) toast.error(t.common.saveFailed) }}
                      className={`p-2.5 rounded-xl text-left transition-all ${
                        trainingMode === mode
                          ? 'bg-ink text-white'
                          : 'bg-paper-sunken text-ink hover:bg-paper-card'
                      }`}
                    >
                      <div className="text-xs font-semibold">{label}</div>
                      <div className={`text-[10px] mt-0.5 ${trainingMode === mode ? 'opacity-70' : 'text-muted'}`}>{desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-paper-sunken">
              <div className="flex-1 pr-3">
                <div className="text-sm font-medium">{t.plan.deloadTitle}</div>
                <div className="text-xs text-muted mt-0.5">{t.plan.deloadDesc}</div>
              </div>
              <button
                onClick={async () => { if (!(await setDeloadActive(!deloadActive))) toast.error(t.common.saveFailed) }}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                  deloadActive ? 'bg-accent-500' : 'bg-ink/15'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  deloadActive ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* COACH AI */}
      {planSummary.length > 0 && exercises.status === 'success' && (
        <WorkoutAIChat
          mode="plan"
          planSummary={planSummary}
          exercises={exercises.data || []}
          plan={rows.map(r => ({
            day: r.day, exerciseId: r.exerciseId, targetSets: r.targetSets,
            targetReps: r.targetReps, targetRpe: r.targetRpe ?? undefined, note: r.note,
          }))}
          weekSessions={weeklyData.weekSessions}
          weekSets={weeklyData.weekSets}
          trainingMode={trainingMode}
          dayOrder={days}
        />
      )}
    </div>
  )
}

function DayStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-3">
      <div className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted">{label}</div>
      <div className="display text-2xl leading-none num mt-1.5">{value}</div>
    </div>
  )
}

function MenuButton({ icon, label, onClick, disabled, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors
        ${disabled
          ? 'text-muted-2 cursor-not-allowed'
          : danger
            ? 'text-danger hover:bg-danger/10'
            : 'text-ink hover:bg-paper-sunken'}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
    </button>
  )
}
