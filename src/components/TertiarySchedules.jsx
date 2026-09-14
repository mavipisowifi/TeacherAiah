import React, { useMemo, useState } from 'react'
import { useTertiary, pickTextColor } from '../store.jsx'
import {
  TERTIARY_TERMS,
  TERM_IDS,
  termLabel,
  TERTIARY_DAYS,
  TERTIARY_DAY_LABELS,
  TERTIARY_DAY_FULL,
  ROOM_TYPES,
  fmtTertiaryTime,
  fmtTertiaryRange,
  toHM,
  parseHM,
  courseLabel,
  programLabel,
  facultyName,
  facultyShort,
  facultyForCourse,
  coursesForBlock,
  facultyLoadHours,
  computeTertiaryConflicts,
} from '../tertiary.js'
import { useUI } from '../appContext.jsx'
import { Button, IconButton, Field, Select, Modal, EmptyState, Badge, Card, Checkbox } from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

// Pixels per minute for the weekly grid — sets the row height so a 1-hour class
// is a comfortable, readable block. The whole day window scales from this.
const PX_PER_MIN = 0.8

// Greedy interval-partitioning: lay a day's meetings into as few side-by-side
// lanes as possible so overlaps (only possible via manual edits — the generator
// never overlaps a block with itself) render next to each other instead of on
// top of one another. Returns each meeting with its lane index + the lane count.
function assignLanes(dayMeetings) {
  const sorted = [...dayMeetings].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const laneEnds = []
  const withLane = sorted.map((m) => {
    let lane = laneEnds.findIndex((end) => end <= m.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(m.endMin)
    } else {
      laneEnds[lane] = m.endMin
    }
    return { m, lane }
  })
  return { withLane, laneCount: Math.max(1, laneEnds.length) }
}

/* ------------------------------------------------------------------ */
/* Weekly timetable grid for ONE block + term. Time runs down the left */
/* gutter; each weekday is a column of absolutely-placed meeting cards. */
/* Click a meeting to edit it, or an empty part of a column to add one. */
/* ------------------------------------------------------------------ */

