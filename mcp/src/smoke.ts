/**
 * Smoke test: exercises every tool against the real tables and prints a short
 * summary. Run it before wiring the server into a client — a broken AWS
 * profile or a missing table name is far easier to read here than through
 * an MCP client's connection error.
 *
 *   AWS_PROFILE=gymtracker-dev npm run smoke
 */
import { loadDataset } from './ddb'
import {
  getActivePlan,
  getExerciseProgress,
  getRecentSessions,
  getTrainingLoad,
  getWeeklyReview,
  listExercises,
} from './tools'

const data = await loadDataset()
console.log('dataset:',
  `${data.exercises.length} exercises,`,
  `${data.sessions.length} sessions,`,
  `${data.sets.length} sets,`,
  `${data.plans.length} plans,`,
  `mode=${data.settings.trainingMode}`)

const load = getTrainingLoad(data, {})
console.log(`\nget_training_load: ${load.length} days logged`)
console.log('  last 3 days:', JSON.stringify(load.slice(-3), null, 2))

const review = getWeeklyReview(data, { weeksAgo: 0 })
console.log('\nget_weekly_review (this week):', JSON.stringify(review, null, 2).slice(0, 1200))

const plan = getActivePlan(data)
console.log('\nget_active_plan:', JSON.stringify(plan, null, 2).slice(0, 800))

const recent = getRecentSessions(data, { limit: 2 })
console.log('\nget_recent_sessions (2):', JSON.stringify(recent, null, 2).slice(0, 1200))

const logged = listExercises(data, { onlyLogged: true })
console.log(`\nlist_exercises (logged only): ${logged.length}`)
const sample = logged[0]
if (sample) {
  console.log(`\nget_exercise_progress ("${sample.name}"):`,
    JSON.stringify(getExerciseProgress(data, { exercise: sample.name, limit: 3 }), null, 2))
}
