// Guard: every field on Settings must be readable end to end —
// defaults -> effective -> parseStoredSettings -> /profile form.
import { readFileSync } from 'node:fs'
const read = p => readFileSync(p, 'utf8')

const types = read('lib/settings/types.ts')
const block = types.split('export type Settings = {')[1].split('\n}')[0]
const fields = [...block.matchAll(/^\s{2}(\w+)\??:/gm)].map(m => m[1]).filter(f => f !== 'id')

const effective = read('lib/settings/effective.ts')
const store = read('store/data.ts')
const profile = read('app/profile/page.tsx')

const broken = []
for (const f of fields) {
  const inEffective = new RegExp(`\\b${f}:\\s*s\\.${f}\\s*\\?\\?`).test(effective)
  const inStore = new RegExp(`data\\.${f}\\b`).test(store)
  const inProfile = new RegExp(`form\\.${f}\\b`).test(profile)
  if (!inEffective || !inStore || !inProfile) {
    broken.push({ field: f, effective: inEffective, store: inStore, profile: inProfile })
  }
}
console.log(`Settings dichiarati: ${fields.length}`)
if (broken.length === 0) {
  console.log('OK — ogni campo arriva dal DB fino a /profile')
} else {
  console.log('CATENA ROTTA:')
  for (const b of broken) {
    const missing = [!b.effective && 'effective.ts', !b.store && 'parseStoredSettings', !b.profile && '/profile'].filter(Boolean)
    console.log(`  ${b.field} -> manca in: ${missing.join(', ')}`)
  }
  process.exitCode = 1
}
