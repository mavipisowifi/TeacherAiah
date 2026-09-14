/* ============================================================
   Tertiary (College / University) scheduling domain
   ------------------------------------------------------------
   Kept as a SEPARATE, pure module (no JSX, no React) so it can be
   unit-tested with plain Node and stays cleanly isolated from the
   K–12 model in store.jsx. store.jsx imports from here; this file
   imports nothing from store.jsx — so there is no import cycle.

   Data model (all persisted under the `tertiary` slice of the v6 root):
     program  { id, code, name, years }
     course   { id, code, title, programId, yearLevel, term,
                lecHours, labHours, units, color }
     faculty  { id, lastName, firstName, courseIds[], maxHours? }
     room     { id, name, type: 'Lecture' | 'Laboratory' }
     block    { id, programId, yearLevel, name, adviserId,
                schedules: { '1'|'2'|'summer': { meetings: [] } } }
     meeting  { id, courseId, facultyId, roomId, day, startMin, endMin }

   A "block" (a.k.a. block section, e.g. BSIT 1-A) is the tertiary
   analogue of a K–12 class: it takes a SET of courses together, and
   each course is placed as one or more weekly meetings.
   ============================================================ */

/* ---------------- ids ---------------- */

let __tseq = 0
export function tuid(prefix = 't') {
  __tseq += 1
  return `${prefix}_${Date.now().toString(36)}${__tseq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/* ---------------- constants ---------------- */

// Colleges commonly run Monday–Saturday; Saturday is opt-in per meeting.
export const TERTIARY_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export const TERTIARY_DAY_LABELS = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat' }
export const TERTIARY_DAY_FULL = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
}

// Meeting-day patterns typical of Philippine colleges. `days` are the weekday
// codes a pattern meets on. The scheduler places one session on each day of a
// course's chosen pattern.
export const DAY_PATTERNS = [
  { id: 'mwf', label: 'MWF', days: ['MON', 'WED', 'FRI'] },
  { id: 'tth', label: 'TTh', days: ['TUE', 'THU'] },
  { id: 'mw', label: 'MW', days: ['MON', 'WED'] },
  { id: 'tf', label: 'TF', days: ['TUE', 'FRI'] },
  { id: 'daily', label: 'Daily (M–F)', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  { id: 'sat', label: 'Saturday', days: ['SAT'] },
]
export function dayPattern(id) {
  return DAY_PATTERNS.find((p) => p.id === id) || DAY_PATTERNS[0]
}

// Semesters + summer/midyear. Analogous to K–12 SEMESTERS but with a third term.
export const TERTIARY_TERMS = [
  { id: '1', name: '1st Semester', short: '1st Sem' },
  { id: '2', name: '2nd Semester', short: '2nd Sem' },
  { id: 'summer', name: 'Summer / Midyear', short: 'Summer' },
]
export const TERM_IDS = TERTIARY_TERMS.map((t) => t.id)
export function termLabel(id, long = false) {
  const t = TERTIARY_TERMS.find((x) => x.id === id)
  return t ? (long ? t.name : t.short) : ''
}

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year']
export const ROOM_TYPES = ['Lecture', 'Laboratory']

// Course color palette (independent of the K–12 SUBJECT_PALETTE so this module
// has no dependency on store.jsx).
export const TERTIARY_PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04',
  '#ea580c', '#dc2626', '#db2777', '#9333ea', '#4f46e5',
  '#0d9488', '#475569',
]

/* ---------------- time helpers (minutes from midnight) ---------------- */

// Tertiary times are stored as minutes from midnight (0–1439) so a college day
// can span 7:00 AM – 9:00 PM without the AM/PM ambiguity of the K–12 clock. All
// display goes through fmtTertiaryTime, all parsing (from <input type="time">)
// through parseHM.
export function fmtTertiaryTime(min) {
  if (min == null || isNaN(min)) return ''
  const h = Math.floor(min / 60)
  const m = ((min % 60) + 60) % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`
}
export function fmtTertiaryRange(startMin, endMin) {
  return `${fmtTertiaryTime(startMin)} – ${fmtTertiaryTime(endMin)}`
}
// "HH:MM" (24h, from a time input) → minutes, or null when unparseable.
export function parseHM(str) {
  if (typeof str !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim())
  if (!m) return null
  const h = +m[1]
  const mm = +m[2]
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null
  return h * 60 + mm
}
// minutes → "HH:MM" (24h) for a time input's value.
export function toHM(min) {
  if (min == null || isNaN(min)) return ''
  const h = Math.floor(min / 60)
  const m = ((min % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/* ---------------- settings + empty state ---------------- */

export const DEFAULT_TERTIARY_SETTINGS = {
  dayStartMin: 7 * 60, // 7:00 AM — earliest a class may start
  dayEndMin: 20 * 60, // 8:00 PM — latest a class may end
  slotMin: 30, // scheduling granularity + grid row height
  showFacultyInCell: true, // print the faculty name inside each meeting cell
  activeTerm: '1', // which term the schedule view shows by default
}

export const EMPTY_TERTIARY = {
  programs: [],
  courses: [],
  faculty: [],
  rooms: [],
  blocks: [],
  settings: { ...DEFAULT_TERTIARY_SETTINGS },
}

/* ---------------- entity factories ---------------- */

function clampNum(v, fallback) {
  return typeof v === 'number' && isFinite(v) ? v : fallback
}

export function makeProgram(data = {}) {
  return {
    id: tuid('prog'),
    code: '',
    name: '',
    years: 4,
    createdAt: Date.now(),
    ...data,
    years: clampNum(data.years, 4),
  }
}

export function makeCourse(data = {}) {
  return {
    id: tuid('crs'),
    code: '',
    title: '',
    programId: '',
    yearLevel: YEAR_LEVELS[0],
    term: '1',
    lecHours: 3,
    labHours: 0,
    units: 3,
    color: TERTIARY_PALETTE[0],
    createdAt: Date.now(),
    ...data,
    term: TERM_IDS.includes(data.term) ? data.term : '1',
    lecHours: clampNum(data.lecHours, 3),
    labHours: clampNum(data.labHours, 0),
    units: data.units == null ? 3 : clampNum(data.units, 3),
  }
}

export function makeFaculty(data = {}) {
  return {
    id: tuid('fac'),
    lastName: '',
    firstName: '',
    courseIds: [],
    maxHours: null,
    createdAt: Date.now(),
    ...data,
    courseIds: Array.isArray(data.courseIds) ? data.courseIds : [],
    maxHours: data.maxHours == null ? null : clampNum(data.maxHours, null),
  }
}

export function makeRoom(data = {}) {
  return {
    id: tuid('troom'),
    name: '',
    type: 'Lecture',
    createdAt: Date.now(),
    ...data,
    type: ROOM_TYPES.includes(data.type) ? data.type : 'Lecture',
  }
}

// Every block carries an (initially empty) meetings list per term.
export function emptyBlockSchedules() {
  const s = {}
  for (const t of TERM_IDS) s[t] = { meetings: [] }
  return s
}

export function makeBlock(data = {}) {
  const { schedules, ...rest } = data
  return {
    id: tuid('blk'),
    programId: '',
    yearLevel: YEAR_LEVELS[0],
    name: '',
    adviserId: '',
    createdAt: Date.now(),
    ...rest,
    schedules: schedules && typeof schedules === 'object' ? schedules : emptyBlockSchedules(),
  }
}

export function makeMeeting(data = {}) {
  return {
    id: tuid('mtg'),
    courseId: '',
    facultyId: '',
    roomId: '',
    day: 'MON',
    startMin: 0,
    endMin: 0,
    ...data,
    day: TERTIARY_DAYS.includes(data.day) ? data.day : 'MON',
  }
}

/* ---------------- normalize (migration-safe load/import) ---------------- */

function normalizeMeeting(m) {
  return {
    id: (m && m.id) || tuid('mtg'),
    courseId: (m && m.courseId) || '',
    facultyId: (m && m.facultyId) || '',
    roomId: (m && m.roomId) || '',
    day: m && TERTIARY_DAYS.includes(m.day) ? m.day : 'MON',
    startMin: clampNum(m && +m.startMin, 0),
    endMin: clampNum(m && +m.endMin, 0),
  }
}

function normalizeBlock(b) {
  const src = (b && b.schedules) || {}
  const schedules = {}
  for (const t of TERM_IDS) {
    const meetings = Array.isArray(src[t] && src[t].meetings) ? src[t].meetings.map(normalizeMeeting) : []
    schedules[t] = { meetings }
  }
  return {
    id: (b && b.id) || tuid('blk'),
    programId: (b && b.programId) || '',
    yearLevel: (b && b.yearLevel) || YEAR_LEVELS[0],
    name: (b && b.name) || '',
    adviserId: (b && b.adviserId) || '',
    createdAt: (b && b.createdAt) || Date.now(),
    schedules,
  }
}

// Bring any persisted/imported tertiary blob up to the current shape without
// losing data. Safe on an undefined/garbage input (returns a fresh empty slice)
// and idempotent, so it is fine to run on every load and on every import.
export function normalizeTertiary(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_TERTIARY, settings: { ...DEFAULT_TERTIARY_SETTINGS } }
  }
  return {
    programs: (raw.programs || []).map((p) => ({
      id: p.id || tuid('prog'),
      code: p.code || '',
      name: p.name || '',
      years: clampNum(p.years, 4),
      createdAt: p.createdAt || Date.now(),
    })),
    courses: (raw.courses || []).map((c) => ({
      id: c.id || tuid('crs'),
      code: c.code || '',
      title: c.title || '',
      programId: c.programId || '',
      yearLevel: c.yearLevel || YEAR_LEVELS[0],
      term: TERM_IDS.includes(c.term) ? c.term : '1',
      lecHours: clampNum(c.lecHours, 3),
      labHours: clampNum(c.labHours, 0),
      units: c.units == null ? 3 : clampNum(c.units, 3),
      color: c.color || TERTIARY_PALETTE[0],
      createdAt: c.createdAt || Date.now(),
    })),
    faculty: (raw.faculty || []).map((f) => ({
      id: f.id || tuid('fac'),
      lastName: f.lastName || '',
      firstName: f.firstName || '',
      courseIds: Array.isArray(f.courseIds) ? f.courseIds : [],
      maxHours: f.maxHours == null ? null : clampNum(f.maxHours, null),
      createdAt: f.createdAt || Date.now(),
    })),
    rooms: (raw.rooms || []).map((r) => ({
      id: r.id || tuid('troom'),
      name: r.name || '',
      type: ROOM_TYPES.includes(r.type) ? r.type : 'Lecture',
      createdAt: r.createdAt || Date.now(),
    })),
    blocks: (raw.blocks || []).map(normalizeBlock),
    settings: { ...DEFAULT_TERTIARY_SETTINGS, ...(raw.settings || {}) },
  }
}

/* ---------------- selectors / display helpers ---------------- */

export function facultyName(f) {
  if (!f) return ''
  const ln = (f.lastName || '').trim()
  const fn = (f.firstName || '').trim()
  if (ln && fn) return `${ln}, ${fn}`
  return ln || fn || 'Faculty'
}
export function facultyShort(f) {
  if (!f) return ''
  const ln = (f.lastName || '').trim()
  const fn = (f.firstName || '').trim()
  return ln || fn || 'Faculty'
}
export function programLabel(programs, id) {
  const p = (programs || []).find((x) => x.id === id)
  if (!p) return ''
  return p.code || p.name || 'Program'
}
export function courseLabel(course) {
  if (!course) return ''
  return course.code || course.title || 'Course'
}

// Courses that belong in a given block (same program + year level), optionally
// filtered to one term. A block's schedule for a term is built from these.
export function coursesForBlock(courses, programId, yearLevel, term) {
  return (courses || []).filter(
    (c) => c.programId === programId && c.yearLevel === yearLevel && (term ? c.term === term : true)
  )
}

// Every faculty member who can teach a course (course id is in their courseIds).
// Mirrors the K–12 "teachers own subjects" ownership: a course can be shared by
// several faculty, and the scheduler round-robins across them.
export function facultyForCourse(faculty, courseId) {
  return (faculty || []).filter((f) => Array.isArray(f.courseIds) && f.courseIds.includes(courseId))
}

// Total scheduled hours per faculty across all blocks for a term. Used by the
// faculty-load summary. Returns a { facultyId: hours } map.
export function facultyLoadHours(blocks, term) {
  const load = {}
  for (const b of blocks || []) {
    const sc = b.schedules && b.schedules[term]
    if (!sc) continue
    for (const m of sc.meetings || []) {
      if (!m.facultyId) continue
      const hrs = Math.max(0, (m.endMin - m.startMin) / 60)
      load[m.facultyId] = (load[m.facultyId] || 0) + hrs
    }
  }
  return load
}

/* ---------------- conflict detection (pure) ---------------- */

// Two meetings clash when they share a day and their [start, end) intervals
// overlap. (End == next start is allowed — back-to-back is fine.)
export function meetingsOverlap(a, b) {
  return a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin
}

// Scan every meeting of a term (across all blocks) for clashes:
//   - faculty  : the same instructor booked in two places at once
//   - room     : the same room booked twice at once
//   - block    : one block section overlapping itself
// Returns { conflicts: [{ kind, a, b }] } where a/b carry a blockId. Independent
// of the scheduler, so it also validates hand-edited timetables.
export function computeTertiaryConflicts(blocks, term) {
  const all = []
  for (const b of blocks || []) {
    const sc = b.schedules && b.schedules[term]
    if (!sc) continue
    for (const m of sc.meetings || []) all.push({ ...m, blockId: b.id })
  }
  const conflicts = []
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i]
      const b = all[j]
      if (!meetingsOverlap(a, b)) continue
      if (a.facultyId && a.facultyId === b.facultyId) conflicts.push({ kind: 'faculty', a, b })
      else if (a.roomId && a.roomId === b.roomId) conflicts.push({ kind: 'room', a, b })
      else if (a.blockId === b.blockId) conflicts.push({ kind: 'block', a, b })
    }
  }
  return { conflicts }
}

