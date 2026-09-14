// src/sampleData.js
//
// Demo / sample data for TEACHERaiah's K–12 mode. Powers the "Load sample data"
// hotkey (Shift+F2): one press swaps the whole K–12 slice for a complete example
// school with real subjects, teachers, rooms, sections and fully generated
// three-term timetables — so the app can be demoed or tried instantly.
//
// EVERY PRESS IS RANDOM. buildSampleK12State() first rolls a size tier —
//   • small : one grade, 1–2 sections
//   • half  : 2–3 grades, 1–2 sections each
//   • full  : 4–6 grades (always including a Senior High grade), 2–3 sections each
// — then randomizes which grades appear, their sections, the subject set (kept
// within a period budget so every section places cleanly), the teachers and their
// names, which subject is shared by two teachers (round-robin demo), and — for
// Senior High — each section's strand plus its Core / Applied / Elective and
// strand-specific subjects. So no two presses look alike, and the same shortcut
// can show a tiny school or a big one.
//
// This is a plain, PURE builder — no React, no localStorage (only Math.random /
// Date.now). It constructs a flat K–12 state object (the exact shape
// importData/normalizeState accept) and pre-generates every section's grid with
// the app's OWN scheduler (subjectsForSection + autoScheduleGrid), threading a
// growing pool exactly like the store's "Generate all" (runBatchGenerate). The
// result is therefore conflict-free and staggered — identical to what a user
// would get by clicking Generate on each section — but produced in one shot so
// the caller can load it with a single importData() dispatch (avoiding the
// stale-state pitfall of chaining add*/generate calls in one render).

import {
  APPLIED_STRAND_ID,
  DEFAULT_BELL,
  ELECTIVE_STRAND_ID,
  GRADE_LEVELS,
  SHS_STRANDS,
  SUBJECT_PALETTE,
  autoScheduleGrid,
  categoryForGrade,
  isShsGrade,
  subjectsForSection,
  uid,
} from './store.jsx'

/* ---------------- Randomness helpers ---------------- */
const rand = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rand(arr.length)]
const chance = (p) => Math.random() < p
const randInt = (lo, hi) => lo + rand(hi - lo + 1)
const shuffle = (arr) => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// k distinct random items from arr (clamped to arr length).
const sample = (arr, k) => shuffle(arr).slice(0, Math.max(0, Math.min(k, arr.length)))

/* ---------------- Content pools ---------------- */
const FIRST_NAMES = [
  'Maria', 'Jose', 'Ana', 'Luis', 'Pedro', 'Grace', 'Mark', 'Rina', 'Ben', 'Carlo',
  'Lea', 'Nico', 'Rosa', 'Ramon', 'Divina', 'Antonio', 'Cristina', 'Miguel', 'Elena',
  'Ramil', 'Joy', 'Dennis', 'Aileen', 'Rodel', 'Marites', 'Efren', 'Liza', 'Arnel',
  'Jenny', 'Noel', 'Cherry', 'Edwin', 'Grace', 'Ferdinand', 'Imelda', 'Danilo',
]
const LAST_NAMES = [
  'Reyes', 'Santos', 'Cruz', 'Garcia', 'Dela Cruz', 'Aquino', 'Bautista', 'Castillo',
  'Domingo', 'Espiritu', 'Fernandez', 'Gonzales', 'Ramos', 'Mendoza', 'Torres', 'Flores',
  'Villanueva', 'Navarro', 'Salvador', 'Aguilar', 'Rivera', 'Pascual', 'Del Rosario',
  'Mercado', 'Gutierrez', 'Lim', 'Tan', 'Ocampo', 'Marquez', 'Bermudez', 'Padilla', 'Soriano',
]
// Section (class) names for non-SHS grades. SHS sections are named from their strand.
const K10_SECTION_NAMES = [
  'Sampaguita', 'Rosal', 'Gumamela', 'Ilang-Ilang', 'Camia', 'Santan', 'Rizal', 'Mabini',
  'Bonifacio', 'Del Pilar', 'Emerald', 'Ruby', 'Sapphire', 'Diamond', 'Garnet', 'Amethyst',
  'Topaz', 'Faith', 'Hope', 'Charity', 'Integrity', 'Courage',
]

