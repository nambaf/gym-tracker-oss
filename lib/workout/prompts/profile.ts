/**
 * Back-compat shim — the athlete profile defaults now live in
 * `lib/settings/defaults.ts` and are merged with runtime overrides from
 * the `settings/global` DynamoDB row.
 *
 * Prompt builders no longer import these constants directly; they receive
 * `athleteProfile` and `athleteNotes` as parameters from the calling server
 * action, which loads effective settings via `getServerEffectiveSettings()`.
 */
export {
  DEFAULT_ATHLETE_PROFILE as ATHLETE_PROFILE,
  DEFAULT_ATHLETE_NOTES as ATHLETE_NOTES,
} from '../../settings/defaults'