/* ---------------- scheduling engine ---------------- */
// Greedy time-block placer. For each course of a block it derives weekly
// sessions from the course's lecture/lab hours (the familiar MWF-3h / TTh-2h
// shapes, generalised), assigns the least-loaded eligible instructor, and drops
// each session into the day window (settings.dayStart/End at slotMin steps)
// without ever double-booking the block itself, a shared faculty member, or a
// room — keeping lab sessions in Laboratory rooms and lectures in Lecture rooms.
// Pure: it never touches the store; wrappers below feed it fresh occupancy maps.

// Half-open [start, end) interval overlap (back-to-back, end == next start, is OK).
function overlaps(aS, aE, bS, bE) {
  return aS < bE && bS < aE
}
function intervalFree(list, s, e) {
  return !list.some(([bs, be]) => overlaps(s, e, bs, be))
}

// Busy-interval maps for one term, gathered from every block's meetings so a
// shared instructor or room is never booked twice. `exceptSet` omits blocks that
// are being (re)generated. Shape: { faculty: { id: { day: [[s,e]] } }, room: … }.
function busyMaps(blocks, term, exceptSet) {
  const faculty = {}
  const room = {}
  const push = (map, key, day, s, e) => {
    if (!key) return
    const byDay = map[key] || (map[key] = {})
    ;(byDay[day] || (byDay[day] = [])).push([s, e])
  }
  for (const b of blocks || []) {
    if (exceptSet && exceptSet.has(b.id)) continue
    const sc = b.schedules && b.schedules[term]
    if (!sc) continue
    for (const m of sc.meetings || []) {
      push(faculty, m.facultyId, m.day, m.startMin, m.endMin)
      push(room, m.roomId, m.day, m.startMin, m.endMin)
    }
  }
  return { faculty, room }
}

