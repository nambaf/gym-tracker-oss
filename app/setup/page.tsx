'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { useDataStore } from '@/store/data'
import { useT } from '@/lib/i18n/I18nProvider'

export default function SetupPage() {
  const t = useT()
  const router = useRouter()
  const {
    exercises, plan, storedSettings,
    loadExercises, loadPlan, loadSettings, invalidate,
  } = useDataStore()

  const [seedingExercises, setSeedingExercises] = useState(false)
  const [exercisesError, setExercisesError] = useState<string | null>(null)
  const [seedingPlan, setSeedingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [initingSettings, setInitingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    loadExercises()
    loadPlan()
    loadSettings()
  }, [loadExercises, loadPlan, loadSettings])

  const exercisesLoaded = exercises.status === 'success'
  const planLoaded = plan.status === 'success'
  const exercisesDone = exercisesLoaded && (exercises.data || []).length > 0
  const planDone = planLoaded && (plan.data || []).length > 0
  const settingsDone = storedSettings.id === 'global'
  const allDone = exercisesDone && planDone && settingsDone

  async function runSeedExercises() {
    if (seedingExercises) return
    setExercisesError(null)
    setSeedingExercises(true)
    try {
      const res = await fetch('/api/data/exercises/seed', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      invalidate(['exercises'])
      await loadExercises(true)
    } catch (_e) {
      setExercisesError(t.setup.exercises.errorGeneric)
    } finally {
      setSeedingExercises(false)
    }
  }

  async function runSeedPlan() {
    if (seedingPlan || !exercisesDone) return
    setPlanError(null)
    setSeedingPlan(true)
    try {
      const res = await fetch('/api/data/plans/seed', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      invalidate(['plan'])
      await loadPlan(true)
    } catch (_e) {
      setPlanError(t.setup.plan.errorGeneric)
    } finally {
      setSeedingPlan(false)
    }
  }

  async function runInitSettings() {
    if (initingSettings) return
    setSettingsError(null)
    setInitingSettings(true)
    try {
      const res = await fetch('/api/data/settings/init', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      await loadSettings(true)
    } catch (_e) {
      setSettingsError(t.setup.settings.errorGeneric)
    } finally {
      setInitingSettings(false)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-3xl leading-tight">{t.setup.title}</h1>
        <p className="text-sm text-muted mt-2">{t.setup.subtitle}</p>
      </header>

      <SetupCard
        title={t.setup.exercises.title}
        body={t.setup.exercises.body}
        done={exercisesDone}
        statusPending={t.setup.statusPending}
        statusDone={t.setup.statusDone}
      >
        {!exercisesDone && (
          <button
            onClick={runSeedExercises}
            disabled={seedingExercises}
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {seedingExercises ? t.setup.exercises.btnRunning : t.setup.exercises.btn}
          </button>
        )}
        {exercisesError && <p className="text-xs text-danger mt-2">{exercisesError}</p>}
      </SetupCard>

      <SetupCard
        title={t.setup.plan.title}
        body={t.setup.plan.body}
        done={planDone}
        statusPending={t.setup.statusPending}
        statusDone={t.setup.statusDone}
      >
        {!planDone && (
          <>
            <button
              onClick={runSeedPlan}
              disabled={seedingPlan || !exercisesDone}
              className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {seedingPlan ? t.setup.plan.btnRunning : t.setup.plan.btn}
            </button>
            {!exercisesDone && (
              <p className="text-xs text-muted mt-2">{t.setup.plan.blockedNoExercises}</p>
            )}
          </>
        )}
        {planError && <p className="text-xs text-danger mt-2">{planError}</p>}
      </SetupCard>

      <SetupCard
        title={t.setup.settings.title}
        body={t.setup.settings.body}
        done={settingsDone}
        statusPending={t.setup.statusPending}
        statusDone={t.setup.statusDone}
      >
        {!settingsDone && (
          <button
            onClick={runInitSettings}
            disabled={initingSettings}
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {initingSettings ? t.setup.settings.btnRunning : t.setup.settings.btn}
          </button>
        )}
        {settingsError && <p className="text-xs text-danger mt-2">{settingsError}</p>}
      </SetupCard>

      <div className="pt-2">
        {allDone ? (
          <div className="card p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t.setup.allDone}</p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              {t.setup.allDoneCta} <ArrowRight size={14} strokeWidth={2.2} />
            </button>
          </div>
        ) : (
          <Link href="/" className="text-sm text-muted underline underline-offset-4">
            {t.setup.skip}
          </Link>
        )}
      </div>
    </div>
  )
}

function SetupCard({
  title,
  body,
  done,
  statusPending,
  statusDone,
  children,
}: {
  title: string
  body: string
  done: boolean
  statusPending: string
  statusDone: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {done ? (
            <CheckCircle2 size={20} className="text-accent-500" strokeWidth={2.2} />
          ) : (
            <Circle size={20} className="text-muted" strokeWidth={2} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${done ? 'text-accent-500' : 'text-muted'}`}>
              {done ? statusDone : statusPending}
            </span>
          </div>
          <p className="text-xs text-muted mt-1 mb-3">{body}</p>
          {children}
        </div>
      </div>
    </section>
  )
}
