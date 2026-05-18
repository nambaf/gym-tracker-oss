/**
 * Sort an array of day labels. Day labels are user-entered free text, so we
 * try to honour several common conventions in this order:
 *
 *   1. Weekday names — Italian and English (Lunedì/Monday, Martedì/Tuesday, …)
 *   2. Numbered days — "Giorno N" or "Day N"
 *   3. Plain alphanumeric (A, B, C, …)
 */
const WEEK_DAYS: ReadonlyArray<readonly string[]> = [
    ['lunedì', 'monday'],
    ['martedì', 'tuesday'],
    ['mercoledì', 'wednesday'],
    ['giovedì', 'thursday'],
    ['venerdì', 'friday'],
    ['sabato', 'saturday'],
    ['domenica', 'sunday'],
]

const NUMBERED_DAY_RE = /^(?:giorno|day)\s+(\d+)$/i

function weekdayIndex(label: string): number {
    return WEEK_DAYS.findIndex(synonyms => synonyms.includes(label))
}

export function sortDays(days: string[]): string[] {
    return [...days].sort((a, b) => {
        const la = a.toLowerCase()
        const lb = b.toLowerCase()

        const idxA = weekdayIndex(la)
        const idxB = weekdayIndex(lb)

        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1

        const matchA = la.match(NUMBERED_DAY_RE)
        const matchB = lb.match(NUMBERED_DAY_RE)

        if (matchA && matchB) {
            return parseInt(matchA[1]) - parseInt(matchB[1])
        }
        if (matchA) return -1
        if (matchB) return 1

        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })
}