// Split a course's weekly lecture hours into equal sessions on a standard day
// pattern. 1–1.5h → one session; 2–2.5h & 4h → TTh; 3h & 5h → MWF; 6h+ → daily.
function lecturePlan(lecHours) {
  const total = Math.round((Number(lecHours) || 0) * 60)
  if (total <= 0) return null
  if (total <= 90) return { days: ['MON'], sessionMin: total }
  if (total <= 150) return { days: ['TUE', 'THU'], sessionMin: total / 2 }
  if (total <= 180) return { days: ['MON', 'WED', 'FRI'], sessionMin: total / 3 }
  if (total <= 240) return { days: ['TUE', 'THU'], sessionMin: total / 2 }
  if (total <= 300) return { days: ['MON', 'WED', 'FRI'], sessionMin: total / 3 }
  return { days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], sessionMin: total / 5 }
}
// Lab hours meet as one longer block in a laboratory room (two if very long).
function labPlan(labHours) {
  const total = Math.round((Number(labHours) || 0) * 60)
  if (total <= 0) return null
  if (total <= 240) return { count: 1, sessionMin: total }
  return { count: 2, sessionMin: Math.round(total / 2) }
}

// Candidate start times across the day window at slot granularity; a preferred
// start (a course's first session) is tried first to keep its sessions aligned.
function startTimes(settings, durMin, preferStart) {
  const step = Math.max(5, settings.slotMin || 30)
  const lo = settings.dayStartMin
  const hi = settings.dayEndMin
  const out = []
  if (preferStart != null && preferStart >= lo && preferStart + durMin <= hi) out.push(preferStart)
  for (let s = lo; s + durMin <= hi; s += step) if (s !== preferStart) out.push(s)
  return out
}

