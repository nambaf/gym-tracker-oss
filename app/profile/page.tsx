'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDataStore } from '@/store/data'
import { mergeWithDefaults } from '@/lib/settings/effective'
import type { TrainingMode } from '@/lib/hypertrophyThresholds'
import type { Settings, ThresholdsMatrix, RecommendedSetsMatrix } from '@/lib/settings/types'
import { MuscleGroup } from '@/lib/bodyMapUtils'
import { useT } from '@/lib/i18n/I18nProvider'
import { LangSwitcher } from '@/components/LangSwitcher'

const TRAINING_MODES: readonly TrainingMode[] = ['intensity', 'volume', 'mixed']
const MUSCLE_GROUPS = Object.values(MuscleGroup) as MuscleGroup[]

interface ProfileForm {
  // basic
  athleteProfile: string
  athleteNotes: string
  trainingMode: TrainingMode
  deloadActive: boolean
  // advanced
  maxSetsPerSessionPerMuscle: number
  restCompoundSec: number
  restStandardSec: number
  restIsolationSec: number
  /** Raw comma-separated input — parsed into string[] on save. */
  compoundMuscles: string
  isolationMuscles: string
  // matrices
  thresholdsByMode: ThresholdsMatrix
  recommendedSets: RecommendedSetsMatrix
}

function deriveForm(stored: Partial<Settings>): ProfileForm {
  const e = mergeWithDefaults(stored)
  return {
    athleteProfile: e.athleteProfile,
    athleteNotes: e.athleteNotes,
    trainingMode: e.trainingMode,
    deloadActive: e.deloadActive,
    maxSetsPerSessionPerMuscle: e.maxSetsPerSessionPerMuscle,
    restCompoundSec: e.restCompoundSec,
    restStandardSec: e.restStandardSec,
    restIsolationSec: e.restIsolationSec,
    compoundMuscles: e.compoundMuscles.join(', '),
    isolationMuscles: e.isolationMuscles.join(', '),
    thresholdsByMode: e.thresholdsByMode,
    recommendedSets: e.recommendedSets,
  }
}