function BlockGrid({ meetings, settings, coursesById, facultyById, roomsById, onEdit, onAddAt }) {
  const dayStart = settings.dayStartMin
  const dayEnd = settings.dayEndMin
  const total = Math.max(60, dayEnd - dayStart)
  const height = total * PX_PER_MIN

  // Mon–Fri always; Saturday only when something meets then (keeps it compact,
  // but the column appears the moment a Saturday meeting is added).
  const days = useMemo(
    () => [...TERTIARY_DAYS.filter((d) => d !== 'SAT'), ...(meetings.some((m) => m.day === 'SAT') ? ['SAT'] : [])],
    [meetings]
  )

  const hours = useMemo(() => {
    const first = Math.ceil(dayStart / 60)
    const last = Math.floor(dayEnd / 60)
    const out = []
    for (let h = first; h <= last; h++) out.push(h)
    return out
  }, [dayStart, dayEnd])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Day header row */}
        <div className="flex border-b border-slate-200">
          <div className="w-16 shrink-0" />
          {days.map((d) => (
            <div
              key={d}
              className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-600"
              title={TERTIARY_DAY_FULL[d]}
            >
              {TERTIARY_DAY_LABELS[d]}
            </div>
          ))}
        </div>

        {/* Scaled body */}
        <div className="flex">
          {/* Time gutter */}
          <div className="relative w-16 shrink-0" style={{ height }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-slate-400"
                style={{ top: (h * 60 - dayStart) * PX_PER_MIN }}
              >
                {fmtTertiaryTime(h * 60)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dm = meetings.filter((m) => m.day === day)
            const { withLane, laneCount } = assignLanes(dm)
            return (
              <div
                key={day}
                className="relative flex-1 cursor-copy border-l border-slate-200"
                style={{ height }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const step = Math.max(5, settings.slotMin || 30)
                  let min = dayStart + Math.round(y / PX_PER_MIN / step) * step
                  min = Math.max(dayStart, Math.min(dayEnd - step, min))
                  onAddAt(day, min)
                }}
                title="Click to add a meeting here"
              >
                {/* Hour gridlines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                    style={{ top: (h * 60 - dayStart) * PX_PER_MIN }}
                  />
                ))}

                {/* Meetings */}
                {withLane.map(({ m, lane }) => {
                  const c = coursesById[m.courseId]
                  const color = (c && c.color) || '#64748b'
                  const top = (m.startMin - dayStart) * PX_PER_MIN
                  const h = Math.max(20, (m.endMin - m.startMin) * PX_PER_MIN)
                  const w = 100 / laneCount
                  const fac = facultyById[m.facultyId]
                  const room = roomsById[m.roomId]
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(m)
                      }}
                      className="absolute overflow-hidden rounded-md border border-black/10 px-1.5 py-1 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
                      style={{
                        top,
                        height: h,
                        left: `calc(${lane * w}% + 2px)`,
                        width: `calc(${w}% - 4px)`,
                        backgroundColor: color,
                        color: pickTextColor(color),
                      }}
                      title={`${c ? courseLabel(c) : 'Course'} · ${fmtTertiaryRange(m.startMin, m.endMin)}${
                        fac ? ` · ${facultyName(fac)}` : ''
                      }${room ? ` · ${room.name}` : ''}`}
                    >
                      <div className="truncate text-[10px] font-bold leading-tight">{c ? courseLabel(c) : '—'}</div>
                      {h >= 34 ? (
                        <div className="truncate text-[9px] leading-tight opacity-90">
                          {fmtTertiaryRange(m.startMin, m.endMin)}
                        </div>
                      ) : null}
                      {h >= 50 && settings.showFacultyInCell && fac ? (
                        <div className="truncate text-[9px] leading-tight opacity-90">{facultyShort(fac)}</div>
                      ) : null}
                      {h >= 66 && room ? (
                        <div className="truncate text-[9px] leading-tight opacity-90">{room.name}</div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */

export default function TertiarySchedulesPanel({ onNavigate }) {
  const {
    state,
    generateBlock,
    generateTerm,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    clearBlockTerm,
    setTertiarySetting,
  } = useTertiary()
  const { showToast, openPrint } = useUI()

  const settings = state.settings
  const term = TERM_IDS.includes(settings.activeTerm) ? settings.activeTerm : '1'
  const setTerm = (t) => setTertiarySetting('activeTerm', t)

  const [selectedId, setSelectedId] = useState('')
  const [modal, setModal] = useState(null) // { editing, form } | null
  const [error, setError] = useState('')

  const coursesById = useMemo(() => Object.fromEntries(state.courses.map((c) => [c.id, c])), [state.courses])
  const facultyById = useMemo(() => Object.fromEntries(state.faculty.map((f) => [f.id, f])), [state.faculty])
  const roomsById = useMemo(() => Object.fromEntries(state.rooms.map((r) => [r.id, r])), [state.rooms])
  const blocksById = useMemo(() => Object.fromEntries(state.blocks.map((b) => [b.id, b])), [state.blocks])

  // Blocks grouped by program for the picker (each <optgroup> is a program).
  const groupedBlocks = useMemo(() => {
    return state.programs
      .map((p) => ({ program: p, blocks: state.blocks.filter((b) => b.programId === p.id) }))
      .filter((g) => g.blocks.length > 0)
  }, [state.programs, state.blocks])

  const selected = state.blocks.find((b) => b.id === selectedId) || state.blocks[0] || null
  const meetings = selected ? (selected.schedules[term] && selected.schedules[term].meetings) || [] : []
  const blockCourses = selected ? coursesForBlock(state.courses, selected.programId, selected.yearLevel, term) : []

  // Term-wide summaries (across every block), independent of which block is shown.
  const loads = useMemo(() => facultyLoadHours(state.blocks, term), [state.blocks, term])
  const conflicts = useMemo(() => computeTertiaryConflicts(state.blocks, term).conflicts, [state.blocks, term])

  const loadRows = useMemo(
    () =>
      state.faculty
        .map((f) => ({ f, hours: loads[f.id] || 0 }))
        .sort((a, b) => b.hours - a.hours || facultyName(a.f).localeCompare(facultyName(b.f))),
    [state.faculty, loads]
  )

  /* ---- generation ---- */

  function genBlock() {
    if (!selected) return
    if (
      meetings.length &&
      !window.confirm(
        `Regenerate ${selected.name}'s ${termLabel(term)} timetable? Any manual edits to this block for this term are replaced.`
      )
    )
      return
    const res = generateBlock(selected.id, term)
    if (res.requested === 0) showToast('No courses to schedule for this block + term', 'info')
    else if (res.unplaced > 0)
      showToast(`Placed ${res.placed} of ${res.requested} sessions — ${res.unplaced} couldn't fit`, 'info')
    else showToast(`Scheduled ${res.placed} session${res.placed === 1 ? '' : 's'}`)
  }

  function genAll() {
    if (!state.blocks.length) return
    const any = state.blocks.some((b) => ((b.schedules[term] && b.schedules[term].meetings) || []).length)
    if (
      any &&
      !window.confirm(
        `Regenerate ALL blocks for ${termLabel(term)}? Every block's manual edits for this term are replaced.`
      )
    )
      return
    const sum = generateTerm(term)
    const n = Object.keys(sum.results).length
    if (sum.requested === 0) showToast('No courses to schedule this term', 'info')
    else if (sum.unplaced > 0)
      showToast(`Placed ${sum.placed} of ${sum.requested} sessions — ${sum.unplaced} couldn't fit`, 'info')
    else showToast(`Scheduled ${sum.placed} session${sum.placed === 1 ? '' : 's'} across ${n} block${n === 1 ? '' : 's'}`)
  }

  function clearBlk() {
    if (!selected || !meetings.length) return
    if (window.confirm(`Clear ${selected.name}'s ${termLabel(term)} timetable? This cannot be undone.`)) {
      clearBlockTerm(selected.id, term)
      showToast('Timetable cleared')
    }
  }

  /* ---- manual meeting editing ---- */

  function openAdd(day, startMin) {
    if (!selected) return
    const first = blockCourses[0]
    const s = startMin != null ? startMin : settings.dayStartMin
    setError('')
    setModal({
      editing: null,
      form: {
        courseId: first ? first.id : '',
        facultyId: first ? (facultyForCourse(state.faculty, first.id)[0] || {}).id || '' : '',
        roomId: '',
        day: day || 'MON',
        start: toHM(s),
        end: toHM(s + 60),
      },
    })
  }

  function openEdit(m) {
    setError('')
    setModal({
      editing: m,
      form: {
        courseId: m.courseId,
        facultyId: m.facultyId,
        roomId: m.roomId,
        day: m.day,
        start: toHM(m.startMin),
        end: toHM(m.endMin),
      },
    })
  }

  function setForm(patch) {
    setModal((mo) => (mo ? { ...mo, form: { ...mo.form, ...patch } } : mo))
  }

  function onCourseChange(courseId) {
    const elig = facultyForCourse(state.faculty, courseId)
    setModal((mo) => {
      if (!mo) return mo
      const keep = elig.some((x) => x.id === mo.form.facultyId)
      return { ...mo, form: { ...mo.form, courseId, facultyId: keep ? mo.form.facultyId : (elig[0] || {}).id || '' } }
    })
  }

  function saveMeeting() {
    if (!modal || !selected) return
    const f = modal.form
    const s = parseHM(f.start)
    const e = parseHM(f.end)
    if (!f.courseId) return setError('Please choose a course.')
    if (s == null || e == null) return setError('Please enter valid start and end times.')
    if (e <= s) return setError('The end time must be after the start time.')
    const payload = { courseId: f.courseId, facultyId: f.facultyId || '', roomId: f.roomId || '', day: f.day, startMin: s, endMin: e }
    if (modal.editing) {
      updateMeeting(selected.id, term, modal.editing.id, payload)
      showToast('Meeting updated')
    } else {
      addMeeting(selected.id, term, payload)
      showToast('Meeting added')
    }
    setModal(null)
  }

  function removeMeeting() {
    if (!modal || !modal.editing || !selected) return
    deleteMeeting(selected.id, term, modal.editing.id)
    showToast('Meeting removed')
    setModal(null)
  }

  /* ---- empty states ---- */

  const go = (key) => (typeof onNavigate === 'function' ? () => onNavigate(key) : undefined)

  if (state.blocks.length === 0) {
    return (
      <div>
        <PageHeader
          title="Schedules"
          subtitle="Generate and fine-tune each block's weekly timetable, then review faculty loads and clashes."
        />
        <EmptyState
          icon="clock"
          title="No block sections yet"
          message="Schedules are built per block section (e.g. BSIT 1-A). Create your programs, courses, faculty and at least one block, then generate timetables here."
          action={
            typeof onNavigate === 'function' ? (
              <Button variant="primary" icon="grid" onClick={go('blocks')}>
                Go to Block Sections
              </Button>
            ) : null
          }
        />
      </div>
    )
  }

  const termOptions = TERTIARY_TERMS.map((t) => ({ value: t.id, label: t.short }))

  return (
    <div>
      <PageHeader
        title="Schedules"
        subtitle="Pick a term and a block, generate its weekly timetable, then click any meeting to fine-tune it. Faculty loads and clashes update live on the right."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon="print"
              onClick={() => openPrint({ type: 'tertiary-all', term })}
              title="Print every block's timetable for this term"
            >
              Print all
            </Button>
            <Button variant="primary" icon="grid" onClick={genAll}>
              Generate all · {termLabel(term)}
            </Button>
          </div>
        }
      />

      {/* Term switch */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5">
          {termOptions.map((t) => {
            const active = term === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTerm(t.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? 'bg-green-700 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <Checkbox
            checked={!!settings.showFacultyInCell}
            onChange={(e) => setTertiarySetting('showFacultyInCell', e.target.checked)}
          />
          Show faculty in cells
        </label>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Main: block picker + grid */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select
              value={selected ? selected.id : ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="max-w-[16rem]"
            >
              {groupedBlocks.map((g) => (
                <optgroup key={g.program.id} label={g.program.code || g.program.name}>
                  {g.blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.yearLevel}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" icon="plus" onClick={() => openAdd('MON', settings.dayStartMin)} disabled={!selected}>
                Add meeting
              </Button>
              <Button size="sm" variant="primary" icon="grid" onClick={genBlock} disabled={!selected}>
                Generate
              </Button>
              <IconButton icon="trash" title="Clear this block's timetable" variant="danger" onClick={clearBlk} />
              <IconButton
                icon="print"
                title="Print / Save PDF"
                onClick={() => selected && openPrint({ type: 'tertiary-block', blockId: selected.id, term })}
              />
            </div>
          </div>

          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-white">
              {/* Block meta strip */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                <span className="text-sm font-bold text-slate-800">{selected.name}</span>
                <Badge tone="slate">{programLabel(state.programs, selected.programId)}</Badge>
                <Badge tone="slate">{selected.yearLevel}</Badge>
                <span className="text-xs text-slate-400">
                  {blockCourses.length} course{blockCourses.length === 1 ? '' : 's'} · {meetings.length} meeting
                  {meetings.length === 1 ? '' : 's'}
                </span>
                {selected.adviserId && facultyById[selected.adviserId] ? (
                  <span className="text-xs text-slate-400">Adviser: {facultyName(facultyById[selected.adviserId])}</span>
                ) : null}
              </div>

              {meetings.length === 0 && blockCourses.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  No courses fall in {programLabel(state.programs, selected.programId)} · {selected.yearLevel} for{' '}
                  {termLabel(term, true)}.{' '}
                  {typeof onNavigate === 'function' ? (
                    <button className="font-semibold text-green-700 hover:underline" onClick={go('courses')}>
                      Add courses
                    </button>
                  ) : (
                    <span>Add courses in the Courses tab</span>
                  )}{' '}
                  with this year level and term first.
                </div>
              ) : meetings.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  No meetings yet for {termLabel(term, true)}.{' '}
                  <button className="font-semibold text-green-700 hover:underline" onClick={genBlock}>
                    Generate a timetable
                  </button>{' '}
                  from this block&apos;s {blockCourses.length} course{blockCourses.length === 1 ? '' : 's'}, or add
                  meetings by hand.
                </div>
              ) : (
                <div className="p-2">
                  <BlockGrid
                    meetings={meetings}
                    settings={settings}
                    coursesById={coursesById}
                    facultyById={facultyById}
                    roomsById={roomsById}
                    onEdit={openEdit}
                    onAddAt={openAdd}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right rail: faculty loads + conflicts */}
        <div className="w-full shrink-0 space-y-4 lg:w-80">
          <Card title={`Faculty load · ${termLabel(term)}`}>
            {loadRows.length === 0 ? (
              <p className="text-sm text-slate-400">No faculty added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {loadRows.map(({ f, hours }) => {
                  const over = f.maxHours != null && hours > f.maxHours
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{facultyName(f)}</span>
                      <span className={`shrink-0 font-semibold ${over ? 'text-red-600' : 'text-slate-500'}`}>
                        {hours.toFixed(hours % 1 ? 1 : 0)}h
                        {f.maxHours != null ? <span className="font-normal text-slate-400"> / {f.maxHours}h</span> : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card
            title={`Conflicts · ${termLabel(term)}`}
            actions={
              conflicts.length ? (
                <Badge tone="red">{conflicts.length}</Badge>
              ) : (
                <Badge tone="green">None</Badge>
              )
            }
          >
            {conflicts.length === 0 ? (
              <p className="text-sm text-slate-500">No clashes — every faculty member, room and block is free at each of its meeting times.</p>
            ) : (
              <ul className="space-y-2">
                {conflicts.map((c, i) => {
                  const kindLabel =
                    c.kind === 'faculty' ? 'Faculty double-booked' : c.kind === 'room' ? 'Room double-booked' : 'Block overlap'
                  const from = Math.max(c.a.startMin, c.b.startMin)
                  const to = Math.min(c.a.endMin, c.b.endMin)
                  const ca = coursesById[c.a.courseId]
                  const cb = coursesById[c.b.courseId]
                  const ba = blocksById[c.a.blockId]
                  const bb = blocksById[c.b.blockId]
                  const who =
                    c.kind === 'faculty'
                      ? facultyName(facultyById[c.a.facultyId])
                      : c.kind === 'room'
                      ? (roomsById[c.a.roomId] || {}).name || 'Room'
                      : (ba || {}).name || 'Block'
                  return (
                    <li key={i} className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="red">{kindLabel}</Badge>
                        <span className="font-semibold text-slate-700">{who}</span>
                      </div>
                      <div className="mt-1 text-slate-600">
                        {TERTIARY_DAY_FULL[c.a.day]} · {fmtTertiaryRange(from, to)}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {ca ? courseLabel(ca) : '—'} ({(ba || {}).name || '?'}) ↔ {cb ? courseLabel(cb) : '—'} (
                        {(bb || {}).name || '?'})
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Add / edit meeting */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal && modal.editing ? 'Edit meeting' : 'Add meeting'}
        footer={
          <>
            {modal && modal.editing ? (
              <Button variant="danger" icon="trash" onClick={removeMeeting} className="mr-auto">
                Remove
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={saveMeeting}>
              {modal && modal.editing ? 'Save changes' : 'Add meeting'}
            </Button>
          </>
        }
      >
        {modal ? (
          <div className="space-y-4">
            <Field label="Course" required>
              {blockCourses.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-400">
                  This block has no courses for {termLabel(term, true)}. Add courses with this program, year level and
                  term first.
                </p>
              ) : (
                <Select value={modal.form.courseId} onChange={(e) => onCourseChange(e.target.value)}>
                  <option value="">Choose a course…</option>
                  {blockCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {courseLabel(c)}
                      {c.code && c.title ? ` — ${c.title}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Instructor" hint="Only faculty who can teach the chosen course are listed.">
              <Select value={modal.form.facultyId} onChange={(e) => setForm({ facultyId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {facultyForCourse(state.faculty, modal.form.courseId).map((f) => (
                  <option key={f.id} value={f.id}>
                    {facultyName(f)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Room">
              <Select value={modal.form.roomId} onChange={(e) => setForm({ roomId: e.target.value })}>
                <option value="">— No room —</option>
                {ROOM_TYPES.map((type) => {
                  const rs = state.rooms.filter((r) => r.type === type)
                  if (!rs.length) return null
                  return (
                    <optgroup key={type} label={type}>
                      {rs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </Select>
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Day">
                <Select value={modal.form.day} onChange={(e) => setForm({ day: e.target.value })}>
                  {TERTIARY_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {TERTIARY_DAY_FULL[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Start">
                <input
                  type="time"
                  value={modal.form.start}
                  onChange={(e) => setForm({ start: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  value={modal.form.end}
                  onChange={(e) => setForm({ end: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                />
              </Field>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