// A free room of `type` for [s,e) on `day`, preferring `preferId` so a course
// tends to keep the same room. Returns '' when none is free. When no room of the
// type exists at all, callers place the session unroomed rather than dropping it.
function pickRoom(rooms, roomBusy, type, day, s, e, preferId) {
  const list = rooms.filter((r) => r.type === type)
  const ordered = preferId
    ? [...list.filter((r) => r.id === preferId), ...list.filter((r) => r.id !== preferId)]
    : list
  for (const r of ordered) {
    const rb = (roomBusy[r.id] && roomBusy[r.id][day]) || []
    if (intervalFree(rb, s, e)) return r.id
  }
  return ''
}

function facDay(busy, facId, day) {
  return (facId && busy.faculty[facId] && busy.faculty[facId][day]) || []
}
function commit(busy, blockBusy, facId, roomId, day, s, e) {
  ;(blockBusy[day] || (blockBusy[day] = [])).push([s, e])
  if (facId) {
    const bf = busy.faculty[facId] || (busy.faculty[facId] = {})
    ;(bf[day] || (bf[day] = [])).push([s, e])
  }
  if (roomId) {
    const br = busy.room[roomId] || (busy.room[roomId] = {})
    ;(br[day] || (br[day] = [])).push([s, e])
  }
}

// Least-loaded eligible instructor for a course (round-robin across a shared
// course), preferring those under any maxHours cap. Returns null if none.
function pickFaculty(course, faculty, load) {
  const cands = facultyForCourse(faculty, course.id)
  if (!cands.length) return null
  return cands
    .map((f, i) => {
      const l = load[f.id] || 0
      return { f, i, l, over: f.maxHours != null && l >= f.maxHours }
    })
    .sort((a, b) => Number(a.over) - Number(b.over) || a.l - b.l || a.i - b.i)[0].f
}

