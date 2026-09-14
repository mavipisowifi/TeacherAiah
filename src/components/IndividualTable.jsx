import React, { useMemo } from 'react'
import {
  useStore,
  effectiveTheme,
  DAYS,
  canonicalTimeRows,
  buildIndividualSchedule,
  isBand,
  BAND_DEFAULT_LABEL,
  pickTextColor,
  formatTeacherName,
  subjectCadence,
  cadenceLabel,
  semesterLabel,
} from '../store.jsx'

export default function IndividualTable({ teacherId, print = false, semester = '' }) {
  const { state } = useStore()
  const theme = effectiveTheme(state)

  const teacher = state.teachers.find((t) => t.id === teacherId)
  const subjectsById = useMemo(() => Object.fromEntries(state.subjects.map((s) => [s.id, s])), [state.subjects])

  // A teacher's grid is scoped to one term so their Term 1/2/3 classes don't pile
  // into one table. Blank pulls every part (legacy all-year data).
  const rows = useMemo(() => canonicalTimeRows(state.schedules, semester), [state.schedules, semester])
  const ind = useMemo(
    () => buildIndividualSchedule(teacherId, state.schedules, rows, semester),
    [teacherId, state.schedules, rows, semester]
  )

  if (!teacher) return null

  const border = `1px solid ${theme.border}`
  const baseFont = print ? '12px' : '11px'

  const advisory = ind.homeroomSections.map((s) => `${s.gradeLevel} ${s.section}`).join(', ')
  const subtitleBits = [teacher.role, teacher.gradeLevel].filter(Boolean)
  const semShort = semesterLabel(semester)
  if (semShort) subtitleBits.push(semShort)
  if (advisory) subtitleBits.push(`Adviser: ${advisory}`)

  return (
    <div style={{ fontSize: baseFont }} className="w-full">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed', border, background: '#fff' }}>
        <colgroup>
          <col style={{ width: '12%' }} />
          {DAYS.map((d) => (
            <col key={d} style={{ width: '17.6%' }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              colSpan={6}
              style={{ background: theme.title, color: theme.onDark, border, padding: '7px 8px', fontSize: print ? '16px' : '14px' }}
              className="text-center font-extrabold uppercase"
            >
              {formatTeacherName(teacher)}
            </th>
          </tr>
          <tr>
            <th
              colSpan={6}
              style={{ background: theme.section, color: theme.onDark, border, padding: '4px 8px' }}
              className="text-center text-xs font-semibold"
            >
              Individual Class Program{subtitleBits.length ? ` · ${subtitleBits.join(' · ')}` : ''}
            </th>
          </tr>
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
          {ind.rows.map((r, ri) => {
            const timeCell = (
              <td
                style={{ background: theme.timeCol, color: theme.onTime, border, padding: '5px 4px' }}
                className="text-center font-semibold whitespace-nowrap"
              >
                {r.time}
              </td>
            )

            // Homeroom band
            if (r.kind === 'homeroom') {
              const label = advisory ? `HOMEROOM — ${advisory}` : 'HOMEROOM TIME'
              return (
                <tr key={ri}>
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

            // Other bands (recess/lunch/dismissal/break)
            if (isBand(r.kind)) {
              const label = r.label || BAND_DEFAULT_LABEL[r.kind] || ''
              return (
                <tr key={ri}>
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

            // Class row
            return (
              <tr key={ri}>
                {timeCell}
                {DAYS.map((day) => {
                  const hits = r.days[day]
                  if (!hits || hits.length === 0) {
                    return <td key={day} style={{ background: theme.emptyCell, border, padding: '5px 4px' }} />
                  }
                  if (hits.length === 1) {
                    const h = hits[0]
                    const subj = subjectsById[h.subjectId]
                    const bg = subj ? subj.color : '#e5e7eb'
                    const fg = pickTextColor(bg)
                    const monthly = subj && subjectCadence(subj) === 'month'
                    return (
                      <td key={day} style={{ background: bg, color: fg, border, padding: '5px 4px' }} className="text-center align-middle">
                        <div className="font-bold uppercase leading-tight">{subj ? subj.name : '—'}</div>
                        {monthly ? (
                          <div className="text-[9px] font-bold uppercase tracking-wide opacity-80">{cadenceLabel(subj)}</div>
                        ) : null}
                        <div className="text-[10px] font-medium opacity-90">{h.gradeLevel} {h.section}</div>
                      </td>
                    )
                  }
                  // Conflict: multiple assignments at the same time
                  return (
                    <td key={day} style={{ background: '#fee2e2', color: '#7f1d1d', border, padding: '4px 3px' }} className="text-center align-middle">
                      {hits.map((h, i) => {
                        const subj = subjectsById[h.subjectId]
                        return (
                          <div key={i} className="text-[10px] font-bold uppercase leading-tight">
                            {subj ? subj.name : '—'} <span className="font-medium">({h.gradeLevel} {h.section})</span>
                          </div>
                        )
                      })}
                      <div className="text-[9px] font-semibold">⚠ conflict</div>
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
