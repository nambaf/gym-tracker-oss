'use client'

import { useState } from 'react'
import Model, { type Muscle } from 'react-body-highlighter'
import type { MuscleGroup, MuscleStatus } from '@/lib/bodyMapUtils'
import { useT } from '@/lib/i18n/I18nProvider'

interface BodyMapProps {
  muscleData: Map<MuscleGroup, MuscleStatus>
  compact?: boolean
}

/** Canonical (Italian) muscle-group key → library muscle names. */
const MUSCLE_NAME_MAP: Record<MuscleGroup, Muscle[]> = {
  petto: ['chest'],
  dorsali: ['upper-back', 'lower-back'],
  spalle: ['front-deltoids', 'back-deltoids'],
  bicipiti: ['biceps'],
  tricipiti: ['triceps'],
  quadricipiti: ['quadriceps'],
  femorali: ['hamstring'],
  glutei: ['gluteal'],
  polpacci: ['calves'],
  core: ['abs', 'obliques'],
  trapezi: ['trapezius'],
  avambracci: ['forearm'],
  adduttori: ['adductor'],
}

export function BodyMap({ muscleData, compact = false }: BodyMapProps) {
  const t = useT()
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null)
  const [hoveredStats, setHoveredStats] = useState<MuscleStatus | null>(null)

  // Convert muscleData to react-body-highlighter format.
  // frequency 0 → bodyColor (unplanned); frequency N → highlightedColors[N-1].
  const exerciseData = Array.from(muscleData.entries()).flatMap(([muscleGroup, status]) => {
    const libraryMuscles = MUSCLE_NAME_MAP[muscleGroup] || []
    let frequency = 0
    if (status.color === 'gray') frequency = 0
    else if (status.color === 'red') frequency = 2
    else if (status.color === 'yellow') frequency = 3
    else if (status.color === 'green') frequency = 4

    return libraryMuscles.map(muscleName => ({
      name: muscleName,
      muscles: [muscleName],
      frequency,
      _status: status,
      _muscleGroup: muscleGroup,
    }))
  })

  const highlightedColors = [
    '#a8a59c',  // frequency 1 (placeholder)
    '#c43e2b',  // frequency 2 = <50%
    '#d49521',  // frequency 3 = 50-79%
    '#3a8a5e',  // frequency 4 = ≥80%
  ]

  const handleClick = (stats: any) => {
    const muscle = stats.muscle
    const muscleName = t.bodyMap.detailedMuscles[muscle] || muscle
    const exercise = exerciseData.find(e => e.muscles.includes(muscle))
    const status = exercise?._status
    if (status) {
      setHoveredMuscle(muscleName)
      setHoveredStats(status)
    }
  }

  if (compact) {
    return (
      <div className="flex gap-2 justify-center">
        <Model data={exerciseData} type="anterior" highlightedColors={highlightedColors} bodyColor="#e5e7eb" style={{ width: '60px' }} />
        <Model data={exerciseData} type="posterior" highlightedColors={highlightedColors} bodyColor="#e5e7eb" style={{ width: '60px' }} />
      </div>
    )
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-2">{t.bodyMap.title}</h3>
      <p className="text-sm text-muted mb-4">{t.bodyMap.subtitle}</p>

      {muscleData.size === 0 && (
        <div className="mb-4 p-3 bg-accent-50 text-accent-700 rounded-xl text-sm">
          {t.bodyMap.emptyData}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="text-center font-medium mb-3">{t.bodyMap.frontTitle}</h4>
          <Model
            data={exerciseData}
            type="anterior"
            highlightedColors={highlightedColors}
            bodyColor="#e5e7eb"
            onClick={handleClick}
            style={{ width: '100%', maxWidth: '200px', margin: '0 auto' }}
          />
        </div>
        <div>
          <h4 className="text-center font-medium mb-3">{t.bodyMap.backTitle}</h4>
          <Model
            data={exerciseData}
            type="posterior"
            highlightedColors={highlightedColors}
            bodyColor="#e5e7eb"
            onClick={handleClick}
            style={{ width: '100%', maxWidth: '200px', margin: '0 auto' }}
          />
        </div>
      </div>

      {hoveredMuscle && hoveredStats && (
        <div className="p-4 bg-paper-sunken rounded-xl mb-4">
          <div className="font-semibold text-lg mb-2">{hoveredMuscle}</div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted">{t.bodyMap.actualSets} </span>
              <span className="font-semibold num">{hoveredStats.actual}</span>
            </div>
            <div>
              <span className="text-muted">{t.bodyMap.plannedSets} </span>
              <span className="font-semibold num">{hoveredStats.planned}</span>
            </div>
            <div>
              <span className="text-muted">{t.bodyMap.completion} </span>
              <span className="font-semibold num">{hoveredStats.percentage}%</span>
            </div>
            <div>
              <span className="text-muted">{t.bodyMap.volume} </span>
              <span className="font-semibold num">{hoveredStats.volume} kg·rep</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 justify-center text-xs text-muted">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3a8a5e' }}></div>
          <span>{t.bodyMap.legendWell}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#d49521' }}></div>
          <span>{t.bodyMap.legendUnder}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#c43e2b' }}></div>
          <span>{t.bodyMap.legendNot}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#a8a59c' }}></div>
          <span>{t.bodyMap.legendUnplanned}</span>
        </div>
      </div>
    </div>
  )
}