// First (day-specific) slot that fits the block, the instructor, and a room of
// `type`. `hasType` means rooms of that type exist, so an all-busy day is a miss;
// with no such rooms at all we still place the session unroomed.
function firstSlot(day, durMin, settings, blockBusy, busy, facId, rooms, type, preferRoom, hasType) {
  const bBusy = blockBusy[day] || []
  const fBusy = facDay(busy, facId, day)
  for (const s of startTimes(settings, durMin)) {
    const e = s + durMin
    if (!intervalFree(bBusy, s, e)) continue
    if (!intervalFree(fBusy, s, e)) continue
    const roomId = pickRoom(rooms, busy.room, type, day, s, e, preferRoom)
    if (!roomId && hasType) continue
    return { s, e, roomId }
  }
  return null
}

// Place one block's whole term timetable. Mutates `busy` + `load` so several
// blocks can be scheduled in sequence without clashing. Returns its meetings and
// a placed/requested tally (a "session" — one weekday of one course — is the unit).
function scheduleBlock(block, courses, faculty, rooms, settings, busy, load) {
  const meetings = []
  const blockBusy = {}
  let requested = 0
  let placed = 0
  const hasLec = rooms.some((r) => r.type === 'Lecture')
  const hasLab = rooms.some((r) => r.type === 'Laboratory')

  // Heaviest courses first — they're the hardest to fit.
  const ordered = [...courses].sort(
    (a, b) =>
      (b.lecHours + b.labHours) - (a.lecHours + a.labHours) ||
      courseLabel(a).localeCompare(courseLabel(b), undefined, { numeric: true })
  )

  for (const course of ordered) {
    const facId = (pickFaculty(course, faculty, load) || {}).id || ''
    let hours = 0
    let preferLec = ''
    let preferLab = ''

    // Lecture — try one shared start time across the whole pattern (clean MWF /
    // TTh blocks); fall back to placing each day independently.
    const lp = lecturePlan(course.lecHours)
    if (lp) {
      const dur = Math.round(lp.sessionMin)
      requested += lp.days.length
      let done = false
      for (const s of startTimes(settings, dur)) {
        const e = s + dur
        const plan = []
        let ok = true
        for (const day of lp.days) {
          if (!intervalFree(blockBusy[day] || [], s, e) || !intervalFree(facDay(busy, facId, day), s, e)) {
            ok = false
            break
          }
          const roomId = pickRoom(rooms, busy.room, 'Lecture', day, s, e, preferLec)
          if (!roomId && hasLec) {
            ok = false
            break
          }
          plan.push({ day, roomId })
        }
        if (ok) {
          for (const { day, roomId } of plan) {
            commit(busy, blockBusy, facId, roomId, day, s, e)
            meetings.push(makeMeeting({ courseId: course.id, facultyId: facId, roomId, day, startMin: s, endMin: e }))
            if (roomId) preferLec = roomId
            placed++
            hours += dur / 60
          }
          done = true
          break
        }
      }
      if (!done) {
        for (const day of lp.days) {
          const slot = firstSlot(day, dur, settings, blockBusy, busy, facId, rooms, 'Lecture', preferLec, hasLec)
          if (!slot) continue
          commit(busy, blockBusy, facId, slot.roomId, day, slot.s, slot.e)
          meetings.push(
            makeMeeting({ courseId: course.id, facultyId: facId, roomId: slot.roomId, day, startMin: slot.s, endMin: slot.e })
          )
          if (slot.roomId) preferLec = slot.roomId
          placed++
          hours += dur / 60
        }
      }
    }

    // Lab — one (or two) longer sessions, each in a laboratory room, preferring a
    // weekday this course doesn't already meet on.
    const lab = labPlan(course.labHours)
    if (lab) {
      const dur = lab.sessionMin
      requested += lab.count
      for (let k = 0; k < lab.count; k++) {
        const used = new Set(meetings.filter((m) => m.courseId === course.id).map((m) => m.day))
        const dayOrder = [
          ...TERTIARY_DAYS.filter((d) => !used.has(d)),
          ...TERTIARY_DAYS.filter((d) => used.has(d)),
        ]
        let slot = null
        let chosenDay = ''
        for (const day of dayOrder) {
          slot = firstSlot(day, dur, settings, blockBusy, busy, facId, rooms, 'Laboratory', preferLab, hasLab)
          if (slot) {
            chosenDay = day
            break
          }
        }
        if (!slot) break
        commit(busy, blockBusy, facId, slot.roomId, chosenDay, slot.s, slot.e)
        meetings.push(
          makeMeeting({
            courseId: course.id,
            facultyId: facId,
            roomId: slot.roomId,
            day: chosenDay,
            startMin: slot.s,
            endMin: slot.e,
          })
        )
        if (slot.roomId) preferLab = slot.roomId
        placed++
        hours += dur / 60
      }
    }

    if (facId) load[facId] = (load[facId] || 0) + hours
  }

  return { meetings, placed, requested, unplaced: Math.max(0, requested - placed) }
}

