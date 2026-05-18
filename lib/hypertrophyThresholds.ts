import type { MuscleGroup } from './bodyMapUtils'

/**
 * Training modes.
 * - intensity: few sets to failure (RPE 10) — 5-12 sets/week per muscle
 * - volume:    more sets with 2-3 RIR (RPE 7-8) — 12-20 sets/week per muscle
 * - mixed:     intensity for upper body, volume for lower body
 */
export type TrainingMode = 'intensity' | 'volume' | 'mixed'

/**
 * Weekly hard-set thresholds for hypertrophy.
 * Scientific basis: Schoenfeld et al. 2017, Krieger 2010, Pelland meta-regression.
 *
 * A "hard set" is a set with RPE ≥ 7 (≤ 3 RIR).
 *  - maintenance: minimum to preserve muscle mass
 *  - hypertrophy: threshold for active muscle growth
 *
 * CUSTOMIZE: values tuned for an intermediate lifter.
 * Beginners can reduce by 20-30%; advanced lifters can push higher.
 */
const THRESHOLDS_BY_MODE: Record<TrainingMode, Record<MuscleGroup, { maintenance: number; hypertrophy: number }>> = {
    intensity: {
        petto: { maintenance: 4, hypertrophy: 10 },
        dorsali: { maintenance: 4, hypertrophy: 10 },
        spalle: { maintenance: 4, hypertrophy: 10 },
        bicipiti: { maintenance: 3, hypertrophy: 8 },
        tricipiti: { maintenance: 3, hypertrophy: 8 },
        quadricipiti: { maintenance: 4, hypertrophy: 10 },
        femorali: { maintenance: 4, hypertrophy: 10 },
        glutei: { maintenance: 4, hypertrophy: 10 },
        polpacci: { maintenance: 4, hypertrophy: 8 },
        core: { maintenance: 3, hypertrophy: 8 },
        trapezi: { maintenance: 3, hypertrophy: 6 },
        avambracci: { maintenance: 2, hypertrophy: 6 },
        adduttori: { maintenance: 2, hypertrophy: 4 },
    },
    volume: {
        petto: { maintenance: 8, hypertrophy: 16 },
        dorsali: { maintenance: 10, hypertrophy: 18 },
        spalle: { maintenance: 8, hypertrophy: 16 },
        bicipiti: { maintenance: 6, hypertrophy: 14 },
        tricipiti: { maintenance: 6, hypertrophy: 14 },
        quadricipiti: { maintenance: 10, hypertrophy: 18 },
        femorali: { maintenance: 8, hypertrophy: 16 },
        glutei: { maintenance: 8, hypertrophy: 16 },
        polpacci: { maintenance: 6, hypertrophy: 12 },
        core: { maintenance: 6, hypertrophy: 12 },
        trapezi: { maintenance: 4, hypertrophy: 10 },
        avambracci: { maintenance: 4, hypertrophy: 8 },
        adduttori: { maintenance: 3, hypertrophy: 8 },
    },
    // Mixed: intensity for upper body, volume for lower body
    mixed: {
        petto: { maintenance: 4, hypertrophy: 10 },
        dorsali: { maintenance: 4, hypertrophy: 10 },
        spalle: { maintenance: 4, hypertrophy: 10 },
        bicipiti: { maintenance: 3, hypertrophy: 8 },
        tricipiti: { maintenance: 3, hypertrophy: 8 },
        quadricipiti: { maintenance: 10, hypertrophy: 18 },
        femorali: { maintenance: 8, hypertrophy: 16 },
        glutei: { maintenance: 8, hypertrophy: 16 },
        polpacci: { maintenance: 6, hypertrophy: 12 },
        core: { maintenance: 6, hypertrophy: 12 },
        trapezi: { maintenance: 3, hypertrophy: 6 },
        avambracci: { maintenance: 2, hypertrophy: 6 },
        adduttori: { maintenance: 3, hypertrophy: 8 },
    },
}

export function getThresholdsForMode(mode: TrainingMode): Record<MuscleGroup, { maintenance: number; hypertrophy: number }> {
    return THRESHOLDS_BY_MODE[mode]
}

export type VolumeStatus = 'insufficient' | 'maintenance' | 'hypertrophy'

export function getVolumeStatus(muscle: MuscleGroup, hardSets: number, mode: TrainingMode = 'mixed'): VolumeStatus {
    const thresholds = THRESHOLDS_BY_MODE[mode][muscle]

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

/**
 * Per-session per-muscle set cap.
 * Above this value returns diminish significantly (junk volume).
 * Reference: Remer et al. (Zordos lab) — ~10-11 sets/session/muscle.
 *
 * CUSTOMIZE: raise to 12-14 for advanced athletes specialising on a group,
 * lower to 6-8 for beginners.
 */
export const MAX_SETS_PER_SESSION_PER_MUSCLE = 10
