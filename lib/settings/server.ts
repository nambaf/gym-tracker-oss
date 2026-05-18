import 'server-only'
import { getRow } from '../data/dataStore'
import type { Settings, EffectiveSettings } from './types'
import { mergeWithDefaults } from './effective'

/**
 * Load the `settings/global` row from DynamoDB and merge with defaults.
 * Always returns a fully-populated `EffectiveSettings` — if the row is
 * missing or partial, defaults fill the gaps.
 *
 * Called by AI server actions to pick up runtime overrides
 * (athlete profile, training mode, etc.) before building prompts.
 */
export async function getServerEffectiveSettings(): Promise<EffectiveSettings> {
  let stored: Partial<Settings> | null = null
  try {
    stored = await getRow<Settings>('settings', 'global')
  } catch (err) {
    console.error('getServerEffectiveSettings: failed to read settings/global, using defaults', err)
  }
  return mergeWithDefaults(stored)
}