// Subject templates per grade-level category: [name, code-abbrev, periodsPerWeek].
// The grade number is appended to the code so codes stay unique across grades.
const SUBJECTS_BY_CATEGORY = {
  preschool: [
    ['Language, Literacy & Communication', 'LLC', 5],
    ['Mathematics', 'MATH', 5],
    ['Physical & Natural Environment', 'PNE', 3],
    ['Values Education', 'VE', 3],
    ['Music & Movement', 'MM', 2],
  ],
  'grade-school': [
    ['Mathematics', 'MATH', 5],
    ['English', 'ENG', 5],
    ['Filipino', 'FIL', 5],
    ['Science', 'SCI', 4],
    ['Araling Panlipunan', 'AP', 3],
    ['MAPEH', 'MAPEH', 4],
    ['Edukasyon sa Pagpapakatao', 'ESP', 3],
    ['Makabansa', 'MAK', 3],
  ],
  jhs: [
    ['Mathematics', 'MATH', 4],
    ['English', 'ENG', 4],
    ['Filipino', 'FIL', 4],
    ['Science', 'SCI', 4],
    ['Araling Panlipunan', 'AP', 3],
    ['MAPEH', 'MAPEH', 4],
    ['Edukasyon sa Pagpapakatao', 'ESP', 2],
    ['Technology & Livelihood Education', 'TLE', 4],
  ],
}

// Senior High cross-strand subjects (taken by every section of the grade).
const SHS_CORE = [
  ['Oral Communication', 'ORAL COMM', 3],
  ['General Mathematics', 'GEN MATH', 3],
  ['Earth and Life Science', 'ELS', 3],
  ['Understanding Culture, Society & Politics', 'UCSP', 3],
  ['Komunikasyon sa Akademikong Filipino', 'KOMFIL', 3],
  ['Physical Education and Health', 'PEH', 2],
  ['Personal Development', 'PERDEV', 2],
  ['Contemporary Philippine Arts', 'CPAR', 2],
]
const SHS_APPLIED = [
  ['English for Academic & Professional Purposes', 'EAPP', 3],
  ['Practical Research 1', 'PR1', 3],
  ['Empowerment Technologies', 'EMPTECH', 3],
  ['Entrepreneurship', 'ENTREP', 3],
  ['Filipino sa Piling Larangan', 'FPL', 3],
]
const SHS_ELECTIVE = [
  ['Human Movement 1 (Elective)', 'HM 1', 2],
  ['Creative Writing (Elective)', 'CW', 2],
]
// Strand-specific subjects, keyed by SHS strand id.
const SHS_STRAND_SUBJECTS = {
  stem: [['Pre-Calculus', 'PRE-CALC', 4], ['General Chemistry 1', 'GEN CHEM 1', 4], ['General Biology 1', 'GEN BIO 1', 4]],
  abm: [['Business Mathematics', 'BUS MATH', 4], ['Fundamentals of ABM 1', 'FABM 1', 4], ['Applied Economics', 'APP ECON', 3]],
  humss: [['Creative Nonfiction', 'CNF', 3], ['Introduction to World Religions', 'IWRBS', 3], ['Philippine Politics & Governance', 'PPG', 3]],
  gas: [['Humanities 1', 'HUM 1', 3], ['Social Science 1', 'SOCSCI 1', 3], ['Applied Economics', 'APP ECON', 3]],
  'tvl-he': [['Cookery', 'COOK', 4], ['Food & Beverage Services', 'FBS', 4]],
  'tvl-ict': [['Computer Programming', 'COMPROG', 4], ['Computer Systems Servicing', 'CSS', 4]],
  'tvl-afa': [['Crop Production', 'CROP', 4], ['Animal Production', 'ANIPRO', 4]],
  'tvl-ia': [['Carpentry', 'CARP', 4], ['Electrical Installation & Maintenance', 'EIM', 4]],
  sports: [['Human Movement Sciences', 'HMS', 4], ['Officiating 1', 'OFF 1', 3]],
  arts: [['Creative Industries 1', 'CI 1', 3], ['Media & Arts Production', 'MAP', 3]],
}

// Grade number for codes/section names ("Kindergarten" → "K", "Grade 11" → "11").
const gradeNum = (g) => (g === 'Kindergarten' ? 'K' : (String(g).match(/\d+/) || [''])[0])

// Max periods/week a single section may carry. The default bell has 6 periods ×
// 5 days = 30 class cells; capping section load at 24 leaves rest days free and
// guarantees the auto-scheduler places every session with nothing unplaced.
const SECTION_CAP = 24

// Pick a subset of [name, abbr, periods] templates whose total periods fit within
// `cap`, aiming for a random count in [minC, maxC]. Always returns at least one
// (the first that fits) when the pool is non-empty and cap allows.
function chooseWithinCap(templates, cap, minC, maxC) {
  const target = randInt(minC, maxC)
  const chosen = []
  let sum = 0
  for (const t of shuffle(templates)) {
    if (chosen.length >= target) break
    if (sum + t[2] <= cap) {
      chosen.push(t)
      sum += t[2]
    }
  }
  if (!chosen.length) {
    const fit = templates.find((t) => t[2] <= cap)
    if (fit) chosen.push(fit)
  }
  return chosen
}

