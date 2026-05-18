'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { WeeklyVolumeData, MuscleVolumeData } from '@/lib/bodyMapUtils'
import { getVolumeStatus, getVolumeStatusColor, getThresholdsForMode, type TrainingMode } from '@/lib/hypertrophyThresholds'
import { useDataStore } from '@/store/data'
import { useT } from '@/lib/i18n/I18nProvider'

interface VolumeChartProps {
  weeklyData: WeeklyVolumeData[]
  muscleVolumeData?: MuscleVolumeData[]
  period: 'week' | 'month'
  trainingMode?: TrainingMode
}

export function VolumeChart({ weeklyData, muscleVolumeData, period, trainingMode = 'mixed' }: VolumeChartProps) {
  const t = useT()
  const thresholdsByMode = useDataStore(s => s.storedSettings.thresholdsByMode)

  if (weeklyData.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">{t.volumeChart.title}</h3>
        <div className="text-center py-8 text-muted">
          {t.volumeChart.emptyState}
        </div>
      </div>
    )
  }

  const thresholds = getThresholdsForMode(trainingMode, thresholdsByMode)
  const weeksCount = period === 'week' ? 4 : 12

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-2">{t.volumeChart.title}</h3>
      <p className="text-sm text-muted mb-4">
        {t.volumeChart.subtitleTemplate.replace('{n}', String(weeksCount))}
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1916" opacity={0.06} />
          <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#6b6962' }} stroke="#a8a59c" />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b6962' }}
            stroke="#a8a59c"
            label={{ value: t.volumeChart.yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#6b6962' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1916', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 12 }}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            formatter={(value: number, name: string) => {
              if (name === 'sets') return [value, t.volumeChart.tooltipSets]
              if (name === 'volume') return [value.toLocaleString() + ' kg·rep', t.volumeChart.tooltipVolume]
              return [value, name]
            }}
          />
          <Bar dataKey="sets" fill="#d6492a" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 flex gap-4 justify-center text-sm text-muted">
        <div>
          <span className="font-semibold text-ink num">
            {weeklyData.reduce((sum, w) => sum + w.sets, 0)}
          </span> {t.volumeChart.totalSets}
        </div>
        <div>
          <span className="font-semibold text-ink num">
            {Math.round(weeklyData.reduce((sum, w) => sum + w.sets, 0) / weeklyData.length)}
          </span> {t.volumeChart.avgPerWeek}
        </div>
      </div>

      {muscleVolumeData && muscleVolumeData.length > 0 && (
        <div className="mt-6 border-t border-ink/[0.06] pt-4">
          <h4 className="font-semibold mb-3">{t.volumeChart.breakdownTitle}</h4>
          <p className="text-xs text-muted mb-3">{t.volumeChart.breakdownSubtitle}</p>
          <div className="space-y-2">
            {muscleVolumeData.map(({ muscle, sets }) => {
              const hardSets = Math.round(sets)
              const status = getVolumeStatus(muscle, hardSets, trainingMode, thresholdsByMode)
              const statusColor = getVolumeStatusColor(status)
              const statusBadge = t.volumeChart.statusBadge[status]
              const threshold = thresholds[muscle]
              const percentage = threshold ? Math.round((hardSets / threshold.hypertrophy) * 100) : 0

              return (
                <div key={muscle} className="flex items-center justify-between p-3 rounded-xl bg-paper-sunken">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.muscles[muscle] || muscle}</span>
                      <span className={`text-xs ${statusColor}`}>{statusBadge}</span>
                    </div>
                    <div className="text-xs text-muted mt-1">
                      <span className="num">{hardSets}</span> {t.volumeChart.hardSets}
                      {status !== 'hypertrophy' && threshold && (
                        <span className="ml-2">
                          {t.volumeChart.targetPrefix} <span className="num">{threshold.hypertrophy}</span> {t.volumeChart.targetSuffix}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold num ${statusColor}`}>{percentage}%</div>
                  </div>
                </div>
              )
            })}
          </div>

          {muscleVolumeData.some(({ muscle, sets }) => getVolumeStatus(muscle, Math.round(sets), trainingMode, thresholdsByMode) === 'insufficient') && (
            <div className="mt-4 p-4 bg-paper-sunken rounded-xl border-l-4 border-danger">
              <h5 className="font-semibold text-danger mb-2">{t.volumeChart.warnInsufficientTitle}</h5>
              <p className="text-sm text-ink-soft mb-2">{t.volumeChart.warnInsufficientBody}</p>
              <ul className="text-sm text-ink-soft space-y-1">
                {muscleVolumeData
                  .filter(({ muscle, sets }) => getVolumeStatus(muscle, Math.round(sets), trainingMode, thresholdsByMode) === 'insufficient')
                  .map(({ muscle, sets }) => {
                    const threshold = thresholds[muscle]
                    const deficit = threshold ? threshold.maintenance - Math.round(sets) : 0
                    return (
                      <li key={muscle}>
                        <strong>{t.muscles[muscle] || muscle}</strong>: {t.volumeChart.warnDeficitSets} <span className="num">{Math.max(0, deficit)}</span> set
                      </li>
                    )
                  })}
              </ul>
              <p className="text-sm text-ink-soft mt-3 font-medium">{t.volumeChart.warnSuggestion}</p>
            </div>
          )}

          {muscleVolumeData.some(({ muscle, sets }) => getVolumeStatus(muscle, Math.round(sets), trainingMode, thresholdsByMode) === 'maintenance') && (
            <div className="mt-4 p-4 bg-paper-sunken rounded-xl border-l-4 border-warning">
              <h5 className="font-semibold text-warning mb-2">{t.volumeChart.warnMaintenanceTitle}</h5>
              <p className="text-sm text-ink-soft">{t.volumeChart.warnMaintenanceBody}</p>
              <ul className="text-sm text-ink-soft mt-2 space-y-1">
                {muscleVolumeData
                  .filter(({ muscle, sets }) => getVolumeStatus(muscle, Math.round(sets), trainingMode, thresholdsByMode) === 'maintenance')
                  .map(({ muscle }) => (
                    <li key={muscle}>{t.muscles[muscle] || muscle}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
