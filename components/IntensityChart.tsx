'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import type { DailyIntensityData } from '@/lib/bodyMapUtils'
import { useT } from '@/lib/i18n/I18nProvider'

interface IntensityChartProps {
  dailyData: DailyIntensityData[]
  period: 'week' | 'month'
}

export function IntensityChart({ dailyData, period }: IntensityChartProps) {
  const t = useT()

  if (dailyData.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">{t.intensityChart.title}</h3>
        <div className="text-center py-8 text-muted">{t.intensityChart.emptyState}</div>
      </div>
    )
  }

  const days = period === 'week' ? 7 : 30

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-2">{t.intensityChart.title}</h3>
      <p className="text-sm text-muted mb-4">
        {t.intensityChart.subtitleTemplate.replace('{n}', String(days))}
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1916" opacity={0.06} />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b6962' }} stroke="#a8a59c" />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#6b6962' }}
            stroke="#a8a59c"
            domain={[0, 10]}
            label={{ value: t.intensityChart.yLeft, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#6b6962' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#6b6962' }}
            stroke="#a8a59c"
            domain={[0, 100]}
            label={{ value: t.intensityChart.yRight, angle: 90, position: 'insideRight', fontSize: 12, fill: '#6b6962' }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1916', border: 'none', borderRadius: '12px', color: '#fff', fontSize: 12 }}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            formatter={(value: number, name: string) => {
              if (name === 'avgRPE') return [value.toFixed(1), t.intensityChart.legendRpe]
              if (name === 'avgIntensity') return [value + '%', t.intensityChart.statIntensity.replace(':', '')]
              return [value, name]
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#6b6962' }}
            formatter={(value: string) => {
              if (value === 'avgRPE') return t.intensityChart.legendRpe
              if (value === 'avgIntensity') return t.intensityChart.legendIntensity
              return value
            }}
          />
          <Line yAxisId="left" type="monotone" dataKey="avgRPE" stroke="#d6492a" strokeWidth={2} dot={{ r: 4, fill: '#d6492a' }} activeDot={{ r: 6 }} />
          <Line yAxisId="right" type="monotone" dataKey="avgIntensity" stroke="#1a1916" strokeWidth={2} dot={{ r: 4, fill: '#1a1916' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 flex gap-4 justify-center text-sm text-muted">
        <div>
          {t.intensityChart.statRpe} <span className="font-semibold text-ink num">
            {(dailyData.reduce((sum, d) => sum + d.avgRPE, 0) / dailyData.length).toFixed(1)}
          </span>
        </div>
        <div>
          {t.intensityChart.statIntensity} <span className="font-semibold text-ink num">
            {Math.round(dailyData.reduce((sum, d) => sum + d.avgIntensity, 0) / dailyData.length)}%
          </span>
        </div>
      </div>
    </div>
  )
}
