import React, { useMemo, useState } from 'react'
import {
  useStore,
  GRADE_LEVELS,
  gradeOptionGroups,
  SUBJECT_PALETTE,
  clampFreq,
  clampMonthly,
  cadenceLabel,
  pickTextColor,
  teachersForSubject,
  formatTeacherName,
  isShsGrade,
  isCrossStrand,
  strandOptionGroups,
  strandLabel,
  semesterLabel,
  SEMESTERS,
} from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, IconButton, Field, TextInput, Select, Modal, EmptyState, Checkbox, BulkActions, useSelection } from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

const BLANK = {
  name: '',
  code: '',
  gradeLevel: 'Grade 1',
  cadence: 'week',
  periodsPerWeek: 4,
  sessionsPerMonth: 2,
  color: SUBJECT_PALETTE[0],
  strandId: '',
  semester: '',
}

export default function SubjectsPanel() {
  const { state, addSubject, updateSubject, deleteSubject, deleteSubjects } = useStore()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const sel = useSelection()

  // Group subjects by grade level, in GRADE_LEVELS order, each group sorted by name.
  const groups = useMemo(() => {
    const byGrade = {}
    for (const s of state.subjects) {
      const g = s.gradeLevel || 'Unspecified'
      if (!byGrade[g]) byGrade[g] = []
      byGrade[g].push(s)
    }
    const order = [...GRADE_LEVELS, 'Unspecified']
    return order
      .filter((g) => byGrade[g] && (!gradeFilter || g === gradeFilter))
      .map((g) => ({
        grade: g,
        subjects: byGrade[g].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      }))
  }, [state.subjects, gradeFilter])

  // Ids currently shown (honoring the grade filter) — the scope of "Select all".
  const visibleIds = useMemo(() => groups.flatMap((grp) => grp.subjects.map((s) => s.id)), [groups])

  function openAdd() {
    setEditing(null)
    setForm({
      ...BLANK,
      color: SUBJECT_PALETTE[state.subjects.length % SUBJECT_PALETTE.length],
    })
    setError('')
    setModalOpen(true)
  }

  function openEdit(s) {
    setEditing(s)
    setForm({
      name: s.name,
      code: s.code || '',
      gradeLevel: s.gradeLevel || 'Grade 1',
      cadence: s.cadence === 'month' ? 'month' : 'week',
      periodsPerWeek: clampFreq(s.periodsPerWeek),
      sessionsPerMonth: clampMonthly(s.sessionsPerMonth),
      color: s.color || SUBJECT_PALETTE[0],
      strandId: s.strandId || '',
      semester: s.semester === '1' || s.semester === '2' || s.semester === '3' ? s.semester : '',
    })
    setError('')
    setModalOpen(true)
  }

  function save() {
    const name = form.name.trim()
    if (!name) return setError('Please enter a subject name.')
    if (!form.gradeLevel) return setError('Please choose a grade level.')
    const dup = state.subjects.find(
      (s) =>
        s.gradeLevel === form.gradeLevel &&
        s.name.trim().toLowerCase() === name.toLowerCase() &&
        (!editing || s.id !== editing.id)
    )
    if (dup) return setError(`${form.gradeLevel} already has a subject named "${name}".`)

    const shs = isShsGrade(form.gradeLevel)
    const validTerm = form.semester === '1' || form.semester === '2' || form.semester === '3'
    const payload = {
      name,
      code: form.code.trim(),
      gradeLevel: form.gradeLevel,
      cadence: form.cadence === 'month' ? 'month' : 'week',
      periodsPerWeek: clampFreq(form.periodsPerWeek),
      sessionsPerMonth: clampMonthly(form.sessionsPerMonth),
      color: form.color,
      // Strand is Senior High only; the term applies to every grade (blank runs
      // in all three terms, so existing subjects keep repeating each term).
      strandId: shs ? form.strandId || '' : '',
      semester: validTerm ? form.semester : '',
    }
    if (editing) {
      updateSubject(editing.id, payload)
      showToast('Subject updated')
    } else {
      addSubject(payload)
      showToast('Subject added')
    }
    setModalOpen(false)
  }

  function remove(s) {
    if (
      window.confirm(
        `Delete "${s.name}" (${s.gradeLevel})? Any generated schedule that uses it should be re-generated.`
      )
    ) {
      deleteSubject(s.id)
      showToast('Subject deleted')
    }
  }

  // "Select all" toggles between every visible subject and none.
  function selectAllVisible() {
    if (sel.count >= visibleIds.length) sel.clear()
    else sel.set(visibleIds)
  }

  // Delete just the ticked subjects, then leave select mode.
  function deleteSelected() {
    const ids = [...sel.selected]
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete ${n} selected subject${n === 1 ? '' : 's'}? Any generated schedule that uses ${n === 1 ? 'it' : 'them'} should be re-generated.`
      )
    ) {
      deleteSubjects(ids)
      showToast(`Deleted ${n} subject${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  // Clear all subjects in every grade (ignores the grade filter by design — the
  // confirm states the full count so it's never a surprise).
  function clearAllSubjects() {
    const ids = state.subjects.map((s) => s.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete all ${n} subject${n === 1 ? '' : 's'}? This clears every subject in every grade and cannot be undone. Any generated schedules should be re-generated.`
      )
    ) {
      deleteSubjects(ids)
      showToast('All subjects cleared')
      sel.exit()
    }
  }

  const total = state.subjects.length

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle="Create each subject once with its grade level. Link teachers to it in the Subject Teachers tab. Subjects are grouped and sorted by grade level and drive the auto-generated schedules."
        action={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            Add subject
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon="book"
          title="No subjects yet"
          message="Start by adding the subjects taught at your school. Give each one a grade level — then link teachers to it in the Subject Teachers tab and generate class schedules."
          action={<Button variant="primary" icon="plus" onClick={openAdd}>Add your first subject</Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="max-w-[12rem]">
              <option value="">All grade levels</option>
              {gradeOptionGroups().map((grp) => (
                <optgroup key={grp.label} label={grp.label}>
                  {grp.grades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500">
                {total} {total === 1 ? 'subject' : 'subjects'}
              </span>
              <BulkActions
                selecting={sel.selecting}
                count={sel.count}
                total={visibleIds.length}
                onStart={sel.start}
                onCancel={sel.exit}
                onSelectAll={selectAllVisible}
                onDeleteSelected={deleteSelected}
                onClearAll={clearAllSubjects}
              />
            </div>
          </div>

          <div className="space-y-5">
            {groups.map((grp) => (
              <div key={grp.grade}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{grp.grade}</h2>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                    {grp.subjects.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grp.subjects.map((s) => {
                    const teachers = teachersForSubject(state.teachers, s.id)
                    const shs = isShsGrade(s.gradeLevel)
                    // Breadcrumb parts, top line: code / strand / term —
                    // only the pieces that apply to this subject. Strand is
                    // Senior High only; the term shows for any grade that pins one.
                    const crumbs = []
                    if (s.code) crumbs.push({ text: s.code })
                    if (shs) crumbs.push({ text: strandLabel(s.strandId), strong: !isCrossStrand(s.strandId) })
                    if (s.semester) crumbs.push({ text: semesterLabel(s.semester) })
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center gap-3 rounded-lg border bg-white p-2.5 ${
                          sel.selecting && sel.isSelected(s.id)
                            ? 'border-green-500 ring-2 ring-green-500'
                            : 'border-slate-200'
                        }`}
                      >
                        {sel.selecting ? (
                          <Checkbox
                            checked={sel.isSelected(s.id)}
                            onChange={() => sel.toggle(s.id)}
                            className="shrink-0"
                            aria-label={`Select ${s.name}`}
                          />
                        ) : null}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                          style={{ backgroundColor: s.color, color: pickTextColor(s.color) }}
                        >
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          {crumbs.length > 0 ? (
                            <div className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight">
                              {crumbs.map((c, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 ? <span className="text-slate-300">/</span> : null}
                                  <span className={c.strong ? 'text-green-700' : 'text-slate-400'}>{c.text}</span>
                                </React.Fragment>
                              ))}
                            </div>
                          ) : null}
                          <div className="truncate text-sm font-semibold leading-tight text-slate-800">{s.name}</div>
                          <div className="truncate text-xs leading-tight text-slate-500">
                            {teachers.length === 0 ? (
                              <span className="text-amber-600">No teacher — link in Subject Teachers</span>
                            ) : teachers.length === 1 ? (
                              formatTeacherName(teachers[0])
                            ) : (
                              `${teachers.length} teachers`
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                            title="How often it meets"
                          >
                            {cadenceLabel(s)}
                          </span>
                          <IconButton icon="edit" title="Edit subject" onClick={() => openEdit(s)} />
                          <IconButton icon="trash" title="Delete subject" variant="danger" onClick={() => remove(s)} />
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
        title={editing ? 'Edit subject' : 'Add subject'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>{editing ? 'Save changes' : 'Add subject'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Subject name" required>
              <TextInput
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mathematics"
              />
            </Field>
            <Field label="Subject code" hint="Optional">
              <TextInput
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MATH 7"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Grade level" required>
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
            <Field
              label="How often it meets"
              hint={
                form.cadence === 'month'
                  ? 'Placed in a free slot and marked (e.g. 2×/mo). It can land on any day.'
                  : 'Days a week this subject meets. The rest of the week is left free as rest time.'
              }
            >
              <div className="flex gap-2">
                <Select
                  value={form.cadence}
                  onChange={(e) => setForm({ ...form, cadence: e.target.value })}
                  className="max-w-[8.5rem] shrink-0"
                >
                  <option value="week">Per week</option>
                  <option value="month">Per month</option>
                </Select>
                {form.cadence === 'month' ? (
                  <Select
                    value={String(form.sessionsPerMonth)}
                    onChange={(e) => setForm({ ...form, sessionsPerMonth: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'time' : 'times'} / month</option>
                    ))}
                  </Select>
                ) : (
                  <Select
                    value={String(form.periodsPerWeek)}
                    onChange={(e) => setForm({ ...form, periodsPerWeek: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'} / week</option>
                    ))}
                  </Select>
                )}
              </div>
            </Field>
          </div>
          {/* Term applies to every grade (blank = all three terms). Strand is
              Senior High only, shown alongside Term for SHS grades. */}
          <div className="grid grid-cols-2 gap-4">
            {isShsGrade(form.gradeLevel) && (
              <Field
                label="Strand"
                hint="Core, Applied and Elective are taken by every strand; a specific strand limits it to that section."
              >
                <Select value={form.strandId} onChange={(e) => setForm({ ...form, strandId: e.target.value })}>
                  <option value="">Core (all strands)</option>
                  <option value="applied">Applied (all strands)</option>
                  <option value="elective">Elective (all strands)</option>
                  {strandOptionGroups().map((grp) => (
                    <optgroup key={grp.label} label={grp.label}>
                      {grp.strands.map((st) => (
                        <option key={st.id} value={st.id}>{st.abbr} — {st.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Term" hint="Leave on all terms, or limit this subject to one of the three terms.">
              <Select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">All terms</option>
                {SEMESTERS.map((sem) => (
                  <option key={sem.id} value={sem.id}>{sem.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Teachers are linked to subjects in the <strong>Subject Teachers</strong> tab — a teacher can
            teach subjects in any grade, and a subject can be shared by more than one teacher.
          </p>
          <Field label="Color" hint="Shown on the printed schedule.">
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_PALETTE.map((c) => {
                const on = form.color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-md border-2 transition-transform ${
                      on ? 'scale-110 border-slate-800' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Use color ${c}`}
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