// Generate ONE block's timetable for a term. Reads occupancy from every OTHER
// block so it slots around schedules already on the board. Returns
// { meetings, placed, requested, unplaced }; callers write it back with setMeetings.
export function autoScheduleTertiaryBlock(state, blockId, term) {
  const s = state || EMPTY_TERTIARY
  const block = (s.blocks || []).find((b) => b.id === blockId)
  if (!block) return { meetings: [], placed: 0, requested: 0, unplaced: 0 }
  const settings = { ...DEFAULT_TERTIARY_SETTINGS, ...(s.settings || {}) }
  const except = new Set([blockId])
  const busy = busyMaps(s.blocks, term, except)
  const load = facultyLoadHours((s.blocks || []).filter((b) => b.id !== blockId), term)
  const courses = coursesForBlock(s.courses, block.programId, block.yearLevel, term)
  return scheduleBlock(block, courses, s.faculty || [], s.rooms || [], settings, busy, load)
}

// Generate a whole term at once (optionally just `blockIds`), threading occupancy
// from one block to the next so the batch is mutually conflict-free. Returns
// { results: { blockId: {meetings,placed,requested,unplaced} }, placed, requested, unplaced }.
export function autoScheduleTertiaryTerm(state, term, blockIds) {
  const s = state || EMPTY_TERTIARY
  const settings = { ...DEFAULT_TERTIARY_SETTINGS, ...(s.settings || {}) }
  const targetSet =
    blockIds && blockIds.length ? new Set(blockIds) : new Set((s.blocks || []).map((b) => b.id))
  const busy = busyMaps(s.blocks, term, targetSet) // seed from non-targets only
  const load = facultyLoadHours((s.blocks || []).filter((b) => !targetSet.has(b.id)), term)
  const results = {}
  let placed = 0
  let requested = 0
  for (const block of (s.blocks || []).filter((b) => targetSet.has(b.id))) {
    const courses = coursesForBlock(s.courses, block.programId, block.yearLevel, term)
    const r = scheduleBlock(block, courses, s.faculty || [], s.rooms || [], settings, busy, load)
    results[block.id] = r
    placed += r.placed
    requested += r.requested
  }
  return { results, placed, requested, unplaced: Math.max(0, requested - placed) }
}

/* ---------------- reducer + cascade helpers ---------------- */

function dropCourseIds(faculty, idSet) {
  if (!Array.isArray(faculty.courseIds) || !faculty.courseIds.some((id) => idSet.has(id))) return faculty
  return { ...faculty, courseIds: faculty.courseIds.filter((id) => !idSet.has(id)) }
}

function termMeetingsOf(src, t) {
  return (src && src[t] && src[t].meetings) || []
}
function termMeetings(block, t) {
  return termMeetingsOf(block && block.schedules, t)
}
// Replace ONE term's meetings on a block, leaving the other terms untouched.
function writeBlockTerm(block, term, meetings) {
  const schedules = { ...(block.schedules || {}) }
  schedules[term] = { ...(schedules[term] || {}), meetings }
  return { ...block, schedules }
}
// Map every term's meetings through `fn` (used by cascade cleanups).
function mapAllTerms(block, fn) {
  const src = block.schedules || {}
  const schedules = {}
  for (const t of TERM_IDS) schedules[t] = { ...(src[t] || {}), meetings: fn(termMeetingsOf(src, t)) }
  return { ...block, schedules }
}
function dropMeetingsByCourses(block, courseIdSet) {
  return mapAllTerms(block, (ms) => ms.filter((m) => !courseIdSet.has(m.courseId)))
}
function clearFacultyRef(block, idSet) {
  return mapAllTerms(block, (ms) => ms.map((m) => (idSet.has(m.facultyId) ? { ...m, facultyId: '' } : m)))
}
function clearRoomRef(block, idSet) {
  return mapAllTerms(block, (ms) => ms.map((m) => (idSet.has(m.roomId) ? { ...m, roomId: '' } : m)))
}

