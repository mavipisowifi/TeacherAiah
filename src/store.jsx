import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import {
  normalizeTertiary,
  tertiaryReducer,
  makeTertiaryActions,
  autoScheduleTertiaryBlock,
  autoScheduleTertiaryTerm,
} from './tertiary.js'

/* ============================================================
   Constants
   ============================================================ */

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI']

// Full DepEd K–12 range so TEACHERaiah serves every campus — Kindergarten and
// elementary through Junior and Senior High School.
export const GRADE_LEVELS = [
  'Kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
]

export const ROLES = ['Moderator', 'Non-moderator']

// Grade-level categories mirroring the DepEd structure the user asked for.
// Used to group the Grade Level Rooms list and every grade-level picker.
export const GRADE_CATEGORIES = [
  { key: 'preschool', name: 'Preschool', grades: ['Kindergarten'] },
  { key: 'grade-school', name: 'Grade School', grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'] },
  { key: 'jhs', name: 'Junior High School', grades: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'] },
  { key: 'shs', name: 'Senior High School', grades: ['Grade 11', 'Grade 12'] },
]

// The category a grade level belongs to (or null when unknown).
export function categoryForGrade(grade) {
  return GRADE_CATEGORIES.find((c) => c.grades.includes(grade)) || null
}

// Grade levels grouped by category, for <optgroup> pickers. Any grade not in a
// known category is collected under "Other".
export function gradeOptionGroups() {
  const groups = GRADE_CATEGORIES.map((c) => ({
    label: c.name,
    grades: c.grades.filter((g) => GRADE_LEVELS.includes(g)),
  }))
  const known = new Set(GRADE_CATEGORIES.flatMap((c) => c.grades))
  const other = GRADE_LEVELS.filter((g) => !known.has(g))
  if (other.length) groups.push({ label: 'Other', grades: other })
  return groups.filter((g) => g.grades.length)
}

// Non-"class" kinds render as a single full-width band across the week.
export const BAND_KINDS = ['homeroom', 'recess', 'lunch', 'dismissal', 'break']

export function isBand(kind) {
  return kind !== 'class'
}

// Default weekly bands, mirrored from the reference class program. Used as a
// placeholder for a brand-new classroom until its schedule is generated.
export function defaultTimeSlots() {
  return [
    { id: uid('slot'), time: '8:10-8:30', kind: 'homeroom', label: 'HOMEROOM TIME' },
    { id: uid('slot'), time: '8:30-9:30', kind: 'class', label: '' },
    { id: uid('slot'), time: '9:30-10:30', kind: 'class', label: '' },
    { id: uid('slot'), time: '10:30-10:45', kind: 'recess', label: 'RECESS' },
    { id: uid('slot'), time: '10:45-11:45', kind: 'class', label: '' },
    { id: uid('slot'), time: '11:45-12:30', kind: 'lunch', label: 'LUNCH TIME' },
    { id: uid('slot'), time: '12:30-1:30', kind: 'class', label: '' },
    { id: uid('slot'), time: '1:30-2:30', kind: 'class', label: '' },
    { id: uid('slot'), time: '2:30-3:30', kind: 'class', label: '' },
    { id: uid('slot'), time: '3:30-3:40', kind: 'dismissal', label: 'DISMISSAL TIME' },
  ]
}

// Turn minutes-from-midnight back into a school time label ("7:40", "1:30")
// using 12-hour hours without an am/pm suffix, matching parseStartMinutes
// (which reads 1:00–6:59 as afternoon). Kept consistent so generated clock
// times line up across every classroom of a grade for conflict detection.
export function minToTime(total) {
  let h = Math.floor(total / 60)
  const m = total % 60
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}:${String(m).padStart(2, '0')}`
}

// Default bell schedule, mirrored exactly from the reference Class Program
// ("Class Program 1st Sem 26-27"): Homeroom 8:10–8:30, six 60-minute periods,
// Recess after period 2 (15 min), Lunch after period 3 (45 min), Dismissal
// 3:30–3:40. Each grade level can override this in the Schedule Times tab, and
// the override is what the generator uses when building that grade's timetable.
export const DEFAULT_BELL = {
  startTime: '8:10',
  homeroomMin: 20,
  periodMin: 60,
  periods: 6,
  recessAfter: 2,
  recessMin: 15,
  lunchAfter: 3,
  lunchMin: 45,
  dismissalMin: 10,
  // Optional per-grade FRIDAY-only tweaks. Both default OFF, so every grade —
  // and all existing saved data — behaves exactly as before until a grade opts
  // in. `activity` is a no-class block (e.g. club meetings) placed on Friday;
  // `earlyDismissal` cuts Friday short. Times use the school clock like
  // startTime ("1:30" = 1:30 PM), so the default activity lands at 1:30–2:30 and
  // dismissal at 2:30 — which fall exactly on period boundaries of the default
  // bell. Monday–Thursday are never affected.
  friday: {
    activityEnabled: false,
    activityLabel: 'Activity Period',
    activityStart: '1:30',
    activityMin: 60,
    dismissalEnabled: false,
    dismissalTime: '2:30',
  },
}

// Fill in and clamp a (possibly partial) bell config to safe values.
export function normalizeBell(bell) {
  const b = { ...DEFAULT_BELL, ...(bell || {}) }
  const int = (v, def, lo, hi) => {
    let n = Math.round(Number(v))
    if (!Number.isFinite(n)) n = def
    return Math.max(lo, Math.min(hi, n))
  }
  const time = (v, def) => (typeof v === 'string' && /\d/.test(v) ? v.trim() : def)
  const df = DEFAULT_BELL.friday
  const f = b.friday && typeof b.friday === 'object' ? b.friday : {}
  return {
    startTime:
      typeof b.startTime === 'string' && /\d/.test(b.startTime) ? b.startTime.trim() : DEFAULT_BELL.startTime,
    homeroomMin: int(b.homeroomMin, DEFAULT_BELL.homeroomMin, 0, 120),
    periodMin: int(b.periodMin, DEFAULT_BELL.periodMin, 20, 180),
    periods: int(b.periods, DEFAULT_BELL.periods, 1, 12),
    recessAfter: int(b.recessAfter, DEFAULT_BELL.recessAfter, 0, 12),
    recessMin: int(b.recessMin, DEFAULT_BELL.recessMin, 0, 120),
    lunchAfter: int(b.lunchAfter, DEFAULT_BELL.lunchAfter, 0, 12),
    lunchMin: int(b.lunchMin, DEFAULT_BELL.lunchMin, 0, 120),
    dismissalMin: int(b.dismissalMin, DEFAULT_BELL.dismissalMin, 0, 120),
    // Optional Friday-only settings. Kept as a nested object so the whole thing
    // travels with the grade's bell (save, copy-to-grades, backup/restore).
    friday: {
      activityEnabled: !!f.activityEnabled,
      activityLabel: typeof f.activityLabel === 'string' && f.activityLabel.trim() ? f.activityLabel.trim() : df.activityLabel,
      activityStart: time(f.activityStart, df.activityStart),
      activityMin: int(f.activityMin, df.activityMin, 15, 180),
      dismissalEnabled: !!f.dismissalEnabled,
      dismissalTime: time(f.dismissalTime, df.dismissalTime),
    },
  }
}

// The (possibly overridden) bell schedule for a grade level.
export function bellForGrade(state, grade) {
  const map = (state && state.settings && state.settings.bellSchedules) || {}
  return normalizeBell(map[grade])
}

// Build a consistent weekly timetable from a bell config: Homeroom first, then
// `periods` fixed-length class periods repeated Mon–Fri, with a Recess after the
// configured period and a Lunch after its configured period, then Dismissal.
// Because start times are position-based, two sections of the same grade always
// share identical clock-time strings — which is what lets the auto-scheduler
// stagger a shared teacher across sections without clashes. Zero-length bands
// (e.g. recessMin 0) are skipped so a grade can drop a break entirely.
export function buildAutoTimeSlots(bell) {
  const b = normalizeBell(bell)
  const slots = []
  let t = parseStartMinutes(b.startTime)
  const push = (kind, label, dur) => {
    slots.push({ id: uid('slot'), time: `${minToTime(t)}-${minToTime(t + dur)}`, kind, label })
    t += dur
  }

  if (b.homeroomMin > 0) push('homeroom', BAND_DEFAULT_LABEL.homeroom, b.homeroomMin)
  for (let i = 1; i <= b.periods; i++) {
    push('class', '', b.periodMin)
    if (i === b.recessAfter && b.recessMin > 0) push('recess', BAND_DEFAULT_LABEL.recess, b.recessMin)
    if (i === b.lunchAfter && b.lunchMin > 0) push('lunch', BAND_DEFAULT_LABEL.lunch, b.lunchMin)
  }
  if (b.dismissalMin > 0) push('dismissal', BAND_DEFAULT_LABEL.dismissal, b.dismissalMin)
  return slots
}

export const BAND_DEFAULT_LABEL = {
  homeroom: 'HOMEROOM TIME',
  recess: 'RECESS',
  lunch: 'LUNCH TIME',
  dismissal: 'DISMISSAL TIME',
  break: 'BREAK',
}

// Resolve a grade's optional FRIDAY-only tweaks against its generated time
// column. Given a bell and the timeSlots it produces, returns which class rows
// are, ON FRIDAY ONLY:
//   • `activity`  — covered by the no-class activity block (e.g. club meetings)
//   • `dismissed` — at/after the early-dismissal time (Friday ends early)
// keyed by slot id, plus the labels/times for rendering. Returns null when both
// toggles are off, so Monday–Thursday and every opted-out grade are untouched
// and all existing behavior is byte-identical. Interval math (not string
// matching) is used so it stays correct under any custom bell: whatever class
// rows OVERLAP the activity window become the activity block, and whatever rows
// START at/after the dismissal time become dismissed. Activity wins if a row is
// somehow both. Pure.
export function fridayOverrides(bell, timeSlots) {
  const b = normalizeBell(bell)
  const f = b.friday || {}
  if (!f.activityEnabled && !f.dismissalEnabled) return null
  const classSlots = (timeSlots || []).filter((s) => s.kind === 'class')
  const activity = {}
  const dismissed = {}
  let activityRange = null
  let dismissalMin = null

  if (f.dismissalEnabled) {
    dismissalMin = parseStartMinutes(f.dismissalTime)
    for (const s of classSlots) {
      if (parseTimeRange(s.time).start >= dismissalMin) dismissed[s.id] = true
    }
  }
  if (f.activityEnabled) {
    const aStart = parseStartMinutes(f.activityStart)
    const aEnd = aStart + Math.max(1, f.activityMin)
    activityRange = { start: aStart, end: aEnd }
    for (const s of classSlots) {
      const r = parseTimeRange(s.time)
      if (r.start < aEnd && aStart < r.end) activity[s.id] = true
    }
  }
  // The activity block is a real (if class-free) event, so it takes precedence
  // over a "dismissed" flag on the same row.
  for (const id of Object.keys(activity)) delete dismissed[id]

  return {
    activity,
    dismissed,
    activityLabel: f.activityLabel || DEFAULT_BELL.friday.activityLabel,
    activityStart: f.activityStart,
    activityMin: Math.max(1, f.activityMin),
    activityRange,
    dismissalTime: f.dismissalEnabled ? f.dismissalTime : null,
    dismissalMin,
    activityEnabled: !!f.activityEnabled,
    dismissalEnabled: !!f.dismissalEnabled,
  }
}

// Color themes for the printed schedule. All solid — no gradients, no glow.
export const THEMES = {
  green: {
    name: 'Green (default)',
    title: '#14532d', section: '#166534', header: '#15803d', onDark: '#ffffff',
    timeCol: '#dcfce7', onTime: '#14532d', band: '#bbf7d0', onBand: '#14532d',
    border: '#166534', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  forest: {
    name: 'Forest',
    title: '#1a2e05', section: '#365314', header: '#4d7c0f', onDark: '#ffffff',
    timeCol: '#ecfccb', onTime: '#1a2e05', band: '#d9f99d', onBand: '#1a2e05',
    border: '#4d7c0f', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  teal: {
    name: 'Teal',
    title: '#134e4a', section: '#115e59', header: '#0f766e', onDark: '#ffffff',
    timeCol: '#ccfbf1', onTime: '#134e4a', band: '#99f6e4', onBand: '#134e4a',
    border: '#0f766e', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  blue: {
    name: 'Blue',
    title: '#1e3a8a', section: '#1e40af', header: '#1d4ed8', onDark: '#ffffff',
    timeCol: '#dbeafe', onTime: '#1e3a8a', band: '#bfdbfe', onBand: '#1e3a8a',
    border: '#1d4ed8', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  maroon: {
    name: 'Maroon',
    title: '#7f1d1d', section: '#991b1b', header: '#b91c1c', onDark: '#ffffff',
    timeCol: '#fee2e2', onTime: '#7f1d1d', band: '#fecaca', onBand: '#7f1d1d',
    border: '#b91c1c', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  violet: {
    name: 'Violet',
    title: '#4c1d95', section: '#5b21b6', header: '#6d28d9', onDark: '#ffffff',
    timeCol: '#ede9fe', onTime: '#4c1d95', band: '#ddd6fe', onBand: '#4c1d95',
    border: '#6d28d9', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  slate: {
    name: 'Slate',
    title: '#0f172a', section: '#1e293b', header: '#334155', onDark: '#ffffff',
    timeCol: '#e2e8f0', onTime: '#0f172a', band: '#cbd5e1', onBand: '#0f172a',
    border: '#334155', cellText: '#0f172a', emptyCell: '#ffffff',
  },
  amber: {
    name: 'Amber',
    title: '#78350f', section: '#92400e', header: '#b45309', onDark: '#ffffff',
    timeCol: '#fef3c7', onTime: '#78350f', band: '#fde68a', onBand: '#78350f',
    border: '#b45309', cellText: '#0f172a', emptyCell: '#ffffff',
  },
}

export const THEME_FIELDS = [
  { key: 'title', label: 'Grade title bar' },
  { key: 'section', label: 'Section bar' },
  { key: 'header', label: 'Day header row' },
  { key: 'onDark', label: 'Text on bars' },
  { key: 'timeCol', label: 'Time column' },
  { key: 'onTime', label: 'Time column text' },
  { key: 'band', label: 'Break / Lunch bands' },
  { key: 'onBand', label: 'Band text' },
  { key: 'border', label: 'Grid lines' },
]

// Solid subject-color palette, green-forward then varied. No gradients.
export const SUBJECT_PALETTE = [
  '#166534', '#15803d', '#4d7c0f', '#3f6212', '#0f766e', '#0e7490',
  '#155e75', '#1d4ed8', '#1e3a8a', '#4338ca', '#6d28d9', '#a21caf',
  '#be185d', '#9f1239', '#b91c1c', '#c2410c', '#b45309', '#334155',
]

/* ============================================================
   Small helpers
   ============================================================ */

let _counter = 0
export function uid(prefix = 'id') {
  _counter += 1
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

// Pick readable text (dark or white) for a solid background color.
export function pickTextColor(hex) {
  if (!hex || typeof hex !== 'string') return '#0f172a'
  const c = hex.replace('#', '')
  if (c.length < 6) return '#0f172a'
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  const lin = (x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.45 ? '#0f172a' : '#ffffff'
}

// Convert a school time label ("8:30-9:30", "1:30-2:30") to minutes-from-midnight
// for sorting, treating 1:00–6:59 as afternoon.
export function parseStartMinutes(time) {
  if (!time) return 0
  const start = String(time).split('-')[0].trim()
  const m = start.match(/(\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  if (h >= 1 && h <= 6) h += 12
  return h * 60 + min
}

// A class time label ("8:30-9:30") as a [start, end) interval in minutes, for
// overlap-based conflict detection that stays correct even when two grades run
// different bell schedules (e.g. a teacher shared between Grade 11 and 12, whose
// periods no longer line up on identical clock-time strings).
export function parseTimeRange(time) {
  if (!time) return { start: 0, end: 0 }
  const parts = String(time).split('-')
  const start = parseStartMinutes(parts[0])
  let end = parts[1] ? parseStartMinutes(parts[1]) : start
  if (end < start) end += 12 * 60
  return { start, end }
}

// Clamp a subject's sessions-per-week to the supported 1–5 range (default 4).
export function clampFreq(n) {
  let v = Math.round(Number(n))
  if (!Number.isFinite(v)) v = 4
  return Math.max(1, Math.min(5, v))
}

// Clamp a monthly subject's sessions-per-month to the supported 1–4 range
// (default 2). A month is treated as ~4 teaching weeks, so 4×/month ≈ weekly.
export function clampMonthly(n) {
  let v = Math.round(Number(n))
  if (!Number.isFinite(v)) v = 2
  return Math.max(1, Math.min(4, v))
}

// A subject's cadence: 'month' for subjects that meet only a few times per
// month, otherwise 'week' (the default for every subject). Old data with no
// `cadence` field reads as weekly, so existing schedules are unchanged.
export function subjectCadence(s) {
  return s && s.cadence === 'month' ? 'month' : 'week'
}

// Short frequency label shown on subject cards and printed grid cells:
// "4×/wk" for weekly subjects, "2×/mo" for monthly ones. Single source of
// truth so the modal, the card list, and the schedule table stay in sync.
export function cadenceLabel(s) {
  return subjectCadence(s) === 'month'
    ? `${clampMonthly(s && s.sessionsPerMonth)}×/mo`
    : `${clampFreq(s && s.periodsPerWeek)}×/wk`
}

/* ---- Senior High School: strands + semesters ----
   Senior High (Grades 11–12) runs the DepEd track/strand system: every SHS
   section belongs to a strand and takes that strand's specialized subjects plus
   the shared Core subjects, and its program differs between the two semesters.
   K–10 has no strands or semesters, so all of this is scoped to SHS grades and
   defaults to "off" (blank) everywhere else — leaving every non-SHS grid, count,
   and conflict check byte-identical to before. */

// All DepEd K–12 Senior High School strands, grouped by track. `id` is stored on
// the subject/section; `abbr` is the short badge; `name` is the full label.
export const SHS_STRANDS = [
  { id: 'stem', abbr: 'STEM', track: 'Academic', name: 'Science, Technology, Engineering & Mathematics' },
  { id: 'abm', abbr: 'ABM', track: 'Academic', name: 'Accountancy, Business & Management' },
  { id: 'humss', abbr: 'HUMSS', track: 'Academic', name: 'Humanities & Social Sciences' },
  { id: 'gas', abbr: 'GAS', track: 'Academic', name: 'General Academic Strand' },
  { id: 'tvl-he', abbr: 'TVL–HE', track: 'TVL', name: 'TVL — Home Economics' },
  { id: 'tvl-ict', abbr: 'TVL–ICT', track: 'TVL', name: 'TVL — Information & Communications Technology' },
  { id: 'tvl-afa', abbr: 'TVL–AFA', track: 'TVL', name: 'TVL — Agri-Fishery Arts' },
  { id: 'tvl-ia', abbr: 'TVL–IA', track: 'TVL', name: 'TVL — Industrial Arts' },
  { id: 'sports', abbr: 'Sports', track: 'Sports', name: 'Sports Track' },
  { id: 'arts', abbr: 'A&D', track: 'Arts and Design', name: 'Arts and Design Track' },
]

// A subject with no strand is a Core subject taken by every SHS section of its
// grade, whatever their strand.
export const CORE_STRAND_ID = 'core'

// Applied (contextualized) subjects — DepEd's "Applied Track" subjects. Like
// Core, every SHS section of the grade takes them regardless of strand, but they
// carry their own label so a program can tell Core and Applied subjects apart.
export const APPLIED_STRAND_ID = 'applied'

// Elective subjects — the Senior High electives shown in the DepEd sample
// Instructional-Block schedule for Key Stage 4 (Grades 11–12), e.g. "Human
// Movement 1 (Elective)" in DepEd Order No. 009, s. 2026 (Annex A, Table 6).
// Like Core and Applied it is an "all-strands" category — taken by every SHS
// section of the grade — but carries its own "Elective" label/badge so a program
// can tell electives apart from Core and Applied subjects.
export const ELECTIVE_STRAND_ID = 'elective'

// Core, Applied and Elective are "all-strands" categories: taken by every SHS
// section of the grade. Any other id is a specific strand only its own sections
// take.
export function isCrossStrand(id) {
  const x = id || CORE_STRAND_ID
  return x === CORE_STRAND_ID || x === APPLIED_STRAND_ID || x === ELECTIVE_STRAND_ID
}

// The three DepEd trimester TERMS (DepEd Order No. 009, s. 2026 — the Three-Term
// School Calendar for Basic Education). Every K–12 section stores a separate
// program per term. Note the internal identifiers are deliberately unchanged from
// the earlier two-semester model: the constant is still `SEMESTERS`, the persisted
// per-part field is still `semester`, and the helpers are still `semesterLabel` /
// `programForSemester` / `semesterCompatible`. Keeping the names means old backups
// load with no field-rename migration, and it avoids colliding with the separate
// tertiary module's own `termLabel`. Only the VALUES (two semesters → three terms)
// and the user-facing labels changed.
export const SEMESTERS = [
  { id: '1', name: 'Term 1', short: 'Term 1' },
  { id: '2', name: 'Term 2', short: 'Term 2' },
  { id: '3', name: 'Term 3', short: 'Term 3' },
]

// Strand <optgroup>s for a picker, in track order (Core first).
export function strandOptionGroups() {
  const byTrack = {}
  for (const st of SHS_STRANDS) {
    if (!byTrack[st.track]) byTrack[st.track] = { label: st.track, strands: [] }
    byTrack[st.track].strands.push(st)
  }
  return Object.values(byTrack)
}

// Is this grade a Senior High School grade? Only SHS grades carry strands and
// semesters; every other grade behaves exactly as before.
export function isShsGrade(grade) {
  const c = categoryForGrade(grade)
  return !!c && c.key === 'shs'
}

// A subject's strand id, treating a blank/missing strand as Core so no subject
// silently vanishes from a section.
export function subjectStrandId(s) {
  return (s && s.strandId) || CORE_STRAND_ID
}

// Short strand badge ("STEM", "Core", "Applied", "Elective", …).
export function strandLabel(id) {
  if (!id || id === CORE_STRAND_ID) return 'Core'
  if (id === APPLIED_STRAND_ID) return 'Applied'
  if (id === ELECTIVE_STRAND_ID) return 'Elective'
  const st = SHS_STRANDS.find((x) => x.id === id)
  return st ? st.abbr : id
}

// Full strand name ("Core (all strands)", "Applied (all strands)", "Elective
// (all strands)", …).
export function strandFullName(id) {
  if (!id || id === CORE_STRAND_ID) return 'Core (all strands)'
  if (id === APPLIED_STRAND_ID) return 'Applied (all strands)'
  if (id === ELECTIVE_STRAND_ID) return 'Elective (all strands)'
  const st = SHS_STRANDS.find((x) => x.id === id)
  return st ? st.name : id
}

// Short term label ("Term 1" / "Term 2" / "Term 3"); '' for a class with no
// matching term. (Named semesterLabel for data-compat — see SEMESTERS above.)
export function semesterLabel(id) {
  const s = SEMESTERS.find((x) => x.id === id)
  return s ? s.short : ''
}

export function formatTeacherName(t) {
  if (!t) return ''
  const last = (t.lastName || '').trim()
  const first = (t.firstName || '').trim()
  if (last && first) return `${last}, ${first}`
  return last || first || 'Unnamed'
}

export function formatTeacherShort(t) {
  if (!t) return ''
  const last = (t.lastName || '').trim()
  const first = (t.firstName || '').trim()
  if (first && last) return `${first.charAt(0)}. ${last}`
  return last || first || ''
}

export function effectiveTheme(state) {
  const base = THEMES[state.themeKey] || THEMES.green
  if (state.customTheme) return { ...base, ...state.customTheme }
  return base
}

/* ============================================================
   Derived data: canonical rows, conflicts, individual schedules
   ============================================================ */

// The schedulable "parts" of a classroom. Under the trimester model EVERY K–12
// section stores a separate program per term under `schedule.programs`
// ({ '1': {...}, '2': {...}, '3': {...} }, each { timeSlots, grid }). This helper
// flattens that map (in term order) into a list of { semester, timeSlots, grid }
// so every reader (conflicts, individual grids, load counts, the generator's
// booking pass) walks all three terms with one code path. The `semester` key on
// each part is the TERM id ('1'/'2'/'3'). A legacy single-grid class (pre-v7,
// before the term migration has run) falls back to one part carrying its stored
// `semester` (usually '' = every term), so old data still reads correctly.
export function scheduleParts(schedule) {
  if (!schedule) return []
  const progs = schedule.programs
  if (progs && typeof progs === 'object') {
    const out = []
    for (const sem of ['1', '2', '3']) {
      const p = progs[sem]
      if (p && Array.isArray(p.timeSlots)) out.push({ semester: sem, timeSlots: p.timeSlots, grid: p.grid || {} })
    }
    if (out.length) return out
  }
  return [{ semester: schedule.semester || '', timeSlots: schedule.timeSlots || [], grid: schedule.grid || {} }]
}

// Two class times can only clash if they fall in the same term. A blank term ''
// means "every term" (a part/subject that runs all year), so it stays compatible
// with any specific term. Post-migration every section has explicit terms, but
// the '' wildcard is kept so all-term subjects and any legacy single-grid data
// still match correctly.
export function semesterCompatible(a, b) {
  return a === '' || b === '' || a === b
}

// The single program (timeSlots + grid) a class shows for a given TERM. Every
// section now stores a program per term, so this returns the matching term's
// program; callers therefore pass the currently-selected term for ALL grades
// (K–10 included, not just Senior High). The fallbacks — an all-term part, then
// the first part — only matter for legacy single-grid data not yet migrated.
export function programForSemester(schedule, semester) {
  const parts = scheduleParts(schedule)
  if (semester) {
    const hit = parts.find((p) => p.semester === semester)
    if (hit) return hit
  }
  const allYear = parts.find((p) => p.semester === '')
  return allYear || parts[0] || { semester: '', timeSlots: [], grid: {} }
}

// A single ordered set of time rows spanning all schedules, so every
// individual teacher grid lines up. Falls back to defaults when empty.
export function canonicalTimeRows(schedules, semester = '') {
  const map = new Map()
  for (const s of schedules) {
    for (const part of scheduleParts(s)) {
      if (semester && !semesterCompatible(part.semester, semester)) continue
      for (const slot of part.timeSlots || []) {
        const key = slot.time
        const existing = map.get(key)
        if (!existing) {
          map.set(key, { time: slot.time, kind: slot.kind, label: slot.label || BAND_DEFAULT_LABEL[slot.kind] || '' })
        } else if (existing.kind === 'class' && slot.kind !== 'class') {
          // Prefer a band definition if any schedule marks this time as a band.
          map.set(key, { time: slot.time, kind: slot.kind, label: slot.label || BAND_DEFAULT_LABEL[slot.kind] || '' })
        }
      }
    }
  }
  let rows = Array.from(map.values())
  if (rows.length === 0) {
    rows = defaultTimeSlots().map((s) => ({ time: s.time, kind: s.kind, label: s.label }))
  }
  rows.sort((a, b) => parseStartMinutes(a.time) - parseStartMinutes(b.time))
  return rows
}

// Detect any teacher booked in two overlapping class times on the same day —
// across every section and every grade. Uses real time intervals (not equal
// clock-time strings) so a shared teacher is caught even when two grades run
// different bell schedules.
//
// Every section carries a program per TERM, and a teacher can only clash with
// themselves WITHIN a term. So we sweep each term bucket ('1','2','3')
// separately. A legacy all-term part (blank semester — only from un-migrated
// single-grid data) is compatible with every bucket and checked in each; its
// all-term-vs-all-term clusters are de-duplicated via seenGroups so they surface
// once. If no section has any term part at all, a single '' bucket is used so a
// brand-new / empty school still works.
export function computeConflicts(schedules) {
  const list = schedules || []
  const hasSemesters = list.some((s) => scheduleParts(s).some((p) => p.semester !== ''))
  const buckets = hasSemesters ? ['1', '2', '3'] : ['']

  const conflicts = []
  const cellKeys = new Set()
  const teacherIds = new Set()
  const seenGroups = new Set() // dedupe identical clusters seen in >1 bucket

  for (const bucket of buckets) {
    // Gather every class assignment as an interval on a (teacher, day) timeline.
    const byTeacherDay = new Map() // "teacherId||day" -> [{ ...item, start, end }]
    for (const s of list) {
      for (const part of scheduleParts(s)) {
        if (bucket !== '' && !semesterCompatible(part.semester, bucket)) continue
        for (const slot of part.timeSlots || []) {
          if (slot.kind !== 'class') continue
          const row = part.grid ? part.grid[slot.id] : null
          if (!row) continue
          const range = parseTimeRange(slot.time)
          for (const day of DAYS) {
            const cell = row[day]
            if (!cell || !cell.teacherId) continue
            const key = `${cell.teacherId}||${day}`
            if (!byTeacherDay.has(key)) byTeacherDay.set(key, [])
            byTeacherDay.get(key).push({
              scheduleId: s.id,
              slotId: slot.id,
              day,
              time: slot.time,
              start: range.start,
              end: range.end,
              teacherId: cell.teacherId,
              subjectId: cell.subjectId,
              gradeLevel: s.gradeLevel,
              section: s.section,
              semester: part.semester,
            })
          }
        }
      }
    }

    for (const [, items] of byTeacherDay) {
      if (items.length < 2) continue
      items.sort((a, b) => a.start - b.start || a.end - b.end)
      // Sweep into clusters of mutually-overlapping bookings.
      let cluster = [items[0]]
      let clusterEnd = items[0].end
      const flush = () => {
        if (cluster.length > 1) {
          // The same all-year cluster can surface in both semester buckets;
          // key it by its cells so it is only reported once.
          const gkey = cluster
            .map((it) => `${it.scheduleId}||${it.slotId}||${it.day}`)
            .sort()
            .join('##')
          if (!seenGroups.has(gkey)) {
            seenGroups.add(gkey)
            conflicts.push(cluster)
            for (const it of cluster) {
              cellKeys.add(`${it.scheduleId}||${it.slotId}||${it.day}`)
              teacherIds.add(it.teacherId)
            }
          }
        }
      }
      for (let i = 1; i < items.length; i++) {
        const it = items[i]
        if (it.start < clusterEnd) {
          cluster.push(it)
          clusterEnd = Math.max(clusterEnd, it.end)
        } else {
          flush()
          cluster = [it]
          clusterEnd = it.end
        }
      }
      flush()
    }
  }
  return { conflicts, cellKeys, teacherIds }
}

// Whether any classroom stores a per-term program. Under the trimester model
// every section does, so this is effectively "are there any sections yet"; it
// still drives whether the term toggle / per-term wording appears (an empty
// school with no sections has nothing to toggle).
export function hasSemesteredSchedules(schedules) {
  return (schedules || []).some((s) => scheduleParts(s).some((p) => p.semester !== ''))
}

// A section's stable position among the sections of its OWN grade, ordered by
// creation (then id as a tiebreak). This is the rotation offset the generator
// uses to stagger a shared subject one period later in each successive section —
// and the same offset the manual cell editor uses to resolve which sharer of a
// shared subject a section gets by default, so a hand-placed cell matches what
// Generate would have chosen. Derived from the grade, never a batch, so it is
// consistent no matter which subset of sections is being (re)built or edited.
export function sectionRotation(schedules, scheduleId) {
  const me = (schedules || []).find((s) => s.id === scheduleId)
  if (!me) return 0
  const grade = me.gradeLevel || ''
  const peers = (schedules || [])
    .filter((s) => (s.gradeLevel || '') === grade)
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)))
  const i = peers.findIndex((s) => s.id === scheduleId)
  return i < 0 ? 0 : i
}

// Build one teacher's weekly grid from every section schedule they appear in.
// When `semester` is given ('1'/'2') only that semester's programs are gathered
// (all-year K–10 classes, whose semester is '', always count); with the default
// '' every part is included, so a school with no semesters is unchanged.
export function buildIndividualSchedule(teacherId, schedules, rows, semester = '') {
  const homeroomSections = schedules
    .filter((s) => s.moderatorId === teacherId)
    .map((s) => ({ gradeLevel: s.gradeLevel, section: s.section }))

  const gridRows = rows.map((r) => {
    const days = {}
    for (const day of DAYS) {
      if (r.kind === 'homeroom') {
        days[day] = homeroomSections.length ? { homeroom: true, sections: homeroomSections } : null
        continue
      }
      if (r.kind !== 'class') {
        days[day] = null // band label handled at row level
        continue
      }
      // class row: gather every assignment for this teacher at this time+day
      const hits = []
      for (const s of schedules) {
        for (const part of scheduleParts(s)) {
          if (semester && !semesterCompatible(part.semester, semester)) continue
          const slot = (part.timeSlots || []).find((sl) => sl.kind === 'class' && sl.time === r.time)
          if (!slot) continue
          const cell = part.grid && part.grid[slot.id] ? part.grid[slot.id][day] : null
          if (cell && cell.teacherId === teacherId) {
            hits.push({ subjectId: cell.subjectId, gradeLevel: s.gradeLevel, section: s.section, semester: part.semester })
          }
        }
      }
      days[day] = hits.length ? hits : null
    }
    return { time: r.time, kind: r.kind, label: r.label, days }
  })

  return { teacherId, rows: gridRows, homeroomSections }
}

// Count how many class periods a teacher is assigned per week (rough load).
// Sums across every schedulable part, so a teacher's load across all three term
// programs is counted (a legacy single-grid class contributes its one grid).
export function teacherLoad(teacherId, schedules) {
  let count = 0
  for (const s of schedules) {
    for (const part of scheduleParts(s)) {
      for (const slot of part.timeSlots || []) {
        if (slot.kind !== 'class') continue
        const row = part.grid ? part.grid[slot.id] : null
        if (!row) continue
        for (const day of DAYS) {
          if (row[day] && row[day].teacherId === teacherId) count += 1
        }
      }
    }
  }
  return count
}

// Number of assigned subject cells in one classroom's weekly grid. Sums across
// all three term programs (a legacy single-grid class contributes its one grid).
export function assignedCount(schedule) {
  let n = 0
  for (const part of scheduleParts(schedule)) {
    const grid = part.grid || {}
    for (const slotId of Object.keys(grid)) {
      const row = grid[slotId]
      for (const day of DAYS) if (row[day] && row[day].subjectId) n += 1
    }
  }
  return n
}

// How many grid cells (across all classrooms) use a given subject. Walks every
// term program; a legacy single-grid class is walked as one part.
export function usageCount(subjectId, schedules) {
  let n = 0
  for (const s of schedules) {
    for (const part of scheduleParts(s)) {
      const grid = part.grid || {}
      for (const slotId of Object.keys(grid)) {
        const row = grid[slotId]
        for (const day of DAYS) if (row[day] && row[day].subjectId === subjectId) n += 1
      }
    }
  }
  return n
}

// Subjects that belong to a grade level (subjects are global and link to every
// classroom of the matching grade).
export function subjectsForGrade(subjects, gradeLevel) {
  return (subjects || []).filter((s) => s.gradeLevel === gradeLevel)
}

// Every teacher that teaches a given subject (a teacher owns subjects via its
// `subjectIds` list; a subject may be shared by several teachers). Returned in a
// stable order — creation time, then id — so the round-robin below is
// deterministic across renders and sessions.
export function teachersForSubject(teachers, subjectId) {
  return (teachers || [])
    .filter((t) => Array.isArray(t.subjectIds) && t.subjectIds.includes(subjectId))
    .sort(
      (a, b) =>
        (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id))
    )
}

// The subjects of a grade that no teacher teaches yet. Drives the strict
// "every subject needs a teacher" gate before a section can be generated.
export function subjectsMissingTeacher(subjects, teachers, gradeLevel) {
  return subjectsForGrade(subjects, gradeLevel).filter(
    (s) => teachersForSubject(teachers, s.id).length === 0
  )
}

// The subjects one specific CLASS takes in a given term. The TERM filter applies
// to every grade: a subject pinned to a term shows only in that term, while a
// subject left on "all terms" (blank semester) runs in all three. The STRAND
// filter is Senior High only — for other grades strand is ignored. So for a
// non-SHS grade this is the grade's subjects narrowed to the term; for a Senior
// High class it is additionally narrowed to subjects whose strand is a
// cross-strand category (Core, Applied or Elective) OR matches the section's
// strand. This is the single source of truth for "what does this class study
// this term".
export function subjectsForClass(subjects, gradeLevel, strandId = '', semester = '') {
  const shs = isShsGrade(gradeLevel)
  return subjectsForGrade(subjects, gradeLevel).filter((s) => {
    const semOk = !semester || !s.semester || s.semester === semester
    if (!shs) return semOk
    const st = subjectStrandId(s)
    const strandOk = isCrossStrand(st) || (strandId && st === strandId)
    return strandOk && semOk
  })
}

// The subjects one section should be scheduled with, each resolved to exactly
// ONE teacher. Every section of a grade takes the same set of subjects; when a
// subject is shared by several teachers, the section's `rotationIndex` (its
// stable position among the grade's sections) picks which sharer teaches it —
// a round-robin that spreads a shared subject's sections across its teachers and
// still reduces to "one teacher for every section" when only one teacher owns
// it. Subjects with no teacher come back with teacherId '' (blocked by the gate
// before generation, but harmless if it slips through). The returned objects are
// shallow copies carrying a resolved `teacherId`, exactly the shape
// autoScheduleGrid expects.
// When `opts` ({ strandId, semester }) is given, the section is scoped to a
// term (all grades) and — for Senior High — a strand too (subjectsForClass);
// without it, to the whole grade (subjectsForGrade) exactly as before. Either
// way each subject is resolved to one teacher via the round-robin.
export function subjectsForSection(subjects, teachers, gradeLevel, rotationIndex = 0, opts) {
  const list = opts
    ? subjectsForClass(subjects, gradeLevel, opts.strandId || '', opts.semester || '')
    : subjectsForGrade(subjects, gradeLevel)
  const idx = Math.trunc(rotationIndex) || 0
  return list.map((s) => {
    const sharers = teachersForSubject(teachers, s.id)
    const teacherId = sharers.length
      ? sharers[((idx % sharers.length) + sharers.length) % sharers.length].id
      : ''
    return { ...s, teacherId }
  })
}

// The strict "every subject needs a teacher" gate, scoped to one class for a
// given term (strand also applies for Senior High). With no term/strand it
// equals subjectsMissingTeacher for the whole grade.
export function subjectsMissingTeacherForClass(subjects, teachers, gradeLevel, strandId = '', semester = '') {
  return subjectsForClass(subjects, gradeLevel, strandId, semester).filter(
    (s) => teachersForSubject(teachers, s.id).length === 0
  )
}

// Subjects a given teacher teaches (a teacher owns subjects via its subjectIds).
export function subjectsForTeacher(subjects, teacher) {
  const ids = new Set((teacher && teacher.subjectIds) || [])
  return (subjects || []).filter((s) => ids.has(s.id))
}

// Automatically build one classroom's weekly grid from its grade's subjects,
// using a frequency + rest model that mirrors the reference Class Program:
//
//   • The day is divided into class periods by the grade's bell schedule.
//   • Each subject meets on `periodsPerWeek` days (default 4), seated in a
//     single period-row across the earliest free days — so it renders as one
//     aligned Mon–Thu row of separate cells with the remaining day(s) left blank
//     for the teacher to rest, like "GEN. MATH (Mon–Thu) + free Friday" in the
//     sheet.
//   • A short (1–2 day) subject can share the leftover days of a row that a
//     longer subject didn't use.
//   • No teacher is ever double-booked at overlapping times across ANY section
//     or grade — checked with real time intervals, so a teacher shared between
//     Grade 11 and 12 stays clash-free even under different bell schedules.
//
// The generated grid is always conflict-free; if a subject's sessions can't all
// be placed conflict-free (e.g. too few periods, or the teacher is saturated
// elsewhere), the shortfall is reported as `unplaced` so the UI can prompt the
// user to add a period or free up the teacher. Pure: returns fresh objects and
// mutates nothing.
//
// `rotation` staggers WHERE each section starts looking for a free period-row:
// section 0 searches rows 0,1,2…; section 1 searches 1,2,3…,0; and so on. Since
// every section uses the same Mon-first day order, a subject shared across
// sections lands one period later in each — the clean staggered "diagonal" from
// the reference sheet (GEN. MATH at 8:30 in Diamond, 9:30 in Garnet, …) — and no
// teacher is ever asked to be in two rooms at once, so every ≤4-day teacher keeps
// a whole free day instead of being scattered into it. Lower-frequency subjects
// placed afterwards fall into the freed cells, backfilling the week.
export function autoScheduleGrid({ gradeSubjects, subjects: subjectsArg, otherSchedules, bell, rotation = 0, semester = '' }) {
  const subjects = Array.isArray(subjectsArg)
    ? subjectsArg
    : Array.isArray(gradeSubjects)
    ? gradeSubjects
    : []
  const timeSlots = buildAutoTimeSlots(bell)
  const classSlots = timeSlots.filter((s) => s.kind === 'class')
  const P = classSlots.length
  const slotRange = classSlots.map((s) => parseTimeRange(s.time))
  // Normalize the offset into [0, P) so callers can pass any section index.
  const rot = P > 0 ? ((Math.trunc(rotation) % P) + P) % P : 0

  // Teacher busy intervals per day, seeded from every other section/grade, then
  // extended as we place cells in this section.
  const busy = new Map() // teacherId -> { MON: [[s,e],...], ... }
  const ensure = (tid) => {
    if (!busy.has(tid)) busy.set(tid, { MON: [], TUE: [], WED: [], THU: [], FRI: [] })
    return busy.get(tid)
  }
  const overlaps = (a, s, e) => a[0] < e && s < a[1]
  const isFree = (tid, day, range) => {
    if (!tid) return true
    const b = busy.get(tid)
    if (!b) return true
    return !b[day].some((iv) => overlaps(iv, range.start, range.end))
  }
  const book = (tid, day, range) => {
    if (!tid) return
    ensure(tid)[day].push([range.start, range.end])
  }

  // Seed teacher-busy intervals from other sections. Only parts that share this
  // section's term matter — a Term 1 class never clashes with a Term 2 or Term 3
  // one, while a part carrying the '' wildcard (legacy single-grid data) is
  // booked against every term. Callers pass the term being built ('1'/'2'/'3')
  // for ALL grades, so each of a section's three term grids is staggered only
  // against the pool's matching-term grids.
  for (const s of otherSchedules || []) {
    for (const part of scheduleParts(s)) {
      if (!semesterCompatible(part.semester, semester)) continue
      for (const slot of part.timeSlots || []) {
        if (slot.kind !== 'class') continue
        const row = part.grid ? part.grid[slot.id] : null
        if (!row) continue
        const r = parseTimeRange(slot.time)
        for (const day of DAYS) {
          const c = row[day]
          if (c && c.teacherId) book(c.teacherId, day, r)
        }
      }
    }
  }

  // Empty grid + per-cell occupancy for this section.
  const grid = {}
  const filled = classSlots.map(() => ({ MON: false, TUE: false, WED: false, THU: false, FRI: false }))
  for (const slot of classSlots) grid[slot.id] = { MON: null, TUE: null, WED: null, THU: null, FRI: null }

  // Optional per-grade FRIDAY blocks: the activity period and any slot at/after
  // early dismissal are marked occupied on Friday only, so no class is ever
  // seated there. fridayOverrides returns null unless the grade opted in, so
  // Mon–Thu — and every grade without these toggles — is unchanged.
  const fri = fridayOverrides(bell, timeSlots)
  if (fri) {
    classSlots.forEach((slot, pi) => {
      if (fri.activity[slot.id] || fri.dismissed[slot.id]) filled[pi].FRI = true
    })
  }

  // Longest-first so multi-day subjects claim their own rows before short ones
  // fill the leftovers. MONTHLY subjects (a few times a month) come dead last, so
  // they drop into the free "rest" cells the weekly subjects leave behind rather
  // than competing for prime rows — each reserves exactly ONE weekly slot (the
  // printed cell is stamped e.g. "2×/mo" so the real cadence is honest). Ties
  // break by creation order, then original index, for deterministic output
  // regardless of subject list order.
  const order = subjects
    .map((s, idx) => {
      const monthly = subjectCadence(s) === 'month'
      return {
        s,
        idx,
        monthly,
        // Weekly subjects occupy `periodsPerWeek` cells; a monthly subject always
        // reserves a single weekly slot regardless of its sessions-per-month.
        cells: monthly ? 1 : clampFreq(s.periodsPerWeek),
        // Sort weight: weekly subjects rank by their weekly frequency; monthly
        // ones all sit below every weekly subject so they backfill last.
        weight: monthly ? 0 : clampFreq(s.periodsPerWeek),
      }
    })
    .sort(
      (a, b) =>
        (a.monthly === b.monthly ? 0 : a.monthly ? 1 : -1) ||
        b.weight - a.weight ||
        (a.s.createdAt || 0) - (b.s.createdAt || 0) ||
        a.idx - b.idx
    )

  let placed = 0
  let requested = 0
  let unplaced = 0

  const placeCell = (pi, day, subj) => {
    const slot = classSlots[pi]
    grid[slot.id][day] = { subjectId: subj.id, teacherId: subj.teacherId || '' }
    filled[pi][day] = true
    book(subj.teacherId, day, slotRange[pi])
    placed += 1
  }

  for (const { s, cells } of order) {
    requested += cells
    const tid = s.teacherId || ''

    // Preferred: seat all `cells` sessions in one row on the earliest free days,
    // giving a clean merged block with the later day(s) free for rest. Rows are
    // scanned cyclically from `rot` so this section's blocks step past the ones
    // already placed in sibling sections — the staggered diagonal.
    let seatedRow = -1
    let seatedDays = null
    for (let k = 0; k < P; k++) {
      const pi = (rot + k) % P
      const days = DAYS.filter((day) => !filled[pi][day] && isFree(tid, day, slotRange[pi]))
      if (days.length >= cells) {
        seatedRow = pi
        seatedDays = days.slice(0, cells)
        break
      }
    }
    if (seatedRow >= 0) {
      for (const day of seatedDays) placeCell(seatedRow, day, s)
      continue
    }

    // Fallback: scatter the sessions across any free, conflict-free cells,
    // again scanning rows from the section's rotation offset.
    let need = cells
    for (let k = 0; k < P && need > 0; k++) {
      const pi = (rot + k) % P
      for (const day of DAYS) {
        if (need === 0) break
        if (filled[pi][day] || !isFree(tid, day, slotRange[pi])) continue
        placeCell(pi, day, s)
        need -= 1
      }
    }
    unplaced += need
  }

  return { timeSlots, grid, placed, requested, unplaced, total: subjects.length }
}

// Human-readable label for a Grade Level Room.
export function roomLabel(room) {
  if (!room) return ''
  const g = (room.gradeLevel || '').trim()
  const n = (room.name || '').trim()
  if (g && n) return `${g} — ${n}`
  return g || n || 'Room'
}

/* ============================================================
   State + reducer
   ============================================================ */

// v6 introduces the dual-mode "root" shape { mode, k12, tertiary }. v5 and every
// earlier key hold a FLAT (K–12-only) state, which normalizeRoot migrates into
// the k12 slice on load — so upgrading is lossless and old backups still import.
// v7 (DepEd trimester) keeps the same root shape but every K–12 section now holds
// three term programs; migrateSectionToTerms upgrades v6 (and older) k12 data on
// load, so the v6 key is just another legacy key normalizeRoot reads and migrates.
const STORAGE_KEY = 'csm:data:v7'
const LEGACY_STORAGE_KEYS = ['csm:data:v6', 'csm:data:v5', 'csm:data:v4', 'csm:data:v3', 'csm:data:v2', 'csm:data:v1']

const EMPTY_STATE = {
  teachers: [],
  rooms: [],
  subjects: [],
  schedules: [],
  themeKey: 'green',
  customTheme: null,
  settings: { showTeacherInCell: false, bellSchedules: {} },
}

function emptyGrid(timeSlots) {
  const g = {}
  for (const s of timeSlots) {
    if (s.kind === 'class') g[s.id] = { MON: null, TUE: null, WED: null, THU: null, FRI: null }
  }
  return g
}

function reconcileGrid(oldGrid, timeSlots) {
  const g = {}
  for (const s of timeSlots) {
    if (s.kind !== 'class') continue
    g[s.id] = (oldGrid && oldGrid[s.id]) || { MON: null, TUE: null, WED: null, THU: null, FRI: null }
  }
  return g
}

// Apply a pure grid updater to the ONE program a manual edit targets, returning a
// patched schedule. Every section keeps a program per term
// (programs['1'|'2'|'3']); the edit lands in the selected term's grid and the
// other terms are left byte-for-byte untouched. Callers pass the currently
// selected term for ALL grades; an unknown/blank term defaults to Term 1. A
// legacy single-grid class (pre-migration) has no `programs` and falls back to
// its top-level grid.
export function writeScheduleGrid(schedule, semester, updateGrid) {
  if (schedule && schedule.programs) {
    const sem = semester === '2' || semester === '3' ? semester : '1'
    const prog = schedule.programs[sem] || { timeSlots: [], grid: {} }
    return {
      ...schedule,
      programs: { ...schedule.programs, [sem]: { ...prog, grid: updateGrid(prog.grid || {}) } },
    }
  }
  return { ...schedule, grid: updateGrid((schedule && schedule.grid) || {}) }
}

// Apply a grid transform to EVERY term program a section holds (and, for legacy
// single-grid data, its top-level grid). Used by the delete/unassign reducers so
// removing a teacher or subject clears them out of all three terms at once — not
// just one. Without this, an unassign that only touched `schedule.grid` would
// miss the per-term programs entirely (every K–12 section now stores its grids
// under `programs`), leaving deleted teachers/subjects stranded in Term 1/2/3.
function mapScheduleGrids(schedule, fn) {
  let next = schedule
  if (schedule && schedule.programs && typeof schedule.programs === 'object') {
    const programs = {}
    for (const key of Object.keys(schedule.programs)) {
      const prog = schedule.programs[key] || {}
      programs[key] = { ...prog, grid: fn(prog.grid || {}) }
    }
    next = { ...next, programs }
  }
  if (schedule && schedule.grid) next = { ...next, grid: fn(schedule.grid) }
  return next
}

// Clone one { timeSlots, grid } program, assigning FRESH slot ids and remapping
// the grid rows onto them so the clone never aliases the source's rows. Pass
// { empty: true } to keep the fresh time rows but start with a blank grid.
function cloneProgramFreshIds(prog, { empty = false } = {}) {
  const rows = Array.isArray(prog && prog.timeSlots) ? prog.timeSlots : []
  const idMap = {}
  const timeSlots = rows.map((slot) => {
    const nid = uid('slot')
    idMap[slot.id] = nid
    return { ...slot, id: nid }
  })
  const grid = {}
  if (!empty) {
    for (const slot of rows) {
      if (slot.kind !== 'class') continue
      const oldRow = (prog.grid && prog.grid[slot.id]) || {}
      const newRow = {}
      for (const day of DAYS) newRow[day] = oldRow[day] ? { ...oldRow[day] } : null
      grid[idMap[slot.id]] = newRow
    }
  }
  return { timeSlots, grid }
}

// v6 → v7 (DepEd trimester, DepEd Order No. 009, s. 2026): every K–12 section now
// stores THREE independent term programs ('1','2','3'). Bring any older section
// shape up to it without losing data:
//   • A legacy single-grid section ({ timeSlots, grid }, pre-SHS-programs) has its
//     grid replicated into all three terms — K–10 subjects repeat each term — each
//     term getting its own fresh slot ids so the three edit independently.
//   • A v6 Senior High section (programs {'1','2'}) keeps Term 1 & 2 exactly and
//     gains an EMPTY Term 3 (fresh time rows cloned from an existing term, blank
//     grid), so nothing built for the first two terms changes.
//   • A section already carrying all three terms is left as-is.
// The stale top-level timeSlots/grid are dropped (the programs own them now).
// Idempotent: safe on every load and when importing any backup.
function migrateSectionToTerms(s) {
  if (!s || typeof s !== 'object') return s
  const progs = s.programs && typeof s.programs === 'object' ? s.programs : null
  const has = (k) => !!(progs && progs[k] && Array.isArray(progs[k].timeSlots))
  let programs
  if (has('1') && has('2') && has('3')) {
    programs = progs
  } else if (progs && (has('1') || has('2') || has('3'))) {
    // v6 SHS (or a partially-filled section): keep the terms that exist, fill any
    // missing term with an empty program cloned from the first present term.
    const template = progs['1'] || progs['2'] || progs['3']
    programs = {}
    for (const term of ['1', '2', '3']) {
      programs[term] = has(term) ? progs[term] : cloneProgramFreshIds(template, { empty: true })
    }
  } else {
    // Legacy single-grid K–10 section: replicate its grid across all three terms.
    const single = { timeSlots: s.timeSlots || [], grid: s.grid || {} }
    programs = {
      1: cloneProgramFreshIds(single),
      2: cloneProgramFreshIds(single),
      3: cloneProgramFreshIds(single),
    }
  }
  const { timeSlots, grid, ...rest } = s
  return { ...rest, strandId: rest.strandId || '', semester: '', programs }
}

// Bring older-format data up to the current structure without losing anything.
// Chains the v1→v2 (Grade Level Rooms), v2→v3 (global subjects), v3→v4 (teachers
// own their subjects, strands removed) and v6→v7 (trimester: every section holds
// three term programs) migrations — all idempotent, so it is safe on load and on
// importing any backup.
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STATE }
  let base = raw
  if (!Array.isArray(base.rooms)) base = migrateToRooms(base)
  base = migrateSubjectsGlobal(base)
  base = migrateTeacherOwnsSubjects(base)
  return {
    ...EMPTY_STATE,
    ...base,
    // v4 teachers own their subjects via `subjectIds` (a teacher can teach
    // subjects of any grade). The migration above populates it from older data.
    teachers: (base.teachers || []).map((t) => ({
      lastName: '',
      firstName: '',
      gradeLevel: '',
      role: 'Non-moderator',
      ...t,
      subjectIds: Array.isArray(t.subjectIds) ? t.subjectIds : [],
    })),
    rooms: base.rooms || [],
    // v5 subjects are global and DON'T reference a teacher (teachers own them):
    // { name, code, gradeLevel, color, periodsPerWeek, cadence, sessionsPerMonth,
    //   strandId, semester }. Drop any legacy roomId/teacherId. A Senior High
    // subject may carry a `strandId` (blank = Core / all strands) and a term
    // `semester` ('1'/'2'/'3'; blank = every term / not term-specific). Every
    // subject defaults to the weekly cadence + no strand + no term, so all older
    // data reads exactly as before.
    subjects: (base.subjects || []).map((s) => {
      const { roomId, teacherId, ...rest } = s
      return {
        name: '',
        code: '',
        gradeLevel: '',
        color: SUBJECT_PALETTE[0],
        periodsPerWeek: 4,
        sessionsPerMonth: 2,
        strandId: '',
        semester: '',
        ...rest,
        cadence: rest.cadence === 'month' ? 'month' : 'week',
        periodsPerWeek: clampFreq(rest.periodsPerWeek),
        sessionsPerMonth: clampMonthly(rest.sessionsPerMonth),
        strandId: rest.strandId || '',
        semester: rest.semester === '1' || rest.semester === '2' || rest.semester === '3' ? rest.semester : '',
      }
    }),
    // v6 → v7 (trimester): every section carries three independent term programs.
    // migrateSectionToTerms brings v6 Senior High (2 terms → keep 1 & 2, add an
    // empty Term 3) and legacy K–10 single-grid sections (grid replicated into all
    // three terms) up to shape, and leaves already-migrated sections alone. It also
    // normalizes strandId and drops the stale top-level grid. Idempotent.
    schedules: (base.schedules || []).map(migrateSectionToTerms),
    settings: {
      ...EMPTY_STATE.settings,
      ...(base.settings || {}),
      bellSchedules: (base.settings && base.settings.bellSchedules) || {},
    },
  }
}

// v1 → v2: create a Grade Level Room per grade level, attach classrooms and
// subjects to rooms, and infer each teacher's handled subjects from the grids.
function migrateToRooms(v1) {
  const rooms = []
  const byGrade = new Map()
  const ensureRoom = (gradeLevel) => {
    const key = gradeLevel || 'Unspecified'
    if (byGrade.has(key)) return byGrade.get(key)
    const room = { id: uid('room'), gradeLevel: gradeLevel || '', name: '', createdAt: Date.now() }
    byGrade.set(key, room)
    rooms.push(room)
    return room
  }

  const schedules = (v1.schedules || []).map((s) => ({ ...s, roomId: ensureRoom(s.gradeLevel).id }))
  // Keep a room for every teacher's grade level, even with no classrooms yet.
  for (const t of v1.teachers || []) if (t.gradeLevel) ensureRoom(t.gradeLevel)

  const firstUse = {}
  const teacherSubs = {}
  for (const s of schedules) {
    for (const slotId of Object.keys(s.grid || {})) {
      const row = s.grid[slotId] || {}
      for (const day of DAYS) {
        const c = row[day]
        if (!c) continue
        if (c.subjectId && !firstUse[c.subjectId]) firstUse[c.subjectId] = s.roomId
        if (c.subjectId && c.teacherId) {
          if (!teacherSubs[c.teacherId]) teacherSubs[c.teacherId] = new Set()
          teacherSubs[c.teacherId].add(c.subjectId)
        }
      }
    }
  }

  const fallbackRoom = rooms[0] ? rooms[0].id : ''
  const subjects = (v1.subjects || []).map((sub) => ({ ...sub, roomId: firstUse[sub.id] || fallbackRoom }))
  const teachers = (v1.teachers || []).map((t) => ({ ...t, subjectIds: Array.from(teacherSubs[t.id] || []) }))

  return {
    teachers,
    rooms,
    subjects,
    schedules,
    themeKey: v1.themeKey || 'green',
    customTheme: v1.customTheme || null,
    settings: v1.settings || {},
  }
}

// v2 → v3: subjects become global. Derive each subject's gradeLevel from the
// room it used to live in, and its teacherId from the old teacher.subjectIds
// links (falling back to whoever actually taught it in a grid). Idempotent: a
// subject that already has gradeLevel + teacherId is left untouched.
function migrateSubjectsGlobal(state) {
  const roomsById = Object.fromEntries((state.rooms || []).map((r) => [r.id, r]))

  // subjectId → teacherId, inferred from teacher.subjectIds first…
  const subjTeacher = {}
  for (const t of state.teachers || []) {
    for (const sid of t.subjectIds || []) if (!subjTeacher[sid]) subjTeacher[sid] = t.id
  }
  // …then from any grid cell that used the subject.
  for (const s of state.schedules || []) {
    for (const slotId of Object.keys(s.grid || {})) {
      const row = s.grid[slotId] || {}
      for (const day of DAYS) {
        const c = row[day]
        if (c && c.subjectId && c.teacherId && !subjTeacher[c.subjectId]) {
          subjTeacher[c.subjectId] = c.teacherId
        }
      }
    }
  }

  const subjects = (state.subjects || []).map((s) => {
    const room = s.roomId ? roomsById[s.roomId] : null
    const gradeLevel = s.gradeLevel || (room ? room.gradeLevel : '')
    const teacherId = s.teacherId || subjTeacher[s.id] || ''
    return { ...s, gradeLevel, teacherId, code: s.code || '' }
  })

  return { ...state, subjects }
}

// v3→v4: flip the subject↔teacher relationship. v3 subjects each pointed at ONE
// teacher (`subject.teacherId`); v4 makes the teacher own a list of subjects
// (`teacher.subjectIds`) so one teacher can teach subjects across any grade and a
// subject can be shared by several teachers. This ADDS each subject to its old
// teacher's list (never overwrites), so it is idempotent AND preserves
// multi-teacher sharing across repeated round-trips — even though
// migrateSubjectsGlobal collapses a shared subject back to a single teacherId,
// that teacher is re-added here without dropping the other sharers. Strips only
// the removed per-subject `teacherId` and the legacy `state.strands` ARRAY.
// (The Senior High strand is now a per-subject `strandId` again — see v5 in
// normalizeState — so strandId on subjects and schedules is KEPT here.)
function migrateTeacherOwnsSubjects(state) {
  const { strands, ...rest0 } = state
  const teachers = rest0.teachers || []
  const subjects = rest0.subjects || []
  // Keep strandId (Senior High strand); only the old per-subject teacherId goes.
  const stripSubject = (s) => {
    const { teacherId, ...keep } = s
    return keep
  }
  // subjectId → set of teacherIds that taught it (from the legacy teacherId).
  const add = {}
  for (const s of subjects) {
    if (s.teacherId) (add[s.teacherId] ||= new Set()).add(s.id)
  }
  const teachers2 = teachers.map((t) => {
    const ids = new Set(Array.isArray(t.subjectIds) ? t.subjectIds : [])
    for (const sid of add[t.id] || []) ids.add(sid)
    return { ...t, subjectIds: Array.from(ids) }
  })
  return {
    ...rest0,
    teachers: teachers2,
    subjects: subjects.map(stripSubject),
    // Schedules keep their strandId and any per-semester `programs` untouched.
    schedules: rest0.schedules || [],
  }
}

// A v6 "root" object namespaces the two modes; anything older is a flat K–12
// state. isRootShape decides which we're looking at so one load path upgrades both.
export function isRootShape(raw) {
  return !!(
    raw &&
    typeof raw === 'object' &&
    raw.k12 &&
    typeof raw.k12 === 'object' &&
    (typeof raw.mode === 'string' || (raw.tertiary && typeof raw.tertiary === 'object'))
  )
}

// Bring any persisted/imported blob up to the dual-mode v6 shape
// { mode, k12:{…K–12…}, tertiary:{…college…} }. A flat v1–v5 state migrates into
// the k12 slice (via normalizeState) with an empty tertiary slice, so nothing is
// lost and older single-mode backups still import cleanly. Idempotent.
export function normalizeRoot(raw) {
  if (isRootShape(raw)) {
    return {
      mode: raw.mode === 'tertiary' ? 'tertiary' : 'k12',
      k12: normalizeState(raw.k12),
      tertiary: normalizeTertiary(raw.tertiary),
    }
  }
  return {
    mode: 'k12',
    k12: normalizeState(raw),
    tertiary: normalizeTertiary(undefined),
  }
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) // v7 root
    if (raw) return normalizeRoot(JSON.parse(raw))
    // Fall back to (and upgrade) the most recent legacy backup we can find.
    for (const key of LEGACY_STORAGE_KEYS) {
      const legacy = localStorage.getItem(key)
      if (legacy) return normalizeRoot(JSON.parse(legacy))
    }
    return normalizeRoot(undefined)
  } catch {
    return normalizeRoot(undefined)
  }
}

// Exported so the pure state transitions (e.g. manual cell edits) can be unit
// tested without React. useReducer(reducer, …) is unaffected by the export.
export function reducer(state, action) {
  switch (action.type) {
    case 'IMPORT':
      return normalizeState(action.payload)
    case 'RESET':
      return { ...EMPTY_STATE }

    /* ---- Rooms (Grade Level Rooms) ---- */
    case 'ADD_ROOM':
      return { ...state, rooms: [...state.rooms, action.payload] }
    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.patch } : r
        ),
        // Keep the denormalized gradeLevel on child classrooms in sync.
        schedules:
          action.payload.patch.gradeLevel != null
            ? state.schedules.map((s) =>
                s.roomId === action.payload.id
                  ? { ...s, gradeLevel: action.payload.patch.gradeLevel }
                  : s
              )
            : state.schedules,
      }
    case 'DELETE_ROOM':
      // Subjects are global (owned by a grade level, shared across rooms of that
      // grade), so deleting a room only removes the room and its classrooms.
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        schedules: state.schedules.filter((s) => s.roomId !== action.id),
      }
    case 'DELETE_ROOMS_BULK': {
      // Remove several rooms at once (the rooms-list "Clear all" / checkbox
      // multi-delete). Like DELETE_ROOM, each room takes its own classrooms with
      // it; global subjects stay.
      const ids = new Set(action.ids || [])
      if (!ids.size) return state
      return {
        ...state,
        rooms: state.rooms.filter((r) => !ids.has(r.id)),
        schedules: state.schedules.filter((s) => !ids.has(s.roomId)),
      }
    }

    /* ---- Teachers ---- */
    case 'ADD_TEACHER':
      return { ...state, teachers: [...state.teachers, action.payload] }
    case 'UPDATE_TEACHER':
      return {
        ...state,
        teachers: state.teachers.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.patch } : t
        ),
      }
    case 'DELETE_TEACHER':
      return {
        ...state,
        teachers: state.teachers.filter((t) => t.id !== action.id),
        // Subjects are owned by teachers via teacher.subjectIds, so removing a
        // teacher simply drops their list — the subjects themselves remain and
        // can be re-linked to another teacher in the Subject Teachers tab.
        // Unassign the removed teacher everywhere — across every term program.
        schedules: state.schedules.map((s) =>
          mapScheduleGrids(
            { ...s, moderatorId: s.moderatorId === action.id ? '' : s.moderatorId },
            (grid) => unassignTeacher(grid, action.id)
          )
        ),
      }
    case 'DELETE_TEACHERS_BULK': {
      // Remove several teachers at once (the "Clear all" / checkbox multi-delete
      // in Subject Teachers). Mirrors DELETE_TEACHER for each id: subjects stay
      // (they lose these teachers from their subjectIds via the teacher list),
      // advisory + grid assignments are cleared everywhere.
      const ids = new Set(action.ids || [])
      if (!ids.size) return state
      return {
        ...state,
        teachers: state.teachers.filter((t) => !ids.has(t.id)),
        schedules: state.schedules.map((s) =>
          mapScheduleGrids(
            { ...s, moderatorId: ids.has(s.moderatorId) ? '' : s.moderatorId },
            (grid) => unassignTeachersSet(grid, ids)
          )
        ),
      }
    }

    /* ---- Subjects ---- */
    case 'ADD_SUBJECT':
      return { ...state, subjects: [...state.subjects, action.payload] }
    case 'UPDATE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.map((s) =>
          s.id === action.payload.id ? { ...s, ...action.payload.patch } : s
        ),
      }
    case 'DELETE_SUBJECT':
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.id),
        // Drop the subject from every teacher who taught it.
        teachers: state.teachers.map((t) =>
          Array.isArray(t.subjectIds) && t.subjectIds.includes(action.id)
            ? { ...t, subjectIds: t.subjectIds.filter((sid) => sid !== action.id) }
            : t
        ),
        schedules: state.schedules.map((s) => mapScheduleGrids(s, (grid) => unassignSubject(grid, action.id))),
      }
    case 'DELETE_SUBJECTS_BULK': {
      // Remove several subjects at once (the "Clear all" / checkbox multi-delete
      // in Subjects). Mirrors DELETE_SUBJECT for each id: dropped from every
      // teacher's subjectIds and unassigned from any grid cell that placed them.
      const ids = new Set(action.ids || [])
      if (!ids.size) return state
      return {
        ...state,
        subjects: state.subjects.filter((s) => !ids.has(s.id)),
        teachers: state.teachers.map((t) =>
          Array.isArray(t.subjectIds) && t.subjectIds.some((sid) => ids.has(sid))
            ? { ...t, subjectIds: t.subjectIds.filter((sid) => !ids.has(sid)) }
            : t
        ),
        schedules: state.schedules.map((s) => mapScheduleGrids(s, (grid) => unassignSubjectsSet(grid, ids))),
      }
    }

    /* ---- Schedules ---- */
    case 'ADD_SCHEDULE':
      return { ...state, schedules: [...state.schedules, action.payload] }
    case 'UPDATE_SCHEDULE':
      return {
        ...state,
        schedules: state.schedules.map((s) =>
          s.id === action.id ? { ...s, ...action.patch } : s
        ),
      }
    case 'UPDATE_SCHEDULES_BULK': {
      // Apply several { id, patch } updates in one pass — used by the threaded
      // batch generator / conflict fixer so every affected classroom updates
      // together (one render, one localStorage write).
      const byId = new Map((action.patches || []).map((p) => [p.id, p.patch]))
      return {
        ...state,
        schedules: state.schedules.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s)),
      }
    }
    case 'DELETE_SCHEDULE':
      return { ...state, schedules: state.schedules.filter((s) => s.id !== action.id) }
    case 'DELETE_SCHEDULES_BULK': {
      // Remove several classrooms/sections at once (the room-detail "Clear all" /
      // checkbox multi-delete). Rooms and global subjects are untouched.
      const ids = new Set(action.ids || [])
      if (!ids.size) return state
      return { ...state, schedules: state.schedules.filter((s) => !ids.has(s.id)) }
    }
    case 'SET_TIME_SLOTS':
      return {
        ...state,
        schedules: state.schedules.map((s) =>
          s.id === action.id
            ? { ...s, timeSlots: action.timeSlots, grid: reconcileGrid(s.grid, action.timeSlots) }
            : s
        ),
      }
    case 'SET_ENTRY':
      return {
        ...state,
        schedules: state.schedules.map((s) => {
          if (s.id !== action.scheduleId) return s
          return writeScheduleGrid(s, action.semester, (grid) => {
            const g = { ...grid }
            const row = { ...(g[action.slotId] || { MON: null, TUE: null, WED: null, THU: null, FRI: null }) }
            row[action.day] = action.value
            g[action.slotId] = row
            return g
          })
        }),
      }
    case 'SET_ENTRIES_BULK':
      return {
        ...state,
        schedules: state.schedules.map((s) => {
          if (s.id !== action.scheduleId) return s
          return writeScheduleGrid(s, action.semester, (grid) => {
            const g = { ...grid }
            const row = { ...(g[action.slotId] || { MON: null, TUE: null, WED: null, THU: null, FRI: null }) }
            for (const day of action.days) row[day] = action.value
            g[action.slotId] = row
            return g
          })
        }),
      }
    case 'CLEAR_GRID':
      // Wipe every placed subject from one class's grid, leaving the time rows
      // (and, for SHS, the OTHER semester's program) untouched. Resetting the
      // grid to {} is the canonical empty state — a freshly created class starts
      // the same way, and every reader treats a missing row as all-null cells.
      // Bands and Friday reserved cells are derived from the bell, not stored in
      // the grid, so they are unaffected.
      return {
        ...state,
        schedules: state.schedules.map((s) =>
          s.id === action.scheduleId ? writeScheduleGrid(s, action.semester, () => ({})) : s
        ),
      }

    /* ---- Theme ---- */
    case 'SET_THEME_KEY':
      return { ...state, themeKey: action.key, customTheme: null }
    case 'SET_CUSTOM_THEME':
      return { ...state, customTheme: action.theme }
    case 'CLEAR_CUSTOM_THEME':
      return { ...state, customTheme: null }
    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } }
    case 'SET_BELL_SCHEDULE': {
      const next = { ...(state.settings.bellSchedules || {}) }
      if (action.value == null) delete next[action.grade]
      else next[action.grade] = action.value
      return { ...state, settings: { ...state.settings, bellSchedules: next } }
    }

    default:
      return state
  }
}

function unassignTeacher(grid, teacherId) {
  if (!grid) return grid
  const g = {}
  for (const slotId of Object.keys(grid)) {
    const row = grid[slotId]
    const nr = {}
    for (const day of DAYS) {
      const c = row[day]
      nr[day] = c && c.teacherId === teacherId ? { ...c, teacherId: '' } : c
    }
    g[slotId] = nr
  }
  return g
}

function unassignSubject(grid, subjectId) {
  if (!grid) return grid
  const g = {}
  for (const slotId of Object.keys(grid)) {
    const row = grid[slotId]
    const nr = {}
    for (const day of DAYS) {
      const c = row[day]
      nr[day] = c && c.subjectId === subjectId ? null : c
    }
    g[slotId] = nr
  }
  return g
}

// Set-based variants used by the bulk deletes (Clear all / checkbox multi-delete):
// clear every cell whose subject/teacher id is in `ids` in a single grid pass.
// Returns the grid unchanged when there's nothing to do (empty set or no grid —
// e.g. a Senior High section keeps its cells under `programs`, not top-level
// grid, exactly like the singular helpers above).
function unassignSubjectsSet(grid, ids) {
  if (!grid || !ids || !ids.size) return grid
  const g = {}
  for (const slotId of Object.keys(grid)) {
    const row = grid[slotId]
    const nr = {}
    for (const day of DAYS) {
      const c = row[day]
      nr[day] = c && ids.has(c.subjectId) ? null : c
    }
    g[slotId] = nr
  }
  return g
}
function unassignTeachersSet(grid, ids) {
  if (!grid || !ids || !ids.size) return grid
  const g = {}
  for (const slotId of Object.keys(grid)) {
    const row = grid[slotId]
    const nr = {}
    for (const day of DAYS) {
      const c = row[day]
      nr[day] = c && ids.has(c.teacherId) ? { ...c, teacherId: '' } : c
    }
    g[slotId] = nr
  }
  return g
}

// Root reducer: owns the mode switch + whole-app import/reset, and routes every
// other action to a slice — scope:'tertiary' → tertiaryReducer, otherwise the
// K–12 reducer (which still operates on root.k12, so the entire K–12 code path
// above is preserved verbatim).
function rootReducer(root, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...root, mode: action.mode === 'tertiary' ? 'tertiary' : 'k12' }
    case 'IMPORT_ALL':
      return normalizeRoot(action.payload)
    case 'IMPORT_K12':
      return { ...root, k12: normalizeState(action.payload) }
    case 'RESET_K12':
      return { ...root, k12: { ...EMPTY_STATE } }
    default:
      if (action.scope === 'tertiary') {
        return { ...root, tertiary: tertiaryReducer(root.tertiary, action) }
      }
      return { ...root, k12: reducer(root.k12, action) }
  }
}

/* ============================================================
   Context + provider + hook
   ============================================================ */

const StoreContext = createContext(null)
const TertiaryContext = createContext(null)

export function StoreProvider({ children }) {
  const [root, dispatch] = useReducer(rootReducer, undefined, loadInitial)
  // The K–12 slice. Every existing K–12 action + selector below reads `state`,
  // so aliasing it to root.k12 keeps that code byte-for-byte unchanged; their
  // un-scoped actions are routed to the K–12 reducer by rootReducer. Theme lives
  // inside this slice and doubles as the shared app theme (tertiary reads it too).
  const state = root.k12

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(root))
    } catch {
      /* ignore quota errors */
    }
  }, [root])

  const actions = useMemo(() => {
    // A section's stable position among the sections of its OWN grade, ordered by
    // creation. This is the rotation offset handed to autoScheduleGrid so shared
    // subjects step one period further along in each successive section (the
    // staggered diagonal). It is derived from the grade — never the batch — so
    // regenerating one section still lines up with the others already on the grid.
    // Delegates to the exported sectionRotation so the manual editor and the
    // generator resolve a section's shared-subject teacher identically.
    const gradeRotation = (schedule) => sectionRotation(state.schedules, schedule.id)

    // Build a fresh timetable for ONE classroom against a fixed `pool` of other
    // schedules. Under the trimester model EVERY section — Kindergarten through
    // Senior High — carries THREE term programs ('1', '2', '3'; DepEd Order No.
    // 009, s. 2026), each scheduled independently into programs[sem]. Any grade's
    // subject may be pinned to one term, so its three programs can differ; a
    // subject left on "all terms" repeats in each. If no subjects are pinned (the
    // common case) the three programs come out identical. A Senior High section
    // additionally carries a strand. Because different terms never run at the same
    // time, each term is scheduled against only the pool's matching-term parts, so
    // terms may reuse the same teachers and rooms. Returns { empty, patch, poolRow,
    // placed, requested, unplaced, missingTeacher } — `patch` is what to store,
    // `poolRow` is fed forward so the next section is staggered around this one.
    const buildForSchedule = (schedule, pool) => {
      const room = state.rooms.find((r) => r.id === schedule.roomId)
      const grade = room ? room.gradeLevel : schedule.gradeLevel
      const bell = bellForGrade(state, grade)
      const rotation = gradeRotation(schedule)
      const programs = {}
      const missingIds = new Set()
      let placed = 0, requested = 0, unplaced = 0, subjectCount = 0
      for (const sem of ['1', '2', '3']) {
        const list = subjectsForSection(state.subjects, state.teachers, grade, rotation, {
          strandId: schedule.strandId || '',
          semester: sem,
        })
        subjectCount += list.length
        for (const s of list) if (!s.teacherId) missingIds.add(s.id)
        const res = autoScheduleGrid({ subjects: list, otherSchedules: pool, bell, rotation, semester: sem })
        programs[sem] = { timeSlots: res.timeSlots, grid: res.grid }
        placed += res.placed
        requested += res.requested
        unplaced += res.unplaced
      }
      return {
        empty: subjectCount === 0,
        patch: { programs, semester: '', timeSlots: undefined, grid: undefined },
        poolRow: { ...schedule, programs, semester: '' },
        placed,
        requested,
        unplaced,
        missingTeacher: missingIds.size,
      }
    }

    // Regenerate a list of classrooms in sequence, threading each freshly-built
    // grid into the pool the next one is staggered against. Calling
    // generateSchedule in a loop can't do this — every call in the same render
    // reads one stale `state` snapshot, so the sections never see each other and
    // collide. Here the pool starts with every classroom NOT in the batch (kept
    // fixed) and grows as we go, so the whole batch — plus everything outside it
    // — stays mutually conflict-free. autoScheduleGrid never double-books, so any
    // sessions that still can't fit come back as `unplaced`, never as a clash.
    // We process the batch in (grade, rotation) order so each grade's diagonal
    // builds up cleanly. One bulk dispatch updates them all together.
    const runBatchGenerate = (ids) => {
      const uniq = (Array.isArray(ids) ? ids : []).filter((id, i, a) => a.indexOf(id) === i)
      const idSet = new Set(uniq)
      const order = uniq
        .map((id) => state.schedules.find((s) => s.id === id))
        .filter(Boolean)
        .sort(
          (a, b) =>
            String(a.gradeLevel || '').localeCompare(String(b.gradeLevel || '')) ||
            gradeRotation(a) - gradeRotation(b)
        )
        .map((s) => s.id)
      const pool = state.schedules.filter((s) => !idSet.has(s.id))
      const patches = []
      let placed = 0, requested = 0, unplaced = 0, count = 0
      for (const id of order) {
        const schedule = state.schedules.find((s) => s.id === id)
        if (!schedule) continue
        // Each section is scheduled with its grade's subjects, each resolved to
        // ONE teacher. When several teachers share a subject, the section's
        // rotation index round-robins across them, spreading the load. Every
        // section (K–12) builds a separate program for all three terms.
        const res = buildForSchedule(schedule, pool)
        if (res.empty) continue
        patches.push({ id, patch: res.patch })
        // Feed this section's fresh grid forward so the next one avoids it.
        pool.push(res.poolRow)
        placed += res.placed
        requested += res.requested
        unplaced += res.unplaced
        count += 1
      }
      if (patches.length) dispatch({ type: 'UPDATE_SCHEDULES_BULK', patches })
      return { ok: true, count, placed, requested, unplaced }
    }

    return {
      /* teachers */
      addTeacher: (data) => {
        const teacher = {
          id: uid('tch'),
          lastName: '',
          firstName: '',
          gradeLevel: '',
          role: 'Non-moderator',
          subjectIds: [],
          ...data,
        }
        dispatch({ type: 'ADD_TEACHER', payload: teacher })
        return teacher
      },
      updateTeacher: (id, patch) => dispatch({ type: 'UPDATE_TEACHER', payload: { id, patch } }),
      deleteTeacher: (id) => dispatch({ type: 'DELETE_TEACHER', id }),
      // Remove many teachers at once (Clear all / checkbox multi-delete).
      deleteTeachers: (ids) => dispatch({ type: 'DELETE_TEACHERS_BULK', ids }),

      /* grade level rooms */
      addRoom: (data) => {
        const room = { id: uid('room'), gradeLevel: '', name: '', createdAt: Date.now(), ...data }
        dispatch({ type: 'ADD_ROOM', payload: room })
        return room
      },
      updateRoom: (id, patch) => dispatch({ type: 'UPDATE_ROOM', payload: { id, patch } }),
      deleteRoom: (id) => dispatch({ type: 'DELETE_ROOM', id }),
      // Remove many rooms at once — each takes its classrooms with it (Clear all /
      // checkbox multi-delete on the rooms list).
      deleteRooms: (ids) => dispatch({ type: 'DELETE_ROOMS_BULK', ids }),

      /* subjects (global — each owns its grade level; teachers link to them) */
      addSubject: (data) => {
        const subject = {
          id: uid('subj'),
          name: '',
          code: '',
          gradeLevel: '',
          color: SUBJECT_PALETTE[0],
          periodsPerWeek: 4,
          cadence: 'week',
          sessionsPerMonth: 2,
          strandId: '',
          semester: '',
          createdAt: Date.now(),
          ...data,
          cadence: data && data.cadence === 'month' ? 'month' : 'week',
          periodsPerWeek: clampFreq(data && data.periodsPerWeek),
          sessionsPerMonth: clampMonthly(data && data.sessionsPerMonth),
          strandId: (data && data.strandId) || '',
          semester: data && (data.semester === '1' || data.semester === '2' || data.semester === '3') ? data.semester : '',
        }
        dispatch({ type: 'ADD_SUBJECT', payload: subject })
        return subject
      },
      updateSubject: (id, patch) => dispatch({ type: 'UPDATE_SUBJECT', payload: { id, patch } }),
      deleteSubject: (id) => dispatch({ type: 'DELETE_SUBJECT', id }),
      // Remove many subjects at once (Clear all / checkbox multi-delete). Each is
      // dropped from every teacher's subjectIds and unassigned from every grid.
      deleteSubjects: (ids) => dispatch({ type: 'DELETE_SUBJECTS_BULK', ids }),

      /* schedules (classrooms / sections) */
      addSchedule: (data) => {
        const room = data && data.roomId ? state.rooms.find((r) => r.id === data.roomId) : null
        const grade = room ? room.gradeLevel : (data && data.gradeLevel) || ''
        const base = {
          id: uid('sch'),
          roomId: '',
          gradeLevel: '',
          section: '',
          moderatorId: '',
          strandId: '',
          ...data,
          // The room is the source of truth for grade level; keep it denormalized on the classroom.
          gradeLevel: grade,
          createdAt: Date.now(),
        }
        // Under the trimester model every section — Kindergarten through Senior
        // High — holds THREE term programs ('1', '2', '3'), each seeded with its
        // own bell-derived time slots and an empty grid, so even an ungenerated
        // section already shows the right times for every term. A Senior High
        // section also carries a strand; K–10 leaves it blank.
        const buildProg = () => {
          const ts = buildAutoTimeSlots(bellForGrade(state, grade))
          return { timeSlots: ts, grid: emptyGrid(ts) }
        }
        const schedule = {
          ...base,
          strandId: isShsGrade(grade) ? base.strandId || '' : '',
          semester: '',
          programs: {
            1: buildProg(),
            2: buildProg(),
            3: buildProg(),
          },
        }
        dispatch({ type: 'ADD_SCHEDULE', payload: schedule })
        return schedule
      },
      updateSchedule: (id, patch) => dispatch({ type: 'UPDATE_SCHEDULE', id, patch }),
      deleteSchedule: (id) => dispatch({ type: 'DELETE_SCHEDULE', id }),
      // Remove many classrooms at once (room-detail Clear all / checkbox multi-delete).
      deleteSchedules: (ids) => dispatch({ type: 'DELETE_SCHEDULES_BULK', ids }),
      // One-click automatic timetable for a single classroom. Builds fresh time
      // slots + grid from the grade's subjects, staggering shared teachers around
      // sections already built. Returns a summary for the UI to toast.
      generateSchedule: (scheduleId) => {
        const schedule = state.schedules.find((s) => s.id === scheduleId)
        if (!schedule) return { ok: false, reason: 'not-found' }
        const room = state.rooms.find((r) => r.id === schedule.roomId)
        const grade = room ? room.gradeLevel : schedule.gradeLevel
        const otherSchedules = state.schedules.filter((s) => s.id !== scheduleId)
        const res = buildForSchedule(schedule, otherSchedules)
        if (res.empty) return { ok: false, reason: 'no-subjects', grade }
        dispatch({ type: 'UPDATE_SCHEDULE', id: scheduleId, patch: res.patch })
        return {
          ok: true,
          grade,
          placed: res.placed,
          requested: res.requested,
          unplaced: res.unplaced,
          missingTeacher: res.missingTeacher,
        }
      },
      // Regenerate several classrooms at once, staggered around each other (and
      // everything else) so the batch is conflict-free — the right way to
      // "Generate all". Pass the classroom ids in the order you want them filled.
      generateSchedules: (ids) => runBatchGenerate(ids),
      // One-click conflict fixer. Finds every classroom currently involved in a
      // teacher clash and regenerates just those, in sequence, so the shared
      // teachers get re-staggered into free periods. Optionally limit the fix to
      // a set of classrooms (e.g. one room) with `scopeIds`; conflicts touching
      // those are still cleared even when the other side sits in another room.
      // Guaranteed to remove conflicts; leftover `unplaced` sessions mean a day
      // is genuinely too full (add a period / free a teacher).
      resolveConflicts: (scopeIds) => {
        const { conflicts } = computeConflicts(state.schedules)
        const involved = []
        const seen = new Set()
        for (const group of conflicts) {
          for (const it of group) {
            if (!seen.has(it.scheduleId)) {
              seen.add(it.scheduleId)
              involved.push(it.scheduleId)
            }
          }
        }
        let ids = involved
        if (Array.isArray(scopeIds) && scopeIds.length) {
          const scope = new Set(scopeIds)
          ids = involved.filter((id) => scope.has(id))
        }
        if (ids.length === 0) {
          return { ok: true, count: 0, placed: 0, requested: 0, unplaced: 0, nothing: true }
        }
        return runBatchGenerate(ids)
      },
      duplicateSchedule: (id, overrides = {}) => {
        const src = state.schedules.find((s) => s.id === id)
        if (!src) return null
        // Deep-copy one {timeSlots, grid} program, assigning fresh slot ids so
        // the copy's grid never aliases the source's rows.
        const copyProgram = (prog) => {
          const rows = Array.isArray(prog && prog.timeSlots) ? prog.timeSlots : []
          const idMap = {}
          const timeSlots = rows.map((slot) => {
            const nid = uid('slot')
            idMap[slot.id] = nid
            return { ...slot, id: nid }
          })
          const grid = {}
          for (const slot of rows) {
            if (slot.kind !== 'class') continue
            const oldRow = (prog.grid && prog.grid[slot.id]) || {}
            const newRow = {}
            for (const day of DAYS) newRow[day] = oldRow[day] ? { ...oldRow[day] } : null
            grid[idMap[slot.id]] = newRow
          }
          return { timeSlots, grid }
        }
        const shared = {
          id: uid('sch'),
          section: overrides.section != null ? overrides.section : `${src.section} (copy)`,
          gradeLevel: overrides.gradeLevel != null ? overrides.gradeLevel : src.gradeLevel,
          createdAt: Date.now(),
        }
        let copy
        if (src.programs) {
          const programs = {}
          for (const sem of ['1', '2', '3']) programs[sem] = copyProgram(src.programs[sem] || {})
          copy = { ...src, ...shared, programs }
        } else {
          const { timeSlots, grid } = copyProgram(src)
          copy = { ...src, ...shared, timeSlots, grid }
        }
        dispatch({ type: 'ADD_SCHEDULE', payload: copy })
        return copy
      },
      setTimeSlots: (id, timeSlots) => dispatch({ type: 'SET_TIME_SLOTS', id, timeSlots }),
      // Manual cell edits. `semester` ('1'/'2'/'3') targets the section's matching
      // term program; a legacy single-grid class falls back to its one grid.
      setEntry: (scheduleId, slotId, day, value, semester = '') =>
        dispatch({ type: 'SET_ENTRY', scheduleId, slotId, day, value, semester }),
      setEntriesBulk: (scheduleId, slotId, days, value, semester = '') =>
        dispatch({ type: 'SET_ENTRIES_BULK', scheduleId, slotId, days, value, semester }),
      // Remove every placed subject from a class's grid (the given term's program).
      // Time rows and bands are kept.
      clearGrid: (scheduleId, semester = '') =>
        dispatch({ type: 'CLEAR_GRID', scheduleId, semester }),

      /* theme + settings */
      setThemeKey: (key) => dispatch({ type: 'SET_THEME_KEY', key }),
      setCustomTheme: (theme) => dispatch({ type: 'SET_CUSTOM_THEME', theme }),
      clearCustomTheme: () => dispatch({ type: 'CLEAR_CUSTOM_THEME' }),
      setSetting: (key, value) => dispatch({ type: 'SET_SETTING', key, value }),
      // Per-grade bell schedule. Pass a config object to override, or null to
      // reset that grade back to the default bell schedule.
      setBellSchedule: (grade, value) =>
        dispatch({ type: 'SET_BELL_SCHEDULE', grade, value: value == null ? null : normalizeBell(value) }),

      /* data */
      // Restore from a backup. A v6 "root" backup replaces the whole app (both
      // modes); a legacy flat / K–12 backup restores just the K–12 slice, leaving
      // any tertiary data intact. normalizeRoot / normalizeState guard the shapes.
      importData: (payload) =>
        dispatch(isRootShape(payload) ? { type: 'IMPORT_ALL', payload } : { type: 'IMPORT_K12', payload }),
      // "Erase all data" here clears the K–12 slice only (this control lives in
      // the K–12 Appearance tab); tertiary data is left untouched.
      resetAll: () => dispatch({ type: 'RESET_K12' }),
    }
  }, [state])

  // Tertiary (college/university) slice — separate reducer + stateless action
  // creators, same dispatch. Every tertiary action is tagged scope:'tertiary' so
  // rootReducer sends it to tertiaryReducer.
  const tertiaryActions = useMemo(() => makeTertiaryActions(dispatch), [dispatch])

  // One-click timetable generation for the tertiary schedule view. These close
  // over the live tertiary slice (the stateless creators above can't — the engine
  // must read current programs/courses/faculty/rooms), run the pure placer, and
  // write each block's meetings back via T_SET_MEETINGS. Both return the
  // placement summary so the caller can toast placed / unplaced counts.
  const tertiaryGenerate = useMemo(
    () => ({
      generateBlock: (blockId, term) => {
        const res = autoScheduleTertiaryBlock(root.tertiary, blockId, term)
        dispatch({ type: 'T_SET_MEETINGS', blockId, term, meetings: res.meetings, scope: 'tertiary' })
        return res
      },
      generateTerm: (term, blockIds) => {
        const summary = autoScheduleTertiaryTerm(root.tertiary, term, blockIds)
        for (const [blockId, r] of Object.entries(summary.results)) {
          dispatch({ type: 'T_SET_MEETINGS', blockId, term, meetings: r.meetings, scope: 'tertiary' })
        }
        return summary
      },
    }),
    [root.tertiary, dispatch]
  )

  // Shared mode switch, used by the app shell to flip between K–12 and Tertiary.
  const setMode = useCallback((mode) => dispatch({ type: 'SET_MODE', mode }), [dispatch])

  // K–12 consumers (useStore): the k12 slice + shared mode switch. The shape is
  // identical to before the dual-mode refactor, so no K–12 panel changed.
  const value = useMemo(
    () => ({ state, dispatch, mode: root.mode, setMode, ...actions }),
    [state, actions, root.mode, setMode]
  )

  // Tertiary consumers (useTertiary): the tertiary slice + its actions + the
  // schedule-generation helpers.
  const tertiaryValue = useMemo(
    () => ({ state: root.tertiary, dispatch, mode: root.mode, setMode, ...tertiaryActions, ...tertiaryGenerate }),
    [root.tertiary, tertiaryActions, tertiaryGenerate, root.mode, setMode]
  )

  return (
    <StoreContext.Provider value={value}>
      <TertiaryContext.Provider value={tertiaryValue}>{children}</TertiaryContext.Provider>
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

// Tertiary slice + actions. Only components rendered inside StoreProvider (the
// whole app) can call this. Kept separate from useStore so K–12 code never sees
// tertiary state and vice-versa.
export function useTertiary() {
  const ctx = useContext(TertiaryContext)
  if (!ctx) throw new Error('useTertiary must be used within StoreProvider')
  return ctx
}
