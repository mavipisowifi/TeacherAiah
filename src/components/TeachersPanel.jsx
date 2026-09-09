import React, { useMemo, useState } from 'react'
import {
  useStore,
  GRADE_LEVELS,
  gradeOptionGroups,
  ROLES,
  formatTeacherName,
  teacherLoad,
  computeConflicts,
  teachersForSubject,
  pickTextColor,
} from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, IconButton, Field, TextInput, Select, Segmented, Badge, Modal, EmptyState, Icon, Checkbox, BulkActions, useSelection } from './ui.jsx'

const BLANK = { lastName: '', firstName: '', gradeLevel: 'Grade 1', role: 'Non-moderator', subjectIds: [] }

export default function TeachersPanel() {
  const { state, addTeacher, updateTeacher, deleteTeacher, deleteTeachers } = useStore()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const sel = useSelection()

  const conflicts = useMemo(() => computeConflicts(state.schedules), [state.schedules])

  const subjectsById = useMemo(
    () => Object.fromEntries(state.subjects.map((s) => [s.id, s])),
    [state.subjects]
  )

  // Subjects each teacher teaches, resolved from the teacher's own subjectIds
  // list (a teacher can teach subjects of any grade; a subject can be shared).
  const subjectsByTeacher = useMemo(() => {
    const map = {}
    for (const t of state.teachers) {
      map[t.id] = (t.subjectIds || []).map((id) => subjectsById[id]).filter(Boolean)
    }
    return map
  }, [state.teachers, subjectsById])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return state.teachers
      .filter((t) => (gradeFilter ? t.gradeLevel === gradeFilter : true))
      .filter((t) => (roleFilter ? t.role === roleFilter : true))
      .filter((t) =>
        q ? `${t.lastName} ${t.firstName}`.toLowerCase().includes(q) : true
      )
      .sort((a, b) => formatTeacherName(a).localeCompare(formatTeacherName(b)))
  }, [state.teachers, search, gradeFilter, roleFilter])

  // Ids currently shown (honoring search + filters) — the scope of "Select all".
  const visibleIds = useMemo(() => filtered.map((t) => t.id), [filtered])

  function openAdd() {
    setEditing(null)
    setForm({ ...BLANK, subjectIds: [] })
    setError('')
    setModalOpen(true)
  }

  function openEdit(t) {
    setEditing(t)
    setForm({
      lastName: t.lastName,
      firstName: t.firstName,
      gradeLevel: t.gradeLevel,
      role: t.role,
      subjectIds: Array.isArray(t.subjectIds) ? [...t.subjectIds] : [],
    })
    setError('')
    setModalOpen(true)
  }

  function toggleSubject(id) {
    setForm((f) => {
      const has = f.subjectIds.includes(id)
      return { ...f, subjectIds: has ? f.subjectIds.filter((x) => x !== id) : [...f.subjectIds, id] }
    })
  }

  function save() {
    if (!form.lastName.trim() || !form.firstName.trim()) {
      setError('Please enter both the first and last name.')
      return
    }
    // Keep only subjectIds that still exist.
    const cleanIds = form.subjectIds.filter((id) => subjectsById[id])
    const payload = { ...form, subjectIds: cleanIds }
    if (editing) {
      updateTeacher(editing.id, payload)
      showToast('Teacher updated')
    } else {
      addTeacher(payload)
      showToast('Teacher added')
    }
    setModalOpen(false)
  }

  function remove(t) {
    const taught = subjectsByTeacher[t.id] || []
    const extra = taught.length
      ? ` The ${taught.length} subject${taught.length === 1 ? '' : 's'} they teach will stay, but lose this teacher.`
      : ''
    if (window.confirm(`Remove ${formatTeacherName(t)}? They will be unassigned from all schedules.${extra}`)) {
      deleteTeacher(t.id)
      showToast('Teacher removed')
    }
  }

  // "Select all" toggles between every visible teacher and none.
  function selectAllVisible() {
    if (sel.count >= visibleIds.length) sel.clear()
    else sel.set(visibleIds)
  }

  // Delete just the ticked teachers, then leave select mode.
  function deleteSelected() {
    const ids = [...sel.selected]
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Remove ${n} selected teacher${n === 1 ? '' : 's'}? They will be unassigned from all schedules; the subjects they teach are kept.`
      )
    ) {
      deleteTeachers(ids)
      showToast(`Removed ${n} teacher${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  // Remove every teacher (ignores filters by design — the confirm states the
  // full count so it's never a surprise).
  function clearAllTeachers() {
    const ids = state.teachers.map((t) => t.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Remove all ${n} teacher${n === 1 ? '' : 's'}? Every teacher is unassigned from all schedules and advisory roles. Subjects are kept. This cannot be undone.`
      )
    ) {
      deleteTeachers(ids)
      showToast('All teachers removed')
      sel.exit()
    }
  }

  const moderators = state.teachers.filter((t) => t.role === 'Moderator').length

  return (
    <div>
      <PageHeader
        title="Subject Teachers"
        subtitle="Add your teaching staff and link each one to the subjects they teach — a teacher can teach subjects in any grade, and a subject can be shared by several teachers. Their home grade is only for advisory/Homeroom. Create the subjects first in the Subjects tab."
        action={<Button variant="primary" icon="plus" onClick={openAdd}>Add teacher</Button>}
      />

      {state.teachers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TextInput
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="max-w-[10rem]">
            <option value="">All home grades</option>
            {gradeOptionGroups().map((grp) => (
              <optgroup key={grp.label} label={grp.label}>
                {grp.grades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="max-w-[10rem]">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">
              {state.teachers.length} teachers · {moderators} moderators
            </span>
            <BulkActions
              selecting={sel.selecting}
              count={sel.count}
              total={visibleIds.length}
              onStart={sel.start}
              onCancel={sel.exit}
              onSelectAll={selectAllVisible}
              onDeleteSelected={deleteSelected}
              onClearAll={clearAllTeachers}
            />
          </div>
        </div>
      )}

      {state.teachers.length === 0 ? (
        <EmptyState
          icon="users"
          title="No teachers yet"
          message="Add your teachers and link each one to the subjects they teach. You can pick subjects from any grade level."
          action={<Button variant="primary" icon="plus" onClick={openAdd}>Add your first teacher</Button>}
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
                      aria-label="Select all teachers"
                    />
                  </th>
                ) : null}
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Home grade</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Subjects</th>
                <th className="px-4 py-2.5 font-semibold">Weekly load</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const hasConflict = conflicts.teacherIds.has(t.id)
                const load = teacherLoad(t.id, state.schedules)
                const taught = subjectsByTeacher[t.id] || []
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                      sel.selecting && sel.isSelected(t.id) ? 'bg-green-50' : ''
                    }`}
                  >
                    {sel.selecting ? (
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={sel.isSelected(t.id)}
                          onChange={() => sel.toggle(t.id)}
                          aria-label={`Select ${formatTeacherName(t)}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        {formatTeacherName(t)}
                        {hasConflict ? (
                          <Badge tone="amber">
                            <Icon name="warning" className="h-3 w-3" /> conflict
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{t.gradeLevel || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={t.role === 'Moderator' ? 'green' : 'slate'}>{t.role}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {taught.length ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {taught.slice(0, 4).map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold"
                              style={{ background: s.color, color: pickTextColor(s.color) }}
                              title={`${s.name} · ${s.gradeLevel}`}
                            >
                              {s.name}
                            </span>
                          ))}
                          {taught.length > 4 ? (
                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                              +{taught.length - 4}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {load} {load === 1 ? 'period' : 'periods'}/wk
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton icon="edit" title="Edit teacher" onClick={() => openEdit(t)} />
                        <IconButton icon="trash" title="Remove teacher" variant="danger" onClick={() => remove(t)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={sel.selecting ? 7 : 6} className="px-4 py-8 text-center text-sm text-slate-400">
                    No teachers match your filters.
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
        title={editing ? 'Edit teacher' : 'Add teacher'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>{editing ? 'Save changes' : 'Add teacher'}</Button>
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
                placeholder="Maria"
              />
            </Field>
          </div>
          <Field label="Home / advisory grade" hint="Used only for the section this teacher advises (Homeroom). Their teaching load comes from the subjects you link below — which can be any grade level.">
            <Select value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}>
              {gradeOptionGroups().map((grp) => (
                <optgroup key={grp.label} label={grp.label}>
                  {grp.grades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Role">
            <div>
              <Segmented
                value={form.role}
                onChange={(v) => setForm({ ...form, role: v })}
                options={ROLES.map((r) => ({ value: r, label: r }))}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Moderators are section advisers and handle Homeroom Time. Non-moderators are subject teachers only.
              </p>
            </div>
          </Field>
          <SubjectPicker
            selectedIds={form.subjectIds}
            onToggle={toggleSubject}
            editingId={editing ? editing.id : null}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Subject picker — link a teacher to the subjects they teach, across */
/* any grade level. Multiple teachers may share a subject; a subtle   */
/* note flags subjects already taught by someone else (no hard block).*/
/* ------------------------------------------------------------------ */

function SubjectPicker({ selectedIds, onToggle, editingId }) {
  const { state } = useStore()

  const groups = useMemo(() => {
    const byGrade = {}
    for (const s of state.subjects) {
      const g = s.gradeLevel || 'Unspecified'
      if (!byGrade[g]) byGrade[g] = []
      byGrade[g].push(s)
    }
    const order = [...GRADE_LEVELS, 'Unspecified']
    return order
      .filter((g) => byGrade[g])
      .map((g) => ({
        grade: g,
        subjects: byGrade[g].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      }))
  }, [state.subjects])

  const selected = new Set(selectedIds)

  return (
    <Field
      label={`Subjects taught${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
      hint="Pick every subject this teacher handles — from any grade. Sharing a subject with another teacher is fine; the scheduler splits its sections between them."
    >
      {state.subjects.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
          No subjects yet. Add them in the <span className="font-semibold">Subjects</span> tab first, then link them here.
        </p>
      ) : (
        <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
          {groups.map((grp) => (
            <div key={grp.grade}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{grp.grade}</div>
              <div className="space-y-1">
                {grp.subjects.map((s) => {
                  const others = teachersForSubject(state.teachers, s.id).filter((t) => t.id !== editingId)
                  const on = selected.has(s.id)
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(s.id)}
                        className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-400"
                      />
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                        style={{ background: s.color, color: pickTextColor(s.color) }}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {s.name}
                        {s.code ? <span className="ml-1 text-xs text-slate-400">{s.code}</span> : null}
                      </span>
                      {others.length ? (
                        <span
                          className="shrink-0 text-[11px] text-slate-400"
                          title={`Also taught by ${others.map(formatTeacherName).join(', ')}`}
                        >
                          also: {others.length === 1 ? formatTeacherName(others[0]) : `${others.length} others`}
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

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