function parseMuscleList(raw: string): string[] {
  return raw.split(',').map(m => m.trim().toLowerCase()).filter(Boolean)
}

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ProfilePage() {
  const t = useT()
  const { storedSettings, loadSettings, setSettings } = useDataStore()
  const [form, setForm] = useState<ProfileForm>(() => deriveForm(storedSettings))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Re-sync the form when storedSettings changes (load completes, or reset clears overrides).
  useEffect(() => {
    setForm(deriveForm(storedSettings))
  }, [storedSettings])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      await setSettings({
        athleteProfile: form.athleteProfile,
        athleteNotes: form.athleteNotes,
        trainingMode: form.trainingMode,
        deloadActive: form.deloadActive,
        maxSetsPerSessionPerMuscle: form.maxSetsPerSessionPerMuscle,
        restCompoundSec: form.restCompoundSec,
        restStandardSec: form.restStandardSec,
        restIsolationSec: form.restIsolationSec,
        compoundMuscles: parseMuscleList(form.compoundMuscles),
        isolationMuscles: parseMuscleList(form.isolationMuscles),
        thresholdsByMode: form.thresholdsByMode,
        recommendedSets: form.recommendedSets,
      })
      toast.success(t.profile.saved)
    } catch (_e) {
      toast.error(t.profile.errorGeneric)
    } finally {
      setSaving(false)
    }
  }

  async function handleResetBasic() {
    if (!confirm(t.profile.resetConfirm)) return
    try {
      await setSettings({
        athleteProfile: undefined,
        athleteNotes: undefined,
        trainingMode: undefined,
        deloadActive: undefined,
      })
      toast.success(t.profile.saved)
    } catch (_e) {
      toast.error(t.profile.errorGeneric)
    }
  }

  async function handleResetAdvanced() {
    if (!confirm(t.profile.resetConfirm)) return
    try {
      await setSettings({
        maxSetsPerSessionPerMuscle: undefined,
        restCompoundSec: undefined,
        restStandardSec: undefined,
        restIsolationSec: undefined,
        compoundMuscles: undefined,
        isolationMuscles: undefined,
      })
      toast.success(t.profile.saved)
    } catch (_e) {
      toast.error(t.profile.errorGeneric)
    }
  }

  async function handleResetThresholds() {
    if (!confirm(t.profile.resetConfirm)) return
    try {
      await setSettings({ thresholdsByMode: undefined })
      toast.success(t.profile.saved)
    } catch (_e) {
      toast.error(t.profile.errorGeneric)
    }
  }

  async function handleResetRecommendedSets() {
    if (!confirm(t.profile.resetConfirm)) return
    try {
      await setSettings({ recommendedSets: undefined })
      toast.success(t.profile.saved)
    } catch (_e) {
      toast.error(t.profile.errorGeneric)
    }
  }

  const modes = Object.keys(t.trainingModes) as TrainingMode[]

  return (
    <div className="space-y-5 pb-24">
      <header>
        <h1 className="display text-3xl leading-tight">{t.profile.title}</h1>
        <p className="text-sm text-muted mt-2">{t.profile.subtitle}</p>
      </header>

      {/* LANGUAGE — writes cookie + reloads; unsaved form changes are lost */}
      <section className="card p-4">
        <LangSwitcher />
      </section>

      {/* BASIC */}
      <section className="card p-4 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider">{t.profile.sectionBasic}</h2>
          <button
            type="button"
            onClick={handleResetBasic}
            className="text-xs text-muted hover:text-ink underline underline-offset-4"
          >
            {t.profile.resetSection}
          </button>
        </div>

        <div>
          <label htmlFor="athlete-profile" className="label mb-1 block">
            {t.profile.basic.athleteProfile.label}
          </label>
          <textarea
            id="athlete-profile"
            rows={3}
            value={form.athleteProfile}
            onChange={e => setForm(f => ({ ...f, athleteProfile: e.target.value }))}
            placeholder={t.profile.basic.athleteProfile.placeholder}
            className="input w-full text-sm"
          />
          <p className="text-[11px] text-muted mt-1">{t.profile.basic.athleteProfile.helper}</p>
        </div>

        <div>
          <label htmlFor="athlete-notes" className="label mb-1 block">
            {t.profile.basic.athleteNotes.label}
          </label>
          <textarea
            id="athlete-notes"
            rows={3}
            value={form.athleteNotes}
            onChange={e => setForm(f => ({ ...f, athleteNotes: e.target.value }))}
            placeholder={t.profile.basic.athleteNotes.placeholder}
            className="input w-full text-sm"
          />
          <p className="text-[11px] text-muted mt-1">{t.profile.basic.athleteNotes.helper}</p>
        </div>

        <div>
          <label className="label mb-2 block">{t.profile.basic.trainingMode.label}</label>
          <div className="grid grid-cols-3 gap-2">
            {modes.map(mode => {
              const { label, desc } = t.trainingModes[mode]
              const active = form.trainingMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, trainingMode: mode }))}
                  className={`p-2.5 rounded-xl text-left transition-all ${
                    active ? 'bg-ink text-white' : 'bg-paper-sunken text-ink hover:bg-paper-card'
                  }`}
                >
                  <div className="text-xs font-semibold">{label}</div>
                  <div className={`text-[10px] mt-0.5 ${active ? 'opacity-70' : 'text-muted'}`}>{desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-paper-sunken">
          <div className="flex-1 pr-3">
            <div className="text-sm font-medium">{t.profile.basic.deload.label}</div>
            <div className="text-xs text-muted mt-0.5">{t.profile.basic.deload.helper}</div>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, deloadActive: !f.deloadActive }))}
            aria-pressed={form.deloadActive}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
              form.deloadActive ? 'bg-accent-500' : 'bg-ink/15'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              form.deloadActive ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>
      </section>

      {/* ADVANCED */}
      <section className="card p-4 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider">{t.profile.sectionAdvanced}</h2>
          <button
            type="button"
            onClick={handleResetAdvanced}
            className="text-xs text-muted hover:text-ink underline underline-offset-4"
          >
            {t.profile.resetSection}
          </button>
        </div>

        <div>
          <label htmlFor="max-sets" className="label mb-1 block">
            {t.profile.advanced.maxSetsPerSession.label}
          </label>
          <input
            id="max-sets"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            step={1}
            value={form.maxSetsPerSessionPerMuscle}
            onChange={e => setForm(f => ({ ...f, maxSetsPerSessionPerMuscle: Number(e.target.value) }))}
            className="input w-32 text-sm"
          />
          <p className="text-[11px] text-muted mt-1">{t.profile.advanced.maxSetsPerSession.helper}</p>
        </div>

        <RestField
          id="rest-compound"
          label={t.profile.advanced.restCompound.label}
          helper={t.profile.advanced.restCompound.helper}
          suffix={t.profile.advanced.restSecondsSuffix}
          value={form.restCompoundSec}
          onChange={v => setForm(f => ({ ...f, restCompoundSec: v }))}
        />
        <RestField
          id="rest-standard"
          label={t.profile.advanced.restStandard.label}
          helper={t.profile.advanced.restStandard.helper}
          suffix={t.profile.advanced.restSecondsSuffix}
          value={form.restStandardSec}
          onChange={v => setForm(f => ({ ...f, restStandardSec: v }))}
        />
        <RestField
          id="rest-isolation"
          label={t.profile.advanced.restIsolation.label}
          helper={t.profile.advanced.restIsolation.helper}
          suffix={t.profile.advanced.restSecondsSuffix}
          value={form.restIsolationSec}
          onChange={v => setForm(f => ({ ...f, restIsolationSec: v }))}
        />

        <div>
          <label htmlFor="compound-muscles" className="label mb-1 block">
            {t.profile.advanced.compoundMuscles.label}
          </label>
          <input
            id="compound-muscles"
            type="text"
            value={form.compoundMuscles}
            onChange={e => setForm(f => ({ ...f, compoundMuscles: e.target.value }))}
            placeholder={t.profile.advanced.compoundMuscles.placeholder}
            className="input w-full text-sm"
          />
          <p className="text-[11px] text-muted mt-1">{t.profile.advanced.compoundMuscles.helper}</p>
        </div>

        <div>
          <label htmlFor="isolation-muscles" className="label mb-1 block">
            {t.profile.advanced.isolationMuscles.label}
          </label>
          <input
            id="isolation-muscles"
            type="text"
            value={form.isolationMuscles}
            onChange={e => setForm(f => ({ ...f, isolationMuscles: e.target.value }))}
            placeholder={t.profile.advanced.isolationMuscles.placeholder}
            className="input w-full text-sm"
          />
          <p className="text-[11px] text-muted mt-1">{t.profile.advanced.isolationMuscles.helper}</p>
        </div>
      </section>

      {/* ADVANCED MATRICES */}
      <section className="card p-4 space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider">{t.profile.sectionMatrices}</h2>

        {/* Hypertrophy thresholds */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium">{t.profile.matrices.thresholds.title}</h3>
              <p className="text-[11px] text-muted mt-1">{t.profile.matrices.thresholds.helper}</p>
            </div>
            <button
              type="button"
              onClick={handleResetThresholds}
              className="text-xs text-muted hover:text-ink underline underline-offset-4 shrink-0"
            >
              {t.profile.resetSection}
            </button>
          </div>
          <MatrixEditor
            value={form.thresholdsByMode}
            onChange={m => setForm(f => ({ ...f, thresholdsByMode: m as ThresholdsMatrix }))}
            fieldA="maintenance"
            fieldB="hypertrophy"
            labelA={t.profile.matrices.thresholds.fieldA}
            labelB={t.profile.matrices.thresholds.fieldB}
            muscleLabels={t.muscles}
            modeLabels={t.trainingModes}
          />
        </div>

        {/* Recommended sets */}
        <div className="space-y-3 pt-4 border-t border-ink/[0.06]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium">{t.profile.matrices.recommendedSets.title}</h3>
              <p className="text-[11px] text-muted mt-1">{t.profile.matrices.recommendedSets.helper}</p>
            </div>
            <button
              type="button"
              onClick={handleResetRecommendedSets}
              className="text-xs text-muted hover:text-ink underline underline-offset-4 shrink-0"
            >
              {t.profile.resetSection}
            </button>
          </div>
          <MatrixEditor
            value={form.recommendedSets}
            onChange={m => setForm(f => ({ ...f, recommendedSets: m as RecommendedSetsMatrix }))}
            fieldA="minimal"
            fieldB="optimal"
            labelA={t.profile.matrices.recommendedSets.fieldA}
            labelB={t.profile.matrices.recommendedSets.fieldB}
            muscleLabels={t.muscles}
            modeLabels={t.trainingModes}
          />
        </div>
      </section>

      {/* SAVE bar */}
      <div className="fixed bottom-[60px] inset-x-0 z-30 safe-area-bottom bg-paper/85 backdrop-blur-lg border-t border-ink/[0.06]">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? t.profile.saving : t.profile.save}
          </button>
        </div>
      </div>
    </div>
  )
}