/* ---------------- Builder ---------------- */
// Build a complete, ready-to-view K–12 sample state. Returns a fresh (and
// randomly sized) object every call, with new ids each time, so re-loading always
// yields a clean, different dataset. The returned object also carries a `tier`
// hint ('small' | 'half' | 'full') for the caller's toast; normalizeState ignores
// it, so it never persists.
export function buildSampleK12State() {
  // Strictly increasing createdAt keeps rotation order (sections within a grade)
  // and sharer order (teachers of a shared subject) deterministic and matching
  // what the app would recompute on a later Regenerate.
  const base = Date.now()
  let seq = 0
  const stamp = () => base + seq++

  const teachers = []
  const subjects = []
  const usedNames = new Set()
  const colorStart = rand(SUBJECT_PALETTE.length)
  let colorIx = 0
  const nextColor = () => SUBJECT_PALETTE[(colorStart + colorIx++) % SUBJECT_PALETTE.length]

  const makeTeacher = (gradeLevel, role = 'Non-moderator') => {
    let firstName = pick(FIRST_NAMES)
    let lastName = pick(LAST_NAMES)
    for (let i = 0; i < 60 && usedNames.has(`${firstName} ${lastName}`); i++) {
      firstName = pick(FIRST_NAMES)
      lastName = pick(LAST_NAMES)
    }
    usedNames.add(`${firstName} ${lastName}`)
    const t = { id: uid('tch'), firstName, lastName, gradeLevel, role, subjectIds: [], createdAt: stamp() }
    teachers.push(t)
    return t
  }
  const makeSubject = (name, code, gradeLevel, periods, opts = {}) => {
    const s = {
      id: uid('subj'),
      name,
      code,
      gradeLevel,
      color: nextColor(),
      cadence: 'week',
      periodsPerWeek: periods,
      sessionsPerMonth: 2,
      strandId: opts.strandId || '',
      semester: opts.semester || '',
      createdAt: stamp(),
    }
    subjects.push(s)
    return s
  }

  const rooms = []
  const sections = []

  // Add `count` sections for a grade. `subjectOwners` are the grade's teachers, in
  // order, used to pick a distinct adviser (moderator) per section. `strandFor` is
  // called per section index to get its strand id ('' for non-SHS) and name.
  const addSections = (grade, room, count, subjectOwners, strandFor) => {
    for (let i = 0; i < count; i++) {
      const { strandId, name } = strandFor(i)
      const moderator = subjectOwners.length ? subjectOwners[i % subjectOwners.length] : null
      if (moderator) moderator.role = 'Moderator'
      sections.push({
        id: uid('sch'),
        roomId: room.id,
        gradeLevel: grade,
        section: name,
        moderatorId: moderator ? moderator.id : '',
        strandId,
        semester: '',
        createdAt: stamp(),
        _rotation: i,
      })
    }
  }

  // A non-SHS grade: one shared subject set for all its sections, one teacher per
  // subject (so that teacher teaches every section, staggered). For a multi-section
  // grade, usually give one subject a second teacher so the round-robin shows.
  const buildK10Grade = (grade, room, secCount) => {
    const cat = categoryForGrade(grade)
    const key = cat && SUBJECTS_BY_CATEGORY[cat.key] ? cat.key : 'grade-school'
    const templates = SUBJECTS_BY_CATEGORY[key] || SUBJECTS_BY_CATEGORY['grade-school']
    const num = gradeNum(grade)
    const [minC, maxC] = key === 'preschool' ? [3, 5] : [5, 7]
    const gradeSubjects = chooseWithinCap(templates, SECTION_CAP, minC, maxC).map(([name, abbr, per]) =>
      makeSubject(name, `${abbr} ${num}`, grade, per)
    )
    const owners = gradeSubjects.map((s) => {
      const t = makeTeacher(grade)
      t.subjectIds.push(s.id)
      return t
    })
    if (secCount >= 2 && gradeSubjects.length && chance(0.8)) {
      const shared = makeTeacher(grade)
      shared.subjectIds.push(pick(gradeSubjects).id) // 2nd teacher of one subject → round-robin
    }
    const names = sample(K10_SECTION_NAMES, secCount)
    addSections(grade, room, secCount, owners, (i) => ({ strandId: '', name: names[i] || `Section ${i + 1}` }))
  }

  // A Senior High grade: cross-strand Core/Applied/Elective subjects taken by every
  // section, plus strand-specific subjects for each section's (distinct) strand.
  const buildShsGrade = (grade, room, secCount) => {
    const num = gradeNum(grade)
    const strands = sample(SHS_STRANDS, secCount)
    const crossSubjects = []
    for (const [name, abbr, per] of chooseWithinCap(SHS_CORE, 14, 3, 4))
      crossSubjects.push(makeSubject(name, `${abbr} ${num}`, grade, per))
    for (const [name, abbr, per] of sample(SHS_APPLIED, randInt(1, 2)))
      crossSubjects.push(makeSubject(name, `${abbr} ${num}`, grade, per, { strandId: APPLIED_STRAND_ID }))
    if (chance(0.7)) {
      const [name, abbr, per] = pick(SHS_ELECTIVE)
      crossSubjects.push(makeSubject(name, `${abbr} ${num}`, grade, per, { strandId: ELECTIVE_STRAND_ID }))
    }
    const owners = crossSubjects.map((s) => {
      const t = makeTeacher(grade)
      t.subjectIds.push(s.id)
      return t
    })
    const crossPeriods = crossSubjects.reduce((a, s) => a + s.periodsPerWeek, 0)
    const strandBudget = SECTION_CAP - crossPeriods
    for (const st of strands) {
      const pool = SHS_STRAND_SUBJECTS[st.id] || []
      for (const [name, abbr, per] of chooseWithinCap(pool, strandBudget, 1, 2)) {
        const s = makeSubject(name, `${abbr} ${num}`, grade, per, { strandId: st.id })
        const t = makeTeacher(grade)
        t.subjectIds.push(s.id)
        owners.push(t)
      }
    }
    if (secCount >= 2 && crossSubjects.length && chance(0.7)) {
      const shared = makeTeacher(grade)
      shared.subjectIds.push(pick(crossSubjects).id)
    }
    addSections(grade, room, secCount, owners, (i) => ({
      strandId: strands[i].id,
      name: `${strands[i].abbr} ${num}-${String.fromCharCode(65 + i)}`,
    }))
  }

  /* ---------------- Roll a size tier and choose grades ---------------- */
  const tier = pick(['small', 'half', 'full'])
  let gradeCount
  let secLo
  let secHi
  if (tier === 'small') {
    gradeCount = 1
    secLo = 1
    secHi = 2
  } else if (tier === 'half') {
    gradeCount = randInt(2, 3)
    secLo = 1
    secHi = 2
  } else {
    gradeCount = randInt(4, 6)
    secLo = 2
    secHi = 3
  }

  let chosenGrades
  if (tier === 'full') {
    // Guarantee a Senior High grade so strands / Core / Applied / Elective all show.
    const shs = sample(['Grade 11', 'Grade 12'], 1)
    const rest = shuffle(GRADE_LEVELS.filter((g) => !shs.includes(g))).slice(0, gradeCount - 1)
    chosenGrades = shuffle([...shs, ...rest])
  } else {
    chosenGrades = sample(GRADE_LEVELS, gradeCount)
  }

  for (const grade of chosenGrades) {
    const room = { id: uid('room'), gradeLevel: grade, name: '', createdAt: stamp() }
    rooms.push(room)
    const secCount = randInt(secLo, secHi)
    if (isShsGrade(grade)) buildShsGrade(grade, room, secCount)
    else buildK10Grade(grade, room, secCount)
  }

  /* ---------------- Pre-generate every section's three-term timetable ----------------
     Mirror the store's batch generator (runBatchGenerate): build each section
     against a growing pool of the ones already built, so a teacher shared between
     sections is staggered and never double-booked. Every K–12 section carries a
     program per term ('1','2','3'); with no term-pinned subjects here, the three
     come out identical (matching the app's documented all-terms behavior). */
  const pool = []
  const schedules = sections.map((sec) => {
    const programs = {}
    for (const sem of ['1', '2', '3']) {
      const list = subjectsForSection(subjects, teachers, sec.gradeLevel, sec._rotation, {
        strandId: sec.strandId || '',
        semester: sem,
      })
      const res = autoScheduleGrid({
        subjects: list,
        otherSchedules: pool,
        bell: DEFAULT_BELL,
        rotation: sec._rotation,
        semester: sem,
      })
      programs[sem] = { timeSlots: res.timeSlots, grid: res.grid }
    }
    const { _rotation, ...rest } = sec
    const built = { ...rest, programs }
    pool.push(built) // scheduleParts() reads .programs, so the next section staggers around this one
    return built
  })

  const state = {
    teachers,
    rooms,
    subjects,
    schedules,
    themeKey: 'green',
    customTheme: null,
    // Show the teacher name inside each cell so the generated demo reads clearly.
    settings: { showTeacherInCell: true, bellSchedules: {} },
  }
  // Expose the rolled size to the caller (for its toast) WITHOUT letting it become
  // part of the imported state: a non-enumerable prop is readable as state.tier but
  // skipped by object spread (normalizeState does `...payload`) and JSON.stringify,
  // so it never lands in localStorage or a backup.
  Object.defineProperty(state, 'tier', { value: tier, enumerable: false })
  return state
}
