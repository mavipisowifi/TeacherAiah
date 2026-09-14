import React, { useMemo, useState } from 'react'
import {
  useStore,
  computeConflicts,
  formatTeacherName,
  subjectsForClass,
  subjectsForSection,
  subjectsMissingTeacherForClass,
  teachersForSubject,
  sectionRotation,
  assignedCount,
  usageCount,
  clampFreq,
  subjectCadence,
  cadenceLabel,
  isShsGrade,
  strandLabel,
  strandFullName,
  semesterLabel,
  programForSemester,
  bellForGrade,
  fridayOverrides,
  SEMESTERS,
  DAYS,
} from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, IconButton, Icon, Badge, Modal, Field, Select } from './ui.jsx'
import ScheduleTable from './ScheduleTable.jsx'

/* ============================================================
   ScheduleBuilder — a classroom's weekly program.
   Opening a classroom shows its weekly grid — blank at first, or
   filled once generated. Two ways to fill it, side by side:
     • One-click auto-generate places every subject on its set
       number of days per week (taught by its teacher), staggering
       shared teachers so none is double-booked and leaving the
       other periods free as rest time.
     • Manual editing: click any period cell to add, change, or
       remove a subject by hand.
   This view generates, edits, previews, and prints.
   ============================================================ */

export default function ScheduleBuilder({ scheduleId, onBack, onEditMeta }) {
  const { state, generateSchedule, resolveConflicts, setSetting, setEntriesBulk, clearGrid } = useStore()
  const { openPrint, showToast } = useUI()
  // Which term's program is on screen ('1'/'2'/'3'). Every grade now keeps a
  // separate timetable per term (DepEd trimester), so this applies to all grades,
  // not just Senior High.
  const [semester, setSemester] = useState('1')
  // The cell currently open in the manual editor, or null. { slotId, day }.
  const [editing, setEditing] = useState(null)
  // Whether the "Clear all subjects?" confirmation is open.
  const [confirmClear, setConfirmClear] = useState(false)

  const schedule = state.schedules.find((s) => s.id === scheduleId)
  const conflicts = useMemo(() => computeConflicts(state.schedules), [state.schedules])
  const teachersById = useMemo(
    () => Object.fromEntries(state.teachers.map((t) => [t.id, t])),
    [state.teachers]
  )

  if (!schedule) {
    return (
      <div>
        <Button icon="up" onClick={onBack}>Back to classrooms</Button>
        <p className="mt-4 text-slate-500">This classroom no longer exists.</p>
      </div>
    )
  }

  const grade = schedule.gradeLevel
  const isShs = isShsGrade(grade)
  // Every grade now keeps three term programs, so the active term applies to all
  // grades (K–10 included). `isShs` still gates only the STRAND concept below.
  const activeSem = semester
  // The single program (timeSlots + grid) shown for the active term.
  const prog = programForSemester(schedule, activeSem)
  const semSchedule = {
    id: schedule.id,
    gradeLevel: grade,
    section: schedule.section,
    moderatorId: schedule.moderatorId,
    timeSlots: prog.timeSlots,
    grid: prog.grid,
  }
  // Subjects + missing-teacher gate are scoped to the active term for EVERY
  // grade, plus the section's strand for Senior High (strandId is '' otherwise,
  // which subjectsForClass ignores for non-SHS grades).
  const sectionSubjects = subjectsForClass(state.subjects, grade, schedule.strandId || '', activeSem)
  const missing = subjectsMissingTeacherForClass(state.subjects, state.teachers, grade, schedule.strandId || '', activeSem)
  const missingTeacher = missing.length
  const canGenerate = sectionSubjects.length > 0 && missingTeacher === 0
  const count = assignedCount(semSchedule)
  const isGenerated = count > 0
  const adviser = schedule.moderatorId ? teachersById[schedule.moderatorId] : null
  const myConflicts = conflicts.conflicts.filter(
    (group) => group.some((it) => it.scheduleId === scheduleId && (!it.semester || it.semester === activeSem))
  )

  // Sessions that couldn't be placed conflict-free: for each subject this grade
  // takes, compare the days-per-week it wants against the cells actually filled
  // in this classroom. A positive total means the day is too full (add a period
  // in Schedule Times) or the teacher is saturated in other sections/grades.
  const shortfall = useMemo(() => {
    if (!isGenerated) return 0
    let miss = 0
    for (const s of sectionSubjects) {
      // Monthly subjects reserve a single weekly slot (the generator uses
      // cells:1 for them), so they "want" 1 — not their per-week number, which
      // is meaningless for a monthly cadence. Weekly subjects want their clamped
      // per-week count. Keeping this in lockstep with autoScheduleGrid stops a
      // correctly-filled monthly subject from tripping the "unfilled" banner.
      const want = subjectCadence(s) === 'month' ? 1 : clampFreq(s.periodsPerWeek)
      // usageCount over the active term's program only (semSchedule holds that
      // single grid), so a subject taught in another term isn't counted.
      const got = usageCount(s.id, [semSchedule])
      if (got < want) miss += want - got
    }
    return miss
  }, [isGenerated, sectionSubjects, semSchedule])

  // ---- Manual editing ----
  // The section's stable rotation index — resolves which sharer of a shared
  // subject this section gets by default, matching what Generate would pick.
  const rotation = useMemo(() => sectionRotation(state.schedules, scheduleId), [state.schedules, scheduleId])
  // The subjects this section can place by hand, each pre-resolved to one teacher
  // (the rotation pick). Scoped to the active term for every grade, plus the
  // section's strand for Senior High.
  const placeable = useMemo(
    () =>
      subjectsForSection(state.subjects, state.teachers, grade, rotation, {
        strandId: schedule.strandId || '',
        semester: activeSem,
      }),
    [state.subjects, state.teachers, grade, rotation, schedule.strandId, activeSem]
  )
  // Friday reserved rows (activity / early dismissal) for this program's times,
  // so the editor can lock the Friday column on exactly those rows.
  const fri = useMemo(
    () => fridayOverrides(bellForGrade(state, grade), prog.timeSlots),
    [state, grade, prog.timeSlots]
  )

  const editSlot = editing ? prog.timeSlots.find((s) => s.id === editing.slotId) : null
  const editCell = editing ? (prog.grid[editing.slotId] || {})[editing.day] || null : null
  const editFriReserved = !!(editing && fri && (fri.activity[editing.slotId] || fri.dismissed[editing.slotId]))

  // Add / change / remove one or more cells in the active program. Term-aware so
  // an edit lands in the selected term's program and leaves the other terms alone.
  function applyCell(days, value) {
    if (!editing || !days.length) return
    setEntriesBulk(scheduleId, editing.slotId, days, value, activeSem)
    setEditing(null)
    showToast(value ? 'Subject placed' : 'Cell cleared')
  }

  // Wipe every placed subject from the table (the active term's program). Time
  // rows and bands stay; the view falls back to its empty state so the user can
  // Generate again or rebuild by hand.
  function handleClearAll() {
    clearGrid(scheduleId, activeSem)
    setConfirmClear(false)
    setEditing(null)
    showToast(`Cleared all subjects · ${semesterLabel(activeSem)}`)
  }

  function handleGenerate() {
    const res = generateSchedule(scheduleId)
    if (!res.ok) {
      showToast(
        res.reason === 'no-subjects'
          ? `No subjects for ${grade} yet — add them in the Subjects tab`
          : 'Could not generate schedule',
        'error'
      )
      return
    }
    let msg = `Generated ${res.placed} of ${res.requested} session${res.requested === 1 ? '' : 's'}`
    const notes = []
    if (res.unplaced) notes.push(`${res.unplaced} couldn't fit conflict-free`)
    if (res.missingTeacher) notes.push(`${res.missingTeacher} without a teacher`)
    if (notes.length) msg += ` · ${notes.join(' · ')}`
    showToast(msg, res.unplaced || res.missingTeacher ? 'error' : 'success')
  }

  // Auto-fix teacher clashes: re-stagger the conflicting sections in this
  // classroom's room so no shared teacher is double-booked.
  function handleFix() {
    const roomIds = state.schedules.filter((x) => x.roomId === schedule.roomId).map((x) => x.id)
    const res = resolveConflicts(roomIds.length ? roomIds : [scheduleId])
    if (res.nothing || res.count === 0) {
      showToast('No conflicts to fix')
      return
    }
    const base = `Fixed ${res.count} conflicting schedule${res.count === 1 ? '' : 's'}`
    showToast(
      res.unplaced
        ? `${base} · ${res.unplaced} session${res.unplaced === 1 ? '' : 's'} still can't fit — add a class period or free up a teacher`
        : base,
      res.unplaced ? 'error' : 'success'
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton icon="up" title="Back" variant="secondary" onClick={onBack} />
        <div>
          <h1 className="text-lg font-bold leading-tight text-slate-900">
            {grade} · {schedule.section}
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            {isShs ? (
              <>
                <Badge tone={schedule.strandId ? 'green' : 'slate'} title={strandFullName(schedule.strandId)}>
                  {strandLabel(schedule.strandId)}
                </Badge>
                <span className="text-slate-300">·</span>
              </>
            ) : null}
            {adviser ? `Adviser: ${formatTeacherName(adviser)}` : 'No adviser set'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Term switch — every grade keeps a separate program per term. */}
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
            {SEMESTERS.map((sem) => (
              <button
                key={sem.id}
                onClick={() => setSemester(sem.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  semester === sem.id ? 'bg-green-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {sem.short}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={state.settings.showTeacherInCell}
              onChange={(e) => setSetting('showTeacherInCell', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-400"
            />
            Show teacher names
          </label>
          <Button icon="edit" onClick={onEditMeta}>Details</Button>
          <Button icon="calendar" onClick={handleGenerate} disabled={!canGenerate}>
            {isGenerated ? 'Regenerate' : 'Generate'}
          </Button>
          {isGenerated && (
            <Button icon="trash" variant="secondary" onClick={() => setConfirmClear(true)}>
              Clear all
            </Button>
          )}
          <Button
            variant="primary"
            icon="print"
            onClick={() => openPrint({ type: 'section', scheduleId, semester: activeSem })}
            disabled={!isGenerated}
          >
            Preview / Print
          </Button>
        </div>
      </div>

      {/* Missing-teacher gate — every subject in the grade needs a teacher */}
      {sectionSubjects.length > 0 && missingTeacher > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {missingTeacher} subject{missingTeacher === 1 ? '' : 's'} in {grade} still {missingTeacher === 1 ? 'has' : 'have'} no
            teacher, so this section can't be <em>auto-generated</em> yet: <strong>{missing.map((s) => s.name).join(', ')}</strong>. Assign
            {missingTeacher === 1 ? ' a teacher' : ' teachers'} in the <strong>Subject Teachers</strong> tab to generate — or place any
            subject by hand below.
          </span>
        </div>
      )}

      {/* Unfilled-sessions notice — covers both a manual gap and an auto clash */}
      {isGenerated && shortfall > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {shortfall} weekly session{shortfall === 1 ? '' : 's'} {shortfall === 1 ? 'is' : 'are'} still unfilled — a subject
            appears on fewer days than its per-week setting. Place {shortfall === 1 ? 'it' : 'them'} by hand on a free day,
            adjust the subject, add a class period in <strong>Schedule Times</strong>, free up a booked teacher, or{' '}
            <strong>Regenerate</strong>.
          </span>
        </div>
      )}

      {/* Conflict banner */}
      {myConflicts.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Icon name="warning" className="h-4 w-4" /> Teacher conflicts in this schedule
          </div>
          <ul className="space-y-0.5 text-xs text-amber-800">
            {myConflicts.map((group, i) => {
              const t = teachersById[group[0].teacherId]
              const where = group.map((it) => `${it.gradeLevel} ${it.section}`).join(' & ')
              return (
                <li key={i}>
                  <strong>{t ? formatTeacherName(t) : 'A teacher'}</strong> is booked in {group.length} places on{' '}
                  {group[0].day} at {group[0].time} — {where}.
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-xs text-amber-700">
            Tip: click <strong>Fix conflicts</strong> to let TEACHERaiah re-stagger the shared teacher into a free period.
          </p>
          <div className="mt-2">
            <Button variant="warn" size="sm" icon="check" onClick={handleFix}>Fix conflicts</Button>
          </div>
        </div>
      )}

      {/* Body: the weekly grid — blank until filled. Editable in place, and/or
          filled in one click with Generate. */}
      {!isGenerated && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Icon name="calendar" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          {sectionSubjects.length === 0 ? (
            <span>
              No subjects for {grade}{isShs ? ' in this strand/term' : ''} yet. Add them in the{' '}
              <strong>Subjects</strong> tab (then link a teacher in <strong>Subject Teachers</strong>) — after that you can
              auto-generate or place them by hand here.
            </span>
          ) : (
            <span>
              This program is empty. Click <strong>{canGenerate ? 'Generate' : 'a period cell below'}</strong> to fill it —{' '}
              {canGenerate
                ? 'the whole week is placed automatically, or click any period cell to build it by hand.'
                : 'auto-generate unlocks once every subject has a teacher.'}
            </span>
          )}
        </div>
      )}

      <div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
          <ScheduleTable
            schedule={schedule}
            semester={activeSem}
            editable
            onEditCell={(slotId, day) => setEditing({ slotId, day })}
            conflictCells={conflicts.cellKeys}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Click any period cell to add, change, or remove a subject by hand. <strong>Generate</strong> fills the whole week
          automatically; <strong>Regenerate</strong> rebuilds it from this grade's subjects and teachers (replacing manual
          edits). <strong>Preview / Print</strong> exports it.
        </p>
      </div>

      {/* Manual cell editor */}
      {editing && editSlot && (
        <CellEditorModal
          key={`${editing.slotId}|${editing.day}|${activeSem}`}
          open
          onClose={() => setEditing(null)}
          grade={grade}
          section={schedule.section}
          semLabel={semesterLabel(activeSem)}
          day={editing.day}
          time={editSlot.time}
          currentCell={editCell}
          placeable={placeable}
          teachers={state.teachers}
          friReserved={editFriReserved}
          onApply={applyCell}
        />
      )}

      {/* Confirm clearing the whole table (the active term's program) */}
      {confirmClear && (
        <Modal
          open
          onClose={() => setConfirmClear(false)}
          title="Clear all subjects?"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmClear(false)}>Cancel</Button>
              <Button variant="danger" icon="trash" onClick={handleClearAll}>Clear all</Button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            This removes {count === 1 ? 'the 1 placed subject' : `all ${count} placed subjects`} from the{' '}
            <strong>{semesterLabel(activeSem)}</strong> table. The time rows and the Homeroom / Recess / Lunch /
            Dismissal bands stay, so you can <strong>Generate</strong> again or rebuild it by hand.
          </p>
          <p className="mt-2 text-sm text-slate-500">The other terms' programs are left untouched.</p>
          <p className="mt-2 text-xs text-slate-400">This can't be undone.</p>
        </Modal>
      )}
    </div>
  )
}

/* ============================================================
   CellEditorModal — add / change / remove the subject in one grid
   cell (or across several weekdays at the same period). Teacher is
   resolved automatically (the section's rotation pick); when a
   subject is shared by several teachers you can choose which one.
   Friday is locked on rows reserved for the activity period or
   early dismissal. Freshly mounted per cell (keyed by the caller),
   so its form always starts from the clicked cell's contents.
   ============================================================ */
function CellEditorModal({ open, onClose, grade, section, semLabel, day, time, currentCell, placeable, teachers, friReserved, onApply }) {
  const byId = useMemo(() => {
    const m = {}
    for (const s of placeable) m[s.id] = s
    return m
  }, [placeable])

  const sharersOf = (sid) => (sid ? teachersForSubject(teachers, sid) : [])
  const defaultTeacher = (sid) => {
    if (!sid) return ''
    const rot = byId[sid]
    if (rot && rot.teacherId) return rot.teacherId
    const sh = sharersOf(sid)
    return sh.length ? sh[0].id : ''
  }

  const [subjectId, setSubjectId] = useState(currentCell ? currentCell.subjectId : '')
  const [teacherId, setTeacherId] = useState(currentCell ? currentCell.teacherId || '' : '')
  const [days, setDays] = useState(() => {
    const d = {}
    for (const x of DAYS) d[x] = x === day
    return d
  })

  const sharers = sharersOf(subjectId)
  const selectedDays = DAYS.filter((x) => days[x])
  // A monthly subject reserves a single weekly period — the generator places it
  // in exactly one slot on one day, stamped e.g. "2×/mo". So when one is chosen
  // the day picker becomes single-choice: spreading a 2×/month subject across
  // several weekdays would misrepresent it as a multi-day-a-week class.
  const selectedSubject = subjectId ? byId[subjectId] : null
  const monthly = !!selectedSubject && subjectCadence(selectedSubject) === 'month'

  // Collapse a day-selection map to a single weekday (used when a monthly
  // subject is picked): keep the first day already chosen, else the cell's own
  // day. Never keeps a reserved Friday (which is locked anyway).
  function collapseToOneDay(d) {
    const picked = DAYS.filter((x) => d[x] && !(x === 'FRI' && friReserved))
    const keep = picked.length ? picked[0] : day
    const nd = {}
    for (const x of DAYS) nd[x] = x === keep
    return nd
  }

  function chooseSubject(sid) {
    setSubjectId(sid)
    setTeacherId(defaultTeacher(sid))
    const picked = sid ? byId[sid] : null
    if (picked && subjectCadence(picked) === 'month') setDays((d) => collapseToOneDay(d))
  }
  function toggleDay(x) {
    if (x === 'FRI' && friReserved) return
    // Monthly subject: selecting a day replaces the choice (one weekly slot).
    if (monthly) {
      setDays(() => {
        const nd = {}
        for (const y of DAYS) nd[y] = y === x
        return nd
      })
      return
    }
    setDays((d) => ({ ...d, [x]: !d[x] }))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Edit period"
      footer={
        <>
          {currentCell ? (
            <Button variant="danger" icon="trash" onClick={() => onApply([day], null)}>
              Clear this cell
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!subjectId || selectedDays.length === 0}
            onClick={() => onApply(selectedDays, { subjectId, teacherId })}
          >
            {currentCell ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        {grade} · {section}
        {semLabel ? ` · ${semLabel}` : ''} — {time}
      </p>

      {placeable.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No subjects are available for this section yet. Add them in the <strong>Subjects</strong> tab (and link a teacher in{' '}
          <strong>Subject Teachers</strong>), then come back to place them.
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Subject">
            <Select value={subjectId} onChange={(e) => chooseSubject(e.target.value)}>
              <option value="">— Choose a subject —</option>
              {placeable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.code ? ` (${s.code})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          {subjectId && sharers.length > 1 ? (
            <Field label="Teacher" hint="This subject is shared — choose who teaches this section.">
              <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {sharers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatTeacherName(t)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {subjectId && sharers.length === 1 ? (
            <p className="text-xs text-slate-500">
              Teacher: <strong>{formatTeacherName(sharers[0])}</strong>
            </p>
          ) : null}

          {subjectId && sharers.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No teacher is linked to this subject yet — it will be placed with no teacher. Assign one in the{' '}
              <strong>Subject Teachers</strong> tab.
            </div>
          ) : null}

          <Field
            label={monthly ? 'Day' : 'Days'}
            hint={
              monthly
                ? `${selectedSubject.name} meets ${cadenceLabel(selectedSubject)} — it reserves a single weekly period, so pick one day.`
                : 'Place this subject on one or more weekdays at this period.'
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((x) => {
                const locked = x === 'FRI' && friReserved
                const on = days[x]
                return (
                  <button
                    key={x}
                    type="button"
                    disabled={locked}
                    title={locked ? 'Friday is reserved on this row (activity period / early dismissal)' : undefined}
                    onClick={() => toggleDay(x)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      locked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                        : on
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {x}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      )}
    </Modal>
  )
}