function RestField({
  id,
  label,
  helper,
  suffix,
  value,
  onChange,
}: {
  id: string
  label: string
  helper: string
  suffix: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={10}
          max={900}
          step={5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="input w-24 text-sm"
        />
        <span className="text-xs text-muted">{suffix}</span>
        <span className="text-xs text-muted ml-auto num">{formatSec(value)}</span>
      </div>
      <p className="text-[11px] text-muted mt-1">{helper}</p>
    </div>
  )
}

type MatrixValue = Record<TrainingMode, Record<MuscleGroup, Record<string, number>>>

function MatrixEditor({
  value,
  onChange,
  fieldA,
  fieldB,
  labelA,
  labelB,
  muscleLabels,
  modeLabels,
}: {
  value: MatrixValue
  onChange: (next: MatrixValue) => void
  fieldA: string
  fieldB: string
  labelA: string
  labelB: string
  muscleLabels: Record<string, string>
  modeLabels: Record<TrainingMode, { label: string; desc: string }>
}) {
  const [activeMode, setActiveMode] = useState<TrainingMode>('mixed')

  function updateCell(muscle: MuscleGroup, field: string, n: number) {
    const next = structuredClone(value)
    next[activeMode][muscle][field] = n
    onChange(next)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1 p-1 bg-paper-sunken rounded-xl">
        {TRAINING_MODES.map(m => {
          const active = activeMode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMode(m)}
              className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors ${
                active ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {modeLabels[m].label}
            </button>
          )
        })}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted px-1">
          <div className="flex-1" />
          <div className="w-16 text-center">{labelA}</div>
          <div className="w-16 text-center">{labelB}</div>
        </div>
        {MUSCLE_GROUPS.map(m => (
          <div key={m} className="flex items-center gap-2">
            <div className="flex-1 text-sm min-w-0 truncate">{muscleLabels[m] || m}</div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              step={1}
              value={value[activeMode][m][fieldA]}
              onChange={e => updateCell(m, fieldA, Number(e.target.value))}
              className="input w-16 text-sm text-center !py-1.5 num"
              aria-label={`${muscleLabels[m] || m} — ${labelA}`}
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              step={1}
              value={value[activeMode][m][fieldB]}
              onChange={e => updateCell(m, fieldB, Number(e.target.value))}
              className="input w-16 text-sm text-center !py-1.5 num"
              aria-label={`${muscleLabels[m] || m} — ${labelB}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
