'use client'
import React, { useMemo } from 'react'
import { useDataStore } from '@/store/data'
import { getExerciseProgress } from '@/lib/deload'
import { PlanRow } from '@/lib/models'
import { useT } from '@/lib/i18n/I18nProvider'

export default function ProgressModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { plan, sets, exercises } = useDataStore()

  const progressData = useMemo(() => {
    if (plan.status !== 'success' || !plan.data || sets.status !== 'success' || !sets.data || exercises.status !== 'success' || !exercises.data) return []

    const uniqueExerciseIds = Array.from(new Set(plan.data.map((r: PlanRow) => r.exerciseId)))
    const exMap = new Map(exercises.data.map(e => [e.id, e.name]))

    return uniqueExerciseIds
      .map(id => {
        const progress = getExerciseProgress(id, sets.data as any)
        return {
          id,
          name: exMap.get(id) || id,
          progress,
        }
      })
      .filter(item => item.progress !== null)
  }, [plan, sets, exercises])

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-white/50 dark:bg-black/50 backdrop-blur">
          <h2 className="text-xl font-bold">{t.progressModal.title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {progressData.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <div className="text-4xl mb-4">📈</div>
              <p>{t.progressModal.empty}</p>
              <p className="text-sm">{t.progressModal.emptySubtitle}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {progressData.map(({ id, name, progress }) => (
                <div key={id} className="card p-4 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{name}</h3>
                    <StatusBadge status={progress!.status} trend={progress!.trend} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                      <div className="text-neutral-500 text-xs mb-1">{t.progressModal.currentE1rm}</div>
                      <div className="font-bold text-base">{progress!.lastE1RM} <span className="text-xs font-normal">kg</span></div>
                    </div>
                    <div className="p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                      <div className="text-neutral-500 text-xs mb-1">{t.progressModal.avgE1rm}</div>
                      <div className="font-bold text-base">{progress!.avgE1RM} <span className="text-xs font-normal">kg</span></div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all ${progress!.status === 'improving' ? 'bg-green-500' :
                          progress!.status === 'declining' ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                        style={{ width: `${Math.min(100, Math.max(10, 50 + progress!.trend * 2))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t.progressModal.footnote}
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status, trend }: { status: string; trend: number }) {
  const t = useT()
  const configs: Record<string, { label: string; color: string; icon: string }> = {
    improving: {
      label: t.progressModal.badgeImproving,
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: '📈',
    },
    stable: {
      label: t.progressModal.badgeStable,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: '📊',
    },
    declining: {
      label: t.progressModal.badgeDeclining,
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      icon: '📉',
    },
  }

  const config = configs[status] || configs.stable

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label} ({trend > 0 ? `+${trend}` : trend}%)</span>
    </div>
  )
}
