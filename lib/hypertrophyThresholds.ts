import type { MuscleGroup } from './bodyMapUtils'
import type { TrainingMode, ThresholdsMatrix } from './settings/types'
import { DEFAULT_THRESHOLDS_BY_MODE } from './settings/defaults'

// Re-export for back-compat: existing modules import `TrainingMode` from here.
export type { TrainingMode } from './settings/types'

export function getThresholdsForMode(
  mode: TrainingMode,
  thresholdsByMode?: ThresholdsMatrix,
): Record<MuscleGroup, { maintenance: number; hypertrophy: number }> {
  return (thresholdsByMode ?? DEFAULT_THRESHOLDS_BY_MODE)[mode]
}

export type VolumeStatus = 'insufficient' | 'maintenance' | 'hypertrophy'

export function getVolumeStatus(
  muscle: MuscleGroup,
  hardSets: number,
  mode: TrainingMode = 'mixed',
  thresholdsByMode?: ThresholdsMatrix,
): VolumeStatus {
  const thresholds = (thresholdsByMode ?? DEFAULT_THRESHOLDS_BY_MODE)[mode][muscle]

  if (hardSets < thresholds.maintenance) {
    return 'insufficient'
  } else if (hardSets < thresholds.hypertrophy) {
    return 'maintenance'
  } else {
    return 'hypertrophy'
  }
}

export function getVolumeStatusColor(status: VolumeStatus): string {
  switch (status) {
    case 'hypertrophy':
      return 'text-success'
    case 'maintenance':
      return 'text-warning'
    case 'insufficient':
      return 'text-danger'
  }
}