// Pure reducer for the tertiary slice. rootReducer (store.jsx) routes every
// action tagged scope:'tertiary' here. Exported so it can be unit-tested with
// plain Node, exactly like the K–12 reducer.
export function tertiaryReducer(state, action) {
  const S = state || EMPTY_TERTIARY
  switch (action.type) {
    case 'T_IMPORT':
      return normalizeTertiary(action.payload)
    case 'T_RESET':
      return { ...EMPTY_TERTIARY, settings: { ...DEFAULT_TERTIARY_SETTINGS } }

    /* ---- programs ---- */
    case 'T_ADD_PROGRAM':
      return { ...S, programs: [...S.programs, action.payload] }
    case 'T_UPDATE_PROGRAM':
      return { ...S, programs: S.programs.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) }
    case 'T_DELETE_PROGRAM': {
      // Removing a program takes its courses and blocks with it; faculty lose the
      // removed courses; any meeting referencing a removed course is dropped.
      const courseIds = new Set(S.courses.filter((c) => c.programId === action.id).map((c) => c.id))
      return {
        ...S,
        programs: S.programs.filter((p) => p.id !== action.id),
        courses: S.courses.filter((c) => c.programId !== action.id),
        faculty: S.faculty.map((f) => dropCourseIds(f, courseIds)),
        blocks: S.blocks.filter((b) => b.programId !== action.id).map((b) => dropMeetingsByCourses(b, courseIds)),
      }
    }
    case 'T_DELETE_PROGRAMS_BULK': {
      const ids = new Set(action.ids || [])
      if (!ids.size) return S
      const courseIds = new Set(S.courses.filter((c) => ids.has(c.programId)).map((c) => c.id))
      return {
        ...S,
        programs: S.programs.filter((p) => !ids.has(p.id)),
        courses: S.courses.filter((c) => !ids.has(c.programId)),
        faculty: S.faculty.map((f) => dropCourseIds(f, courseIds)),
        blocks: S.blocks.filter((b) => !ids.has(b.programId)).map((b) => dropMeetingsByCourses(b, courseIds)),
      }
    }

    /* ---- courses ---- */
    case 'T_ADD_COURSE':
      return { ...S, courses: [...S.courses, action.payload] }
    case 'T_UPDATE_COURSE':
      return { ...S, courses: S.courses.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) }
    case 'T_DELETE_COURSE': {
      const set = new Set([action.id])
      return {
        ...S,
        courses: S.courses.filter((c) => c.id !== action.id),
        faculty: S.faculty.map((f) => dropCourseIds(f, set)),
        blocks: S.blocks.map((b) => dropMeetingsByCourses(b, set)),
      }
    }
    case 'T_DELETE_COURSES_BULK': {
      const ids = new Set(action.ids || [])
      if (!ids.size) return S
      return {
        ...S,
        courses: S.courses.filter((c) => !ids.has(c.id)),
        faculty: S.faculty.map((f) => dropCourseIds(f, ids)),
        blocks: S.blocks.map((b) => dropMeetingsByCourses(b, ids)),
      }
    }

    /* ---- faculty ---- */
    case 'T_ADD_FACULTY':
      return { ...S, faculty: [...S.faculty, action.payload] }
    case 'T_UPDATE_FACULTY':
      return { ...S, faculty: S.faculty.map((f) => (f.id === action.id ? { ...f, ...action.patch } : f)) }
    case 'T_DELETE_FACULTY': {
      const idSet = new Set([action.id])
      return {
        ...S,
        faculty: S.faculty.filter((f) => f.id !== action.id),
        // Unassign the removed instructor from every meeting AND from any block
        // they advise, so no dangling id remains.
        blocks: S.blocks.map((b) =>
          clearFacultyRef({ ...b, adviserId: idSet.has(b.adviserId) ? '' : b.adviserId }, idSet)
        ),
      }
    }
    case 'T_DELETE_FACULTY_BULK': {
      const ids = new Set(action.ids || [])
      if (!ids.size) return S
      return {
        ...S,
        faculty: S.faculty.filter((f) => !ids.has(f.id)),
        blocks: S.blocks.map((b) =>
          clearFacultyRef({ ...b, adviserId: ids.has(b.adviserId) ? '' : b.adviserId }, ids)
        ),
      }
    }

    /* ---- rooms ---- */
    case 'T_ADD_ROOM':
      return { ...S, rooms: [...S.rooms, action.payload] }
    case 'T_UPDATE_ROOM':
      return { ...S, rooms: S.rooms.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) }
    case 'T_DELETE_ROOM':
      return {
        ...S,
        rooms: S.rooms.filter((r) => r.id !== action.id),
        blocks: S.blocks.map((b) => clearRoomRef(b, new Set([action.id]))),
      }
    case 'T_DELETE_ROOMS_BULK': {
      const ids = new Set(action.ids || [])
      if (!ids.size) return S
      return {
        ...S,
        rooms: S.rooms.filter((r) => !ids.has(r.id)),
        blocks: S.blocks.map((b) => clearRoomRef(b, ids)),
      }
    }

    /* ---- blocks (sections) ---- */
    case 'T_ADD_BLOCK':
      return { ...S, blocks: [...S.blocks, action.payload] }
    case 'T_UPDATE_BLOCK':
      return { ...S, blocks: S.blocks.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) }
    case 'T_DELETE_BLOCK':
      return { ...S, blocks: S.blocks.filter((b) => b.id !== action.id) }
    case 'T_DELETE_BLOCKS_BULK': {
      const ids = new Set(action.ids || [])
      if (!ids.size) return S
      return { ...S, blocks: S.blocks.filter((b) => !ids.has(b.id)) }
    }

    /* ---- meetings (generator writeback + manual editing) ---- */
    case 'T_SET_MEETINGS': {
      const { blockId, term, meetings } = action
      return { ...S, blocks: S.blocks.map((b) => (b.id === blockId ? writeBlockTerm(b, term, meetings) : b)) }
    }
    case 'T_ADD_MEETING': {
      const { blockId, term, meeting } = action
      return {
        ...S,
        blocks: S.blocks.map((b) => (b.id === blockId ? writeBlockTerm(b, term, [...termMeetings(b, term), meeting]) : b)),
      }
    }
    case 'T_UPDATE_MEETING': {
      const { blockId, term, id, patch } = action
      return {
        ...S,
        blocks: S.blocks.map((b) =>
          b.id === blockId
            ? writeBlockTerm(b, term, termMeetings(b, term).map((m) => (m.id === id ? { ...m, ...patch } : m)))
            : b
        ),
      }
    }
    case 'T_DELETE_MEETING': {
      const { blockId, term, id } = action
      return {
        ...S,
        blocks: S.blocks.map((b) =>
          b.id === blockId ? writeBlockTerm(b, term, termMeetings(b, term).filter((m) => m.id !== id)) : b
        ),
      }
    }
    case 'T_CLEAR_BLOCK_TERM': {
      const { blockId, term } = action
      return { ...S, blocks: S.blocks.map((b) => (b.id === blockId ? writeBlockTerm(b, term, []) : b)) }
    }

    /* ---- settings ---- */
    case 'T_SET_SETTING':
      return { ...S, settings: { ...S.settings, [action.key]: action.value } }

    default:
      return S
  }
}

