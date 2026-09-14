import React, { useMemo } from 'react'
import { useStore, effectiveTheme, DAYS, isBand, BAND_DEFAULT_LABEL, pickTextColor, formatTeacherName, formatTeacherShort, subjectCadence, cadenceLabel, isShsGrade, programForSemester, strandLabel, strandFullName, semesterLabel, bellForGrade, fridayOverrides } from '../store.jsx'

export default function ScheduleTable({ schedule, print = false, semester = '', editable = false, onEditCell, conflictCells = null }) {
  const { state } = useStore()
  const theme = effectiveTheme(state)
  const showTeacher = state.settings.showTeacherInCell
  // Manual editing is opt-in (the builder passes it; print never does). A class
  // cell becomes clickable to add/change/remove its subject; band rows and the
  // reserved Friday activity/early-dismissal cells stay locked.
  const canEdit = editable && !print && typeof onEditCell === 'function'

  const subjectsById = useMemo(() => {
    const m = {}
    for (const s of state.subjects) m[s.id] = s
    return m
  }, [state.subjects])

  const teachersById = useMemo(() => {
    const m = {}
    for (const t of state.teachers) m[t.id] = t
    return m
  }, [state.teachers])

  const adviser = schedule.moderatorId ? teachersById[schedule.moderatorId] : null

  // Every K–12 section carries a separate program per term (Term 1/2/3).
  // programForSemester resolves the active term's program for ALL grades — K–10
  // simply repeats the same subjects each term. isShs stays only for strand meta.
  const isShs = isShsGrade(schedule.gradeLevel)
  const prog = programForSemester(schedule, semester)
  const timeSlots = prog.timeSlots || []
  const grid = prog.grid || {}

  // Optional per-grade FRIDAY tweaks: a no-class activity block and/or an early
  // dismissal. Resolved against this program's own time rows, so the right cells
  // are marked whatever the bell. null (the common case) means Friday renders
  // exactly like the other days.
  const fri = useMemo(
    () => fridayOverrides(bellForGrade(state, schedule.gradeLevel), timeSlots),
    [state, schedule.gradeLevel, timeSlots]
  )
  const firstDismissedId = useMemo(
    () => (fri ? (timeSlots.find((s) => s.kind === 'class' && fri.dismissed[s.id]) || {}).id : null),
    [fri, timeSlots]
  )

  const border = `1px solid ${theme.border}`
  const metaBits = []
  // Strand line stays Senior High only; the term line shows for every grade.
  if (isShs) {
    metaBits.push(schedule.strandId ? strandFullName(schedule.strandId) : 'Core (all strands)')
  }
  const termShort = semesterLabel(prog.semester || semester)
  if (termShort) metaBits.push(termShort)
  if (adviser) metaBits.push(`Adviser: ${formatTeacherName(adviser)}`)

  const baseFont = print ? '12px' : '11px'

  return (
    <div style={{ fontSize: baseFont }} className="w-full">
      <table
        className="w-full border-collapse"
        style={{ tableLayout: 'fixed', border, background: '#fff' }}
      >
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '17.6%' }} />
          <col style={{ width: '17.6%' }} />
          <col style={{ width: '17.6%' }} />
          <col style={{ width: '17.6%' }} />
          <col style={{ width: '17.6%' }} />
        </colgroup>
        <thead>
          {/* Grade title bar */}
          <tr>
            <th
              colSpan={6}
              style={{ background: theme.title, color: theme.onDark, border, padding: '7px 8px', fontSize: print ? '17px' : '15px', letterSpacing: '0.03em' }}
              className="text-center font-extrabold uppercase"
            >
              {schedule.gradeLevel || 'Grade level'}
            </th>
          </tr>
          {/* Section bar */}
          <tr>
            <th
              colSpan={6}
              style={{ background: theme.section, color: theme.onDark, border, padding: '5px 8px', fontSize: print ? '14px' : '13px', letterSpacing: '0.05em' }}
              className="text-center font-bold uppercase"
            >
              {schedule.section || 'Section'}
            </th>
          </tr>
          {/* Meta line (adviser + dates) */}
          {metaBits.length > 0 && (
            <tr>
              <td
                colSpan={6}
                style={{ background: theme.band, color: theme.onBand, border, padding: '3px 8px' }}
                className="text-center text-[11px] font-medium"
              >
                {metaBits.join('   •   ')}
              </td>
            </tr>
          )}
          {/* Day header */}
          <tr>
            {['TIME', ...DAYS].map((h) => (
              <th
                key={h}
                style={{ background: theme.header, color: theme.onDark, border, padding: '5px 4px' }}
                className="text-center font-bold uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot) => {
            const timeCell = (
              <td
                key="time"
                style={{ background: theme.timeCol, color: theme.onTime, border, padding: '5px 4px' }}
                className="text-center font-semibold whitespace-nowrap"
              >
                {slot.time}
              </td>
            )

            if (isBand(slot.kind)) {
              const label = slot.label || BAND_DEFAULT_LABEL[slot.kind] || ''
              return (
                <tr key={slot.id}>
                  {timeCell}
                  {DAYS.map((day) => (
                    <td
                      key={day}
                      style={{ background: theme.band, color: theme.onBand, border, padding: '5px 8px' }}
                      className="text-center font-bold uppercase tracking-wide"
                    >
                      {label}
                    </td>
                  ))}
                </tr>
              )
            }

            const row = grid[slot.id] || {}
            return (
              <tr key={slot.id}>
                {timeCell}
                {DAYS.map((day) => {
                  const cell = row[day]
                  // Friday-only activity block / early dismissal. Only when the
                  // grade opted in and no class occupies the cell (a stale class
                  // from before a settings change is never hidden).
                  if (day === 'FRI' && fri && (!cell || !cell.subjectId)) {
                    if (fri.activity[slot.id]) {
                      return (
                        <td
                          key={day}
                          style={{ background: theme.band, color: theme.onBand, border, padding: '5px 4px' }}
                          className="text-center align-middle font-bold uppercase tracking-wide break-words"
                        >
                          {fri.activityLabel}
                        </td>
                      )
                    }
                    if (fri.dismissed[slot.id]) {
                      return (
                        <td
                          key={day}
                          style={{ background: theme.emptyCell, border, padding: '5px 4px' }}
                          className="text-center align-middle"
                        >
                          {slot.id === firstDismissedId ? (
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Early dismissal
                            </div>
                          ) : null}
                        </td>
                      )
                    }
                  }
                  if (!cell || !cell.subjectId) {
                    return (
                      <td
                        key={day}
                        onClick={canEdit ? () => onEditCell(slot.id, day) : undefined}
                        title={canEdit ? 'Click to add a subject' : undefined}
                        style={{ background: theme.emptyCell, border, padding: '5px 4px' }}
                        className={canEdit ? 'group cursor-pointer text-center align-middle transition-colors hover:bg-green-50' : ''}
                      >
                        {canEdit ? (
                          <span className="select-none text-base font-bold leading-none text-green-600 opacity-0 transition-opacity group-hover:opacity-100">
                            +
                          </span>
                        ) : null}
                      </td>
                    )
                  }
                  const subj = subjectsById[cell.subjectId]
                  const bg = subj ? subj.color : '#e5e7eb'
                  const fg = pickTextColor(bg)
                  const teacher = cell.teacherId ? teachersById[cell.teacherId] : null
                  const monthly = subj && subjectCadence(subj) === 'month'
                  // Teacher clash: this exact cell (section + period + day) is one
                  // side of a double-booking. Flagged with a red inset ring + a
                  // solid pill so it reads on any subject color. Opt-in via the
                  // conflictCells set (the live editing grid passes it; print does
                  // not, so distributed copies stay clean).
                  const conflicted = !!(conflictCells && conflictCells.has(`${schedule.id}||${slot.id}||${day}`))
                  return (
                    <td
                      key={day}
                      onClick={canEdit ? () => onEditCell(slot.id, day) : undefined}
                      title={
                        conflicted
                          ? 'Teacher conflict — this teacher is booked in another section at this time'
                          : canEdit
                          ? 'Click to change or remove'
                          : undefined
                      }
                      style={{
                        background: bg,
                        color: fg,
                        border,
                        padding: '5px 4px',
                        ...(conflicted ? { boxShadow: 'inset 0 0 0 3px #dc2626' } : null),
                      }}
                      className={`text-center align-middle ${
                        canEdit ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-green-600' : ''
                      }`}
                    >
                      {conflicted ? (
                        <div className="mb-0.5 inline-flex items-center rounded bg-red-600 px-1 text-[8px] font-bold uppercase leading-tight tracking-wide text-white">
                          ⚠ Conflict
                        </div>
                      ) : null}
                      <div className="font-bold uppercase leading-tight break-words">{subj ? subj.name : '—'}</div>

                      {monthly ? (
                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide opacity-80">
                          {cadenceLabel(subj)}
                        </div>
                      ) : null}
                      {showTeacher && teacher ? (
                        <div className="mt-0.5 text-[10px] font-medium opacity-90">{formatTeacherShort(teacher)}</div>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
