/**
 * Estimate 1RM via the Epley formula (Epley 1985).
 * Valid in the 1–10 rep range; loses accuracy past 10 reps.
 */
export function epley1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}
