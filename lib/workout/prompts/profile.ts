/**
 * Athlete profile included as context in every AI coach prompt.
 *
 * CUSTOMIZE: tune this to your own profile so the model gives you
 * relevant advice.
 *
 * Examples:
 *   "female, 60kg, beginner, strength goal"
 *   "male, 85kg, advanced, powerlifting goal"
 *   "master athlete 50+, focus on mobility and light hypertrophy"
 */
export const ATHLETE_PROFILE = 'intermediate athlete, hypertrophy goal'

/**
 * Extra user-specific notes.
 *
 * CUSTOMIZE: anything you want the AI coach to ALWAYS keep in mind —
 * physical limitations, methodological preferences, exercises you cannot do.
 * Leave empty if you have nothing to add.
 */
export const ATHLETE_NOTES = ''