// Stateless action creators for the tertiary slice. Each tags its action with
// scope:'tertiary' so the root reducer routes it to tertiaryReducer. Mirrors the
// K–12 action surface (add/update/delete + bulk delete) for a consistent UI.
export function makeTertiaryActions(dispatch) {
  const D = (a) => dispatch({ ...a, scope: 'tertiary' })
  return {
    /* programs */
    addProgram: (data) => {
      const p = makeProgram(data)
      D({ type: 'T_ADD_PROGRAM', payload: p })
      return p
    },
    updateProgram: (id, patch) => D({ type: 'T_UPDATE_PROGRAM', id, patch }),
    deleteProgram: (id) => D({ type: 'T_DELETE_PROGRAM', id }),
    deletePrograms: (ids) => D({ type: 'T_DELETE_PROGRAMS_BULK', ids }),

    /* courses */
    addCourse: (data) => {
      const c = makeCourse(data)
      D({ type: 'T_ADD_COURSE', payload: c })
      return c
    },
    updateCourse: (id, patch) => D({ type: 'T_UPDATE_COURSE', id, patch }),
    deleteCourse: (id) => D({ type: 'T_DELETE_COURSE', id }),
    deleteCourses: (ids) => D({ type: 'T_DELETE_COURSES_BULK', ids }),

    /* faculty */
    addFaculty: (data) => {
      const f = makeFaculty(data)
      D({ type: 'T_ADD_FACULTY', payload: f })
      return f
    },
    updateFaculty: (id, patch) => D({ type: 'T_UPDATE_FACULTY', id, patch }),
    deleteFaculty: (id) => D({ type: 'T_DELETE_FACULTY', id }),
    deleteFaculties: (ids) => D({ type: 'T_DELETE_FACULTY_BULK', ids }),

    /* rooms */
    addRoom: (data) => {
      const r = makeRoom(data)
      D({ type: 'T_ADD_ROOM', payload: r })
      return r
    },
    updateRoom: (id, patch) => D({ type: 'T_UPDATE_ROOM', id, patch }),
    deleteRoom: (id) => D({ type: 'T_DELETE_ROOM', id }),
    deleteRooms: (ids) => D({ type: 'T_DELETE_ROOMS_BULK', ids }),

    /* blocks */
    addBlock: (data) => {
      const b = makeBlock(data)
      D({ type: 'T_ADD_BLOCK', payload: b })
      return b
    },
    updateBlock: (id, patch) => D({ type: 'T_UPDATE_BLOCK', id, patch }),
    deleteBlock: (id) => D({ type: 'T_DELETE_BLOCK', id }),
    deleteBlocks: (ids) => D({ type: 'T_DELETE_BLOCKS_BULK', ids }),

    /* meetings */
    setMeetings: (blockId, term, meetings) => D({ type: 'T_SET_MEETINGS', blockId, term, meetings }),
    addMeeting: (blockId, term, meeting) => {
      const m = makeMeeting(meeting)
      D({ type: 'T_ADD_MEETING', blockId, term, meeting: m })
      return m
    },
    updateMeeting: (blockId, term, id, patch) => D({ type: 'T_UPDATE_MEETING', blockId, term, id, patch }),
    deleteMeeting: (blockId, term, id) => D({ type: 'T_DELETE_MEETING', blockId, term, id }),
    clearBlockTerm: (blockId, term) => D({ type: 'T_CLEAR_BLOCK_TERM', blockId, term }),

    /* settings + data */
    setTertiarySetting: (key, value) => D({ type: 'T_SET_SETTING', key, value }),
    importTertiary: (payload) => D({ type: 'T_IMPORT', payload }),
    resetTertiary: () => D({ type: 'T_RESET' }),
  }
}
