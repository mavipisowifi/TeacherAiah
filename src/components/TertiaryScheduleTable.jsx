import React, { useMemo } from 'react'
import { useStore, useTertiary, effectiveTheme, pickTextColor } from '../store.jsx'
import {
  TERTIARY_DAYS,
  TERTIARY_DAY_LABELS,
  TERTIARY_DAY_FULL,
  fmtTertiaryRange,
  termLabel,
  courseLabel,
  programLabel,
  facultyName,
  facultyShort,
} from '../tertiary.js'

/* ------------------------------------------------------------------ */
/* Print-friendly weekly timetable for ONE tertiary block + term.      */
/*                                                                      */
/* Unlike the K–12 grid (fixed period rows, identical every day), a     */
/* college block meets on day patterns (MWF / TTh …) at times that      */
/* differ per day. So there is no shared period ladder to print. This   */
/* renderer derives one: it collects every meeting's start/end across   */
/* all shown days into a sorted set of time BOUNDARIES, turns each gap  */
/* between consecutive boundaries into a table row, and paints each     */
/* meeting as a single rowSpan cell in its day column. The result is a  */
/* clean, colour-filled merged timetable that mirrors the on-screen     */
/* grid and shares the K–12 print theme.                                */
/* ------------------------------------------------------------------ */

// Merge a single day's meetings into non-overlapping spans. The generator never
// overlaps a block with itself, so normally each span holds exactly one meeting;
// manual edits can overlap, and those are merged into one cell (and flagged) so
// the rowSpan table structure stays valid.
function daySpans(dayMeetings) {
  const sorted = [...dayMeetings].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const spans = []
  for (const m of sorted) {
    const last = spans[spans.length - 1]
    if (last && m.startMin < last.endMin) {
      last.endMin = Math.max(last.endMin, m.endMin)
      last.items.push(m)
    } else {
      spans.push({ startMin: m.startMin, endMin: m.endMin, items: [m] })
    }
  }
  return spans
}

