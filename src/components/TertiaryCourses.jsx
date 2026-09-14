import React, { useMemo, useState } from 'react'
import { useTertiary, pickTextColor } from '../store.jsx'
import {
  TERTIARY_TERMS,
  TERM_IDS,
  termLabel,
  YEAR_LEVELS,
  TERTIARY_PALETTE,
  courseLabel,
  facultyForCourse,
  facultyName,
} from '../tertiary.js'
import { useUI } from '../appContext.jsx'
import {
  Button,
  IconButton,
  Field,
  TextInput,
  Select,
  Modal,
  EmptyState,
  Checkbox,
  BulkActions,
  useSelection,
} from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

const BLANK = {
  code: '',
  title: '',
  programId: '',
  yearLevel: YEAR_LEVELS[0],
  term: '1',
  lecHours: 3,
  labHours: 0,
  units: 3,
  color: TERTIARY_PALETTE[0],
}

export default function TertiaryCoursesPanel() {
  const { state, addCourse, updateCourse, deleteCourse, deleteCourses } = useTertiary()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const sel = useSelection()

  const hasPrograms = state.programs.length > 0

  // Year levels a course may use, bounded by its program's length (falls back to
  // the full list when no program is chosen yet).
  const yearOptions = useMemo(() => {
    const prog = state.programs.find((p) => p.id === form.programId)
    const n = prog ? Math.min(prog.years || YEAR_LEVELS.length, YEAR_LEVELS.length) : YEAR_LEVELS.length
    return YEAR_LEVELS.slice(0, Math.max(1, n))
  }, [state.programs, form.programId])

  // Group courses by program (in program order), each group sorted by year level,
  // then term, then code — the order they'd appear in a curriculum.
  const groups = useMemo(() => {
    const yearIdx = (y) => {
      const i = YEAR_LEVELS.indexOf(y)
      return i < 0 ? 99 : i
    }
    const termIdx = (t) => {
      const i = TERM_IDS.indexOf(t)
      return i < 0 ? 99 : i
    }
    return state.programs
      .filter((p) => !programFilter || p.id === programFilter)
      .map((p) => ({
        program: p,
        courses: state.courses
          .filter((c) => c.programId === p.id)
          .filter((c) => !termFilter || c.term === termFilter)
          .sort(
            (a, b) =>
              yearIdx(a.yearLevel) - yearIdx(b.yearLevel) ||
              termIdx(a.term) - termIdx(b.term) ||
              courseLabel(a).localeCompare(courseLabel(b), undefined, { numeric: true })
          ),
      }))
      .filter((g) => g.courses.length > 0)
  }, [state.programs, state.courses, programFilter, termFilter])

  const visibleIds = useMemo(() => groups.flatMap((g) => g.courses.map((c) => c.id)), [groups])

  function openAdd() {
    setEditing(null)
    setForm({
      ...BLANK,
      programId: programFilter || (state.programs[0] && state.programs[0].id) || '',
      term: termFilter || '1',
      color: TERTIARY_PALETTE[state.courses.length % TERTIARY_PALETTE.length],
    })
    setError('')
    setModalOpen(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({
      code: c.code || '',
      title: c.title || '',
      programId: c.programId || '',
      yearLevel: c.yearLevel || YEAR_LEVELS[0],
      term: TERM_IDS.includes(c.term) ? c.term : '1',
      lecHours: c.lecHours ?? 3,
      labHours: c.labHours ?? 0,
      units: c.units ?? 3,
      color: c.color || TERTIARY_PALETTE[0],
    })
    setError('')
    setModalOpen(true)
  }

  function save() {
    const code = form.code.trim()
    const title = form.title.trim()
    if (!form.programId) return setError('Please choose a program.')
    if (!code && !title) return setError('Please enter a course code or title.')
    const dup = state.courses.find(
      (c) =>
        c.programId === form.programId &&
        code &&
        (c.code || '').trim().toLowerCase() === code.toLowerCase() &&
        (!editing || c.id !== editing.id)
    )
    if (dup) return setError(`This program already has a course with the code "${code}".`)
    const payload = {
      code,
      title,
      programId: form.programId,
      yearLevel: form.yearLevel,
      term: form.term,
      lecHours: Math.max(0, Number(form.lecHours) || 0),
      labHours: Math.max(0, Number(form.labHours) || 0),
      units: Math.max(0, Number(form.units) || 0),
      color: form.color,
    }
    if (editing) {
      updateCourse(editing.id, payload)
      showToast('Course updated')
    } else {
      addCourse(payload)
      showToast('Course added')
    }
    setModalOpen(false)
  }

  function remove(c) {
    if (window.confirm(`Delete course "${courseLabel(c)}"? It is unlinked from faculty and removed from any schedule.`)) {
      deleteCourse(c.id)
      showToast('Course deleted')
    }
  }

  function selectAllVisible() {
    if (sel.count >= visibleIds.length) sel.clear()
    else sel.set(visibleIds)
  }

  function deleteSelected() {
    const ids = [...sel.selected]
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete ${n} selected course${n === 1 ? '' : 's'}? They are unlinked from faculty and removed from any schedule.`
      )
    ) {
      deleteCourses(ids)
      showToast(`Deleted ${n} course${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  function clearAll() {
    const ids = state.courses.map((c) => c.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete all ${n} course${n === 1 ? '' : 's'} across every program? They are unlinked from faculty and removed from schedules. This cannot be undone.`
      )
    ) {
      deleteCourses(ids)
      showToast('All courses cleared')
      sel.exit()
    }
  }

  const total = state.courses.length

  if (!hasPrograms) {
    return (
      <div>
        <PageHeader title="Courses" subtitle="Course code & title, units, and lecture / laboratory hours. Courses belong to a program." />
        <EmptyState
          icon="book"
          title="Add a program first"
          message="Courses attach to a degree program. Create at least one program in the Programs tab, then come back to add its courses."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Add each course with its program, year level and term, plus units and lecture / laboratory hours. Those hours drive how the scheduler sizes each meeting. Link instructors to courses in the Faculty tab."
        action={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            Add course
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon="book"
          title="No courses yet"
          message="Add the courses in your curriculum. Give each one a program, year level, term, and its lecture / lab hours."
          action={
            <Button variant="primary" icon="plus" onClick={openAdd}>
              Add your first course
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className="max-w-[12rem]">
              <option value="">All programs</option>
              {state.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code || p.name}
                </option>
              ))}
            </Select>
            <Select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="max-w-[11rem]">
              <option value="">All terms</option>
              {TERTIARY_TERMS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500">
                {total} {total === 1 ? 'course' : 'courses'}
              </span>
              <BulkActions
                selecting={sel.selecting}
                count={sel.count}
                total={visibleIds.length}
                onStart={sel.start}
                onCancel={sel.exit}
                onSelectAll={selectAllVisible}
                onDeleteSelected={deleteSelected}
                onClearAll={clearAll}
              />
            </div>
          </div>

          <div className="space-y-5">
            {groups.map((grp) => (
              <div key={grp.program.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
                    {grp.program.code || grp.program.name}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                    {grp.courses.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grp.courses.map((c) => {
                    const teachers = facultyForCourse(state.faculty, c.id)
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center gap-3 rounded-lg border bg-white p-2.5 ${
                          sel.selecting && sel.isSelected(c.id)
                            ? 'border-green-500 ring-2 ring-green-500'
                            : 'border-slate-200'
                        }`}
                      >
                        {sel.selecting ? (
                          <Checkbox
                            checked={sel.isSelected(c.id)}
                            onChange={() => sel.toggle(c.id)}
                            className="shrink-0"
                            aria-label={`Select ${courseLabel(c)}`}
                          />
                        ) : null}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                          style={{ backgroundColor: c.color, color: pickTextColor(c.color) }}
                        >
                          {(c.code || c.title).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight text-slate-400">
                            <span>{c.yearLevel}</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-green-700">{termLabel(c.term)}</span>
                          </div>
                          <div className="truncate text-sm font-semibold leading-tight text-slate-800">
                            {c.code || c.title}
                          </div>
                          <div className="truncate text-xs leading-tight text-slate-500">
                            {c.code && c.title ? (
                              c.title
                            ) : teachers.length === 0 ? (
                              <span className="text-amber-600">No instructor — link in Faculty</span>
                            ) : teachers.length === 1 ? (
                              facultyName(teachers[0])
                            ) : (
                              `${teachers.length} instructors`
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                            title={`${c.units} units · ${c.lecHours}h lecture · ${c.labHours}h lab per week`}
                          >
                            {c.units}u · {c.lecHours}+{c.labHours}h
                          </span>
                          <IconButton icon="edit" title="Edit course" onClick={() => openEdit(c)} />
                          <IconButton icon="trash" title="Delete course" variant="danger" onClick={() => remove(c)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit course' : 'Add course'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={save}>
              {editing ? 'Save changes' : 'Add course'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Course code" hint="e.g. IT 101 — shown everywhere.">
              <TextInput
                autoFocus
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="IT 101"
              />
            </Field>
            <Field label="Program" required>
              <Select
                value={form.programId}
                onChange={(e) => {
                  const programId = e.target.value
                  const prog = state.programs.find((p) => p.id === programId)
                  const years = prog ? Math.min(prog.years || YEAR_LEVELS.length, YEAR_LEVELS.length) : YEAR_LEVELS.length
                  const allowed = YEAR_LEVELS.slice(0, Math.max(1, years))
                  setForm((f) => ({
                    ...f,
                    programId,
                    yearLevel: allowed.includes(f.yearLevel) ? f.yearLevel : allowed[0],
                  }))
                }}
              >
                {state.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code || p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descriptive title" hint="Optional — the full course title.">
            <TextInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Introduction to Computing"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Year level">
              <Select value={form.yearLevel} onChange={(e) => setForm({ ...form, yearLevel: e.target.value })}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Term">
              <Select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>
                {TERTIARY_TERMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Units" hint="Credit units.">
              <TextInput
                type="number"
                min="0"
                step="0.5"
                value={form.units}
                onChange={(e) => setForm({ ...form, units: e.target.value })}
              />
            </Field>
            <Field label="Lecture hrs / wk">
              <TextInput
                type="number"
                min="0"
                step="0.5"
                value={form.lecHours}
                onChange={(e) => setForm({ ...form, lecHours: e.target.value })}
              />
            </Field>
            <Field label="Lab hrs / wk" hint="Placed in a laboratory room.">
              <TextInput
                type="number"
                min="0"
                step="0.5"
                value={form.labHours}
                onChange={(e) => setForm({ ...form, labHours: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Color" hint="Shown on the schedule grid.">
            <div className="flex flex-wrap gap-1.5">
              {TERTIARY_PALETTE.map((col) => {
                const on = form.color === col
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setForm({ ...form, color: col })}
                    className={`h-7 w-7 rounded-md border-2 transition-transform ${
                      on ? 'scale-110 border-slate-800' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: col }}
                    aria-label={`Use color ${col}`}
                  />
                )
              })}
            </div>
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
