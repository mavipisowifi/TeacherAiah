import React, { useMemo, useState } from 'react'
import { useTertiary } from '../store.jsx'
import { YEAR_LEVELS, facultyName, coursesForBlock } from '../tertiary.js'
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

// A block section (e.g. "BSIT 1-A") — a cohort that takes a program + year
// level's courses together. Its per-term timetable is generated in the
// Schedules tab; here we just define the sections and their adviser.
const BLANK = { programId: '', yearLevel: YEAR_LEVELS[0], name: '', adviserId: '' }

export default function TertiaryBlocksPanel() {
  const { state, addBlock, updateBlock, deleteBlock, deleteBlocks } = useTertiary()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const sel = useSelection()

  const hasPrograms = state.programs.length > 0
  const facultyById = useMemo(() => Object.fromEntries(state.faculty.map((f) => [f.id, f])), [state.faculty])

  const yearOptions = useMemo(() => {
    const prog = state.programs.find((p) => p.id === form.programId)
    const n = prog ? Math.min(prog.years || YEAR_LEVELS.length, YEAR_LEVELS.length) : YEAR_LEVELS.length
    return YEAR_LEVELS.slice(0, Math.max(1, n))
  }, [state.programs, form.programId])

  // Group blocks by program, each group sorted by year level then name.
  const groups = useMemo(() => {
    const yearIdx = (y) => {
      const i = YEAR_LEVELS.indexOf(y)
      return i < 0 ? 99 : i
    }
    return state.programs
      .filter((p) => !programFilter || p.id === programFilter)
      .map((p) => ({
        program: p,
        blocks: state.blocks
          .filter((b) => b.programId === p.id)
          .sort(
            (a, b) =>
              yearIdx(a.yearLevel) - yearIdx(b.yearLevel) ||
              (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
          ),
      }))
      .filter((g) => g.blocks.length > 0)
  }, [state.programs, state.blocks, programFilter])

  const visibleIds = useMemo(() => groups.flatMap((g) => g.blocks.map((b) => b.id)), [groups])

  function openAdd() {
    setEditing(null)
    setForm({
      ...BLANK,
      programId: programFilter || (state.programs[0] && state.programs[0].id) || '',
    })
    setError('')
    setModalOpen(true)
  }

  function openEdit(b) {
    setEditing(b)
    setForm({
      programId: b.programId || '',
      yearLevel: b.yearLevel || YEAR_LEVELS[0],
      name: b.name || '',
      adviserId: b.adviserId || '',
    })
    setError('')
    setModalOpen(true)
  }

  function save() {
    const name = form.name.trim()
    if (!form.programId) return setError('Please choose a program.')
    if (!name) return setError('Please enter a block name (e.g. BSIT 1-A).')
    const dup = state.blocks.find(
      (b) =>
        b.programId === form.programId &&
        (b.name || '').trim().toLowerCase() === name.toLowerCase() &&
        (!editing || b.id !== editing.id)
    )
    if (dup) return setError(`This program already has a block named "${name}".`)
    // Only keep an adviser id that still exists.
    const adviserId = facultyById[form.adviserId] ? form.adviserId : ''
    const payload = { programId: form.programId, yearLevel: form.yearLevel, name, adviserId }
    if (editing) {
      updateBlock(editing.id, payload)
      showToast('Block updated')
    } else {
      addBlock(payload)
      showToast('Block added')
    }
    setModalOpen(false)
  }

  function remove(b) {
    if (window.confirm(`Delete block "${b.name}"? Its generated timetable is removed too. This cannot be undone.`)) {
      deleteBlock(b.id)
      showToast('Block deleted')
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
    if (window.confirm(`Delete ${n} selected block${n === 1 ? '' : 's'}? Their timetables are removed too.`)) {
      deleteBlocks(ids)
      showToast(`Deleted ${n} block${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  function clearAll() {
    const ids = state.blocks.map((b) => b.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete all ${n} block${n === 1 ? '' : 's'} across every program? Their timetables are removed too. This cannot be undone.`
      )
    ) {
      deleteBlocks(ids)
      showToast('All blocks cleared')
      sel.exit()
    }
  }

  const total = state.blocks.length

  if (!hasPrograms) {
    return (
      <div>
        <PageHeader
          title="Block sections"
          subtitle="Groups of students that take a program + year level's courses together (e.g. BSIT 1-A)."
        />
        <EmptyState
          icon="grid"
          title="Add a program first"
          message="Block sections belong to a degree program. Create at least one program in the Programs tab, then define its sections here."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Block sections"
        subtitle="Create the block sections you schedule (e.g. BSIT 1-A). Each block takes the courses of its program and year level together; you generate its per-term timetable in the Schedules tab."
        action={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            Add block
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon="grid"
          title="No block sections yet"
          message="Add the sections you schedule — a block is a cohort like BSIT 1-A that takes its year level's courses together."
          action={
            <Button variant="primary" icon="plus" onClick={openAdd}>
              Add your first block
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
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500">
                {total} {total === 1 ? 'block' : 'blocks'}
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
                    {grp.blocks.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grp.blocks.map((b) => {
                    const nCourses = coursesForBlock(state.courses, b.programId, b.yearLevel).length
                    const adviser = facultyById[b.adviserId]
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center gap-3 rounded-lg border bg-white p-2.5 ${
                          sel.selecting && sel.isSelected(b.id)
                            ? 'border-green-500 ring-2 ring-green-500'
                            : 'border-slate-200'
                        }`}
                      >
                        {sel.selecting ? (
                          <Checkbox
                            checked={sel.isSelected(b.id)}
                            onChange={() => sel.toggle(b.id)}
                            className="shrink-0"
                            aria-label={`Select ${b.name}`}
                          />
                        ) : null}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-green-100 text-xs font-bold text-green-700">
                          {b.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="truncate text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
                            {b.yearLevel}
                          </div>
                          <div className="truncate text-sm font-semibold leading-tight text-slate-800">{b.name}</div>
                          <div className="truncate text-xs leading-tight text-slate-500">
                            {adviser ? (
                              <>Adviser: {facultyName(adviser)}</>
                            ) : (
                              <span className="text-slate-400">No adviser</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                            title="Courses for this program + year level"
                          >
                            {nCourses} {nCourses === 1 ? 'course' : 'courses'}
                          </span>
                          <IconButton icon="edit" title="Edit block" onClick={() => openEdit(b)} />
                          <IconButton icon="trash" title="Delete block" variant="danger" onClick={() => remove(b)} />
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
        title={editing ? 'Edit block' : 'Add block'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={save}>
              {editing ? 'Save changes' : 'Add block'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
            <Field label="Year level">
              <Select value={form.yearLevel} onChange={(e) => setForm({ ...form, yearLevel: e.target.value })}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Block name" required hint="A short section label, e.g. BSIT 1-A.">
            <TextInput
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="BSIT 1-A"
            />
          </Field>
          <Field label="Adviser" hint="Optional — the faculty member advising this section.">
            <Select value={form.adviserId} onChange={(e) => setForm({ ...form, adviserId: e.target.value })}>
              <option value="">No adviser</option>
              {state.faculty
                .slice()
                .sort((a, b) => facultyName(a).localeCompare(facultyName(b)))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {facultyName(f)}
                  </option>
                ))}
            </Select>
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