export default function TertiaryScheduleTable({ block, term, print = false }) {
  const { state } = useTertiary()
  const { state: k12 } = useStore()
  const theme = effectiveTheme(k12) // theme is shared, stored in the K–12 slice
  const showFaculty = state.settings.showFacultyInCell !== false

  const coursesById = useMemo(() => Object.fromEntries(state.courses.map((c) => [c.id, c])), [state.courses])
  const facultyById = useMemo(() => Object.fromEntries(state.faculty.map((f) => [f.id, f])), [state.faculty])
  const roomsById = useMemo(() => Object.fromEntries(state.rooms.map((r) => [r.id, r])), [state.rooms])

  const meetings = (block && block.schedules && block.schedules[term] && block.schedules[term].meetings) || []
  const adviser = block && block.adviserId ? facultyById[block.adviserId] : null
  const program = state.programs.find((p) => p.id === (block && block.programId))

  // Mon–Fri always; Saturday only when something meets then.
  const days = useMemo(
    () => [...TERTIARY_DAYS.filter((d) => d !== 'SAT'), ...(meetings.some((m) => m.day === 'SAT') ? ['SAT'] : [])],
    [meetings]
  )

  // Per-day merged spans + the unified boundary ladder shared by every column.
  const { spansByDay, boundaries } = useMemo(() => {
    const byDay = {}
    const bset = new Set()
    for (const d of days) {
      const spans = daySpans(meetings.filter((m) => m.day === d))
      byDay[d] = spans
      for (const sp of spans) {
        bset.add(sp.startMin)
        bset.add(sp.endMin)
      }
    }
    return { spansByDay: byDay, boundaries: [...bset].sort((a, b) => a - b) }
  }, [days, meetings])

  const rowCount = Math.max(0, boundaries.length - 1)

  // For each day, precompute what happens at each row: a starting cell (with its
  // rowSpan + span), a cell covered by a rowSpan from above, or a free gap.
  const cellsByDay = useMemo(() => {
    const out = {}
    for (const d of days) {
      const info = new Array(rowCount).fill('free')
      for (const sp of spansByDay[d] || []) {
        const startIdx = boundaries.indexOf(sp.startMin)
        const endIdx = boundaries.indexOf(sp.endMin)
        if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) continue
        info[startIdx] = { span: sp, rowSpan: endIdx - startIdx }
        for (let k = startIdx + 1; k < endIdx; k++) info[k] = 'covered'
      }
      out[d] = info
    }
    return out
  }, [days, spansByDay, boundaries, rowCount])

  const border = `1px solid ${theme.border}`
  const baseFont = print ? '12px' : '11px'
  const nDays = days.length

  // Header meta line: term + adviser (mirrors the K–12 strand/semester + adviser).
  const metaBits = []
  metaBits.push(termLabel(term, true))
  if (adviser) metaBits.push(`Adviser: ${facultyName(adviser)}`)

  const titleText = program && program.code ? `${program.code} — ${block.name}` : (block && block.name) || 'Block section'
  const subTitle = [program ? program.name || program.code : '', block ? block.yearLevel : '']
    .filter(Boolean)
    .join('  •  ')

  return (
    <div style={{ fontSize: baseFont }} className="w-full">
      <table className="w-full border-collapse" style={{ tableLayout: 'fixed', border, background: '#fff' }}>
        <colgroup>
          <col style={{ width: '13%' }} />
          {days.map((d) => (
            <col key={d} style={{ width: `${87 / nDays}%` }} />
          ))}
        </colgroup>
        <thead>
          {/* Title bar — program code + block name */}
          <tr>
            <th
              colSpan={nDays + 1}
              style={{ background: theme.title, color: theme.onDark, border, padding: '7px 8px', fontSize: print ? '17px' : '15px', letterSpacing: '0.03em' }}
              className="text-center font-extrabold uppercase"
            >
              {titleText}
            </th>
          </tr>
          {/* Program full name + year level */}
          {subTitle ? (
            <tr>
              <th
                colSpan={nDays + 1}
                style={{ background: theme.section, color: theme.onDark, border, padding: '5px 8px', fontSize: print ? '13px' : '12px', letterSpacing: '0.04em' }}
                className="text-center font-bold uppercase"
              >
                {subTitle}
              </th>
            </tr>
          ) : null}
          {/* Meta line — term + adviser */}
          <tr>
            <td
              colSpan={nDays + 1}
              style={{ background: theme.band, color: theme.onBand, border, padding: '3px 8px' }}
              className="text-center text-[11px] font-medium"
            >
              {metaBits.join('   •   ')}
            </td>
          </tr>
          {/* Day header */}
          <tr>
            <th
              style={{ background: theme.header, color: theme.onDark, border, padding: '5px 4px' }}
              className="text-center font-bold uppercase"
            >
              Time
            </th>
            {days.map((d) => (
              <th
                key={d}
                style={{ background: theme.header, color: theme.onDark, border, padding: '5px 4px' }}
                className="text-center font-bold uppercase"
              >
                {print ? TERTIARY_DAY_FULL[d] : TERTIARY_DAY_LABELS[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowCount === 0 ? (
            <tr>
              <td
                colSpan={nDays + 1}
                style={{ background: theme.emptyCell, border, padding: '22px 8px', color: '#64748b' }}
                className="text-center text-sm"
              >
                No meetings scheduled for {termLabel(term, true)}.
              </td>
            </tr>
          ) : (
            Array.from({ length: rowCount }).map((_, i) => {
              const t0 = boundaries[i]
              const t1 = boundaries[i + 1]
              return (
                <tr key={i}>
                  <td
                    style={{ background: theme.timeCol, color: theme.onTime, border, padding: '5px 4px' }}
                    className="text-center font-semibold whitespace-nowrap"
                  >
                    {fmtTertiaryRange(t0, t1)}
                  </td>
                  {days.map((d) => {
                    const cell = cellsByDay[d][i]
                    if (cell === 'covered') return null // spanned by a rowSpan above
                    if (cell === 'free') {
                      return (
                        <td
                          key={d}
                          style={{ background: theme.emptyCell, border, padding: '5px 4px' }}
                          className="text-center align-middle"
                        />
                      )
                    }
                    const { span, rowSpan } = cell
                    const multi = span.items.length > 1
                    if (!multi) {
                      const m = span.items[0]
                      const course = coursesById[m.courseId]
                      const bg = (course && course.color) || '#e5e7eb'
                      const fg = pickTextColor(bg)
                      const fac = m.facultyId ? facultyById[m.facultyId] : null
                      const room = m.roomId ? roomsById[m.roomId] : null
                      return (
                        <td
                          key={d}
                          rowSpan={rowSpan}
                          style={{ background: bg, color: fg, border, padding: '5px 4px' }}
                          className="text-center align-middle"
                        >
                          <div className="font-bold uppercase leading-tight break-words">
                            {course ? courseLabel(course) : '—'}
                          </div>
                          {course && course.title && course.code ? (
                            <div className="mt-0.5 text-[9px] font-medium leading-tight opacity-90 break-words">
                              {course.title}
                            </div>
                          ) : null}
                          <div className="mt-0.5 text-[10px] leading-tight opacity-90">
                            {fmtTertiaryRange(m.startMin, m.endMin)}
                          </div>
                          {showFaculty && fac ? (
                            <div className="mt-0.5 text-[10px] font-medium leading-tight opacity-90">
                              {facultyShort(fac)}
                            </div>
                          ) : null}
                          {room ? (
                            <div className="mt-0.5 text-[10px] leading-tight opacity-80">{room.name}</div>
                          ) : null}
                        </td>
                      )
                    }
                    // Overlapping meetings (manual edit): stack them, flag the clash.
                    return (
                      <td
                        key={d}
                        rowSpan={rowSpan}
                        style={{ background: '#fff', border, padding: '3px' }}
                        className="align-middle"
                      >
                        <div className="space-y-1">
                          {span.items.map((m) => {
                            const course = coursesById[m.courseId]
                            const bg = (course && course.color) || '#e5e7eb'
                            const fg = pickTextColor(bg)
                            const fac = m.facultyId ? facultyById[m.facultyId] : null
                            const room = m.roomId ? roomsById[m.roomId] : null
                            return (
                              <div
                                key={m.id}
                                style={{ background: bg, color: fg }}
                                className="rounded px-1 py-0.5 text-center leading-tight"
                              >
                                <div className="text-[10px] font-bold uppercase break-words">
                                  {course ? courseLabel(course) : '—'}
                                </div>
                                <div className="text-[9px] opacity-90">{fmtTertiaryRange(m.startMin, m.endMin)}</div>
                                {showFaculty && fac ? (
                                  <div className="text-[9px] opacity-90">{facultyShort(fac)}</div>
                                ) : null}
                                {room ? <div className="text-[9px] opacity-80">{room.name}</div> : null}
                              </div>
                            )
                          })}
                          <div className="text-center text-[8px] font-bold uppercase tracking-wide text-red-600">
                            Overlap
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
