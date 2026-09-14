import React, { useMemo, useState } from 'react'
import { useTertiary, pickTextColor } from '../store.jsx'
import {
  YEAR_LEVELS,
  TERM_IDS,
  termLabel,
  programLabel,
  courseLabel,
  facultyName,
  facultyForCourse,
} from '../tertiary.js'
import { useUI } from '../appContext.jsx'
import {
  Button,
  IconButton,
  Field,
  TextInput,
  Modal,
  EmptyState,
  Checkbox,
  BulkActions,
  useSelection,
} from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

const BLANK = { lastName: '', firstName: '', courseIds: [], maxHours: '' }

export default function TertiaryFacultyPanel() {
  const { state, addFaculty, updateFaculty, deleteFaculty, deleteFaculties } = useTertiary()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const sel = useSelection()

  const coursesById = useMemo(() => Object.fromEntries(state.courses.map((c) => [c.id, c])), [state.courses])

  // Courses each faculty can teach, resolved from their own courseIds.
  const coursesByFaculty = useMemo(() => {
    const map = {}
    for (const f of state.faculty) {
      map[f.id] = (f.courseIds || []).map((id) => coursesById[id]).filter(Boolean)
    }
    return map
  }, [state.faculty, coursesById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.faculty
      .filter((f) => (q ? `${f.lastName} ${f.firstName}`.toLowerCase().includes(q) : true))
      .sort((a, b) => facultyName(a).localeCompare(facultyName(b)))
  }, [state.faculty, search])

  const visibleIds = useMemo(() => filtered.map((f) => f.id), [filtered])

  function openAdd() {
    setEditing(null)
    setForm({ ...BLANK, courseIds: [] })
    setError('')
    setModalOpen(true)
  }

  function openEdit(f) {
    setEditing(f)
    setForm({
      lastName: f.lastName || '',
      firstName: f.firstName || '',
      courseIds: Array.isArray(f.courseIds) ? [...f.courseIds] : [],
      maxHours: f.maxHours == null ? '' : String(f.maxHours),
    })
    setError('')
    setModalOpen(true)
  }

  function toggleCourse(id) {
    setForm((f) => {
      const has = f.courseIds.includes(id)
      return { ...f, courseIds: has ? f.courseIds.filter((x) => x !== id) : [...f.courseIds, id] }
    })
  }

  function save() {
    if (!form.lastName.trim() || !form.firstName.trim()) {
      setError('Please enter both the first and last name.')
      return
    }
    const cleanIds = form.courseIds.filter((id) => coursesById[id])
    const maxHours = form.maxHours === '' ? null : Math.max(0, Number(form.maxHours) || 0)
    const payload = {
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      courseIds: cleanIds,
      maxHours,
    }
    if (editing) {
      updateFaculty(editing.id, payload)
      showToast('Faculty updated')
    } else {
      addFaculty(payload)
      showToast('Faculty added')
    }
    setModalOpen(false)
  }

  function remove(f) {
    const taught = coursesByFaculty[f.id] || []
    const extra = taught.length
      ? ` The ${taught.length} course${taught.length === 1 ? '' : 's'} they teach stay, but lose this instructor.`
      : ''
    if (window.confirm(`Remove ${facultyName(f)}? They are unassigned from all schedules.${extra}`)) {
      deleteFaculty(f.id)
      showToast('Faculty removed')
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
        `Remove ${n} selected instructor${n === 1 ? '' : 's'}? They are unassigned from all schedules; the courses they teach are kept.`
      )
    ) {
      deleteFaculties(ids)
      showToast(`Removed ${n} instructor${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  function clearAll() {
    const ids = state.faculty.map((f) => f.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Remove all ${n} instructor${n === 1 ? '' : 's'}? Everyone is unassigned from all schedules and block advising. Courses are kept. This cannot be undone.`
      )
    ) {
      deleteFaculties(ids)
      showToast('All faculty removed')
      sel.exit()
    }
  }

  return (
    <div>
      <PageHeader
        title="Faculty"
        subtitle="Add your instructors and link each one to the courses they teach — a course can be shared by several, and the scheduler spreads its blocks across them. Create the courses first in the Courses tab."
        action={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            Add faculty
          </Button>
        }
      />

      {state.faculty.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TextInput
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">
              {state.faculty.length} {state.faculty.length === 1 ? 'instructor' : 'instructors'}
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
      )}

      {state.faculty.length === 0 ? (
        <EmptyState
          icon="users"
          title="No faculty yet"
          message="Add your instructors and link each one to the courses they teach. You can pick courses from any program."
          action={
            <Button variant="primary" icon="plus" onClick={openAdd}>
              Add your first instructor
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                {sel.selecting ? (
                  <th className="w-10 px-4 py-2.5">
                    <Checkbox
                      checked={visibleIds.length > 0 && sel.count >= visibleIds.length}
                      onChange={selectAllVisible}
                      aria-label="Select all faculty"
                    />
                  </th>
                ) : null}
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Courses</th>
                <th className="px-4 py-2.5 font-semibold">Max load</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const taught = coursesByFaculty[f.id] || []
                return (
                  <tr
                    key={f.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                      sel.selecting && sel.isSelected(f.id) ? 'bg-green-50' : ''
                    }`}
                  >
                    {sel.selecting ? (
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={sel.isSelected(f.id)}
                          onChange={() => sel.toggle(f.id)}
                          aria-label={`Select ${facultyName(f)}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 font-medium text-slate-800">{facultyName(f)}</td>
                    <td className="px-4 py-2.5">
                      {taught.length ? (
                        <div className="flex max-w-md flex-wrap gap-1">
                          {taught.slice(0, 5).map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold"
                              style={{ background: c.color, color: pickTextColor(c.color) }}
                              title={`${courseLabel(c)} · ${programLabel(state.programs, c.programId)} · ${termLabel(c.term)}`}
                            >
                              {courseLabel(c)}
                            </span>
                          ))}
                          {taught.length > 5 ? (
                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                              +{taught.length - 5}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600">No courses linked</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {f.maxHours == null ? <span className="text-slate-400">—</span> : `≤ ${f.maxHours}h/wk`}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton icon="edit" title="Edit faculty" onClick={() => openEdit(f)} />
                        <IconButton icon="trash" title="Remove faculty" variant="danger" onClick={() => remove(f)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={sel.selecting ? 5 : 4} className="px-4 py-8 text-center text-sm text-slate-400">
                    No faculty match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit faculty' : 'Add faculty'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={save}>
              {editing ? 'Save changes' : 'Add faculty'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Last name" required>
              <TextInput
                autoFocus
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Dela Cruz"
              />
            </Field>
            <Field label="First name" required>
              <TextInput
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jose"
              />
            </Field>
          </div>
          <Field
            label="Max teaching load"
            hint="Optional weekly hour cap the scheduler won't exceed. Leave blank for no limit."
          >
            <TextInput
              type="number"
              min="0"
              step="1"
              value={form.maxHours}
              onChange={(e) => setForm({ ...form, maxHours: e.target.value })}
              placeholder="e.g. 24"
              className="max-w-[10rem]"
            />
          </Field>
          <CoursePicker selectedIds={form.courseIds} onToggle={toggleCourse} editingId={editing ? editing.id : null} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Course picker — link an instructor to the courses they can teach,  */
/* grouped by program. A course may be shared; a subtle note flags    */
/* courses already taught by someone else (no hard block).            */
/* ------------------------------------------------------------------ */

function CoursePicker({ selectedIds, onToggle, editingId }) {
  const { state } = useTertiary()

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
      .map((p) => ({
        program: p,
        courses: state.courses
          .filter((c) => c.programId === p.id)
          .sort(
            (a, b) =>
              yearIdx(a.yearLevel) - yearIdx(b.yearLevel) ||
              termIdx(a.term) - termIdx(b.term) ||
              courseLabel(a).localeCompare(courseLabel(b), undefined, { numeric: true })
          ),
      }))
      .filter((g) => g.courses.length > 0)
  }, [state.programs, state.courses])

  const selected = new Set(selectedIds)

  return (
    <Field
      label={`Courses taught${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
      hint="Pick every course this instructor can handle — from any program. Sharing a course with another instructor is fine; the scheduler splits its blocks between them."
    >
      {state.courses.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
          No courses yet. Add them in the <span className="font-semibold">Courses</span> tab first, then link them here.
        </p>
      ) : (
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
          {groups.map((grp) => (
            <div key={grp.program.id}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {grp.program.code || grp.program.name}
              </div>
              <div className="space-y-1">
                {grp.courses.map((c) => {
                  const others = facultyForCourse(state.faculty, c.id).filter((f) => f.id !== editingId)
                  const on = selected.has(c.id)
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(c.id)}
                        className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-400"
                      />
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                        style={{ background: c.color, color: pickTextColor(c.color) }}
                      >
                        {(c.code || c.title).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {courseLabel(c)}
                        <span className="ml-1 text-xs text-slate-400">
                          {c.yearLevel} · {termLabel(c.term)}
                        </span>
                      </span>
                      {others.length ? (
                        <span
                          className="shrink-0 text-[11px] text-slate-400"
                          title={`Also taught by ${others.map(facultyName).join(', ')}`}
                        >
                          also: {others.length === 1 ? facultyName(others[0]) : `${others.length} others`}
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Field>
  )
}
