import React, { useMemo, useState } from 'react'
import { useTertiary } from '../store.jsx'
import { useUI } from '../appContext.jsx'
import {
  Button,
  IconButton,
  Field,
  TextInput,
  Select,
  Badge,
  Modal,
  EmptyState,
  Checkbox,
  BulkActions,
  useSelection,
} from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

// A degree program (e.g. BSIT). Its `years` bounds the year levels its courses
// and block sections may use, so it's the first thing set up in Tertiary mode.
const BLANK = { code: '', name: '', years: 4 }

export default function TertiaryProgramsPanel() {
  const { state, addProgram, updateProgram, deleteProgram, deletePrograms } = useTertiary()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const sel = useSelection()

  // How many courses + blocks reference each program (shown per row, and quoted
  // in the delete confirmation so the cascade is never a surprise).
  const stats = useMemo(() => {
    const m = {}
    for (const p of state.programs) m[p.id] = { courses: 0, blocks: 0 }
    for (const c of state.courses) if (m[c.programId]) m[c.programId].courses++
    for (const b of state.blocks) if (m[b.programId]) m[b.programId].blocks++
    return m
  }, [state.programs, state.courses, state.blocks])

  const programs = useMemo(
    () =>
      [...state.programs].sort((a, b) =>
        (a.code || a.name).localeCompare(b.code || b.name, undefined, { numeric: true })
      ),
    [state.programs]
  )
  const visibleIds = useMemo(() => programs.map((p) => p.id), [programs])

  function openAdd() {
    setEditing(null)
    setForm(BLANK)
    setError('')
    setModalOpen(true)
  }

  function openEdit(p) {
    setEditing(p)
    setForm({ code: p.code || '', name: p.name || '', years: p.years || 4 })
    setError('')
    setModalOpen(true)
  }

  function save() {
    const code = form.code.trim()
    const name = form.name.trim()
    if (!code) return setError('Please enter a program code (e.g. BSIT).')
    const dup = state.programs.find(
      (p) => (p.code || '').trim().toLowerCase() === code.toLowerCase() && (!editing || p.id !== editing.id)
    )
    if (dup) return setError(`A program with the code "${code}" already exists.`)
    const payload = { code, name, years: Number(form.years) || 4 }
    if (editing) {
      updateProgram(editing.id, payload)
      showToast('Program updated')
    } else {
      addProgram(payload)
      showToast('Program added')
    }
    setModalOpen(false)
  }

  function remove(p) {
    const s = stats[p.id] || { courses: 0, blocks: 0 }
    const bits = []
    if (s.courses) bits.push(`${s.courses} course${s.courses === 1 ? '' : 's'}`)
    if (s.blocks) bits.push(`${s.blocks} block${s.blocks === 1 ? '' : 's'}`)
    const extra = bits.length ? ` This also deletes its ${bits.join(' and ')}.` : ''
    if (window.confirm(`Delete program "${p.code || p.name}"?${extra} This cannot be undone.`)) {
      deleteProgram(p.id)
      showToast('Program deleted')
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
        `Delete ${n} selected program${n === 1 ? '' : 's'}? Their courses and block sections are deleted too. This cannot be undone.`
      )
    ) {
      deletePrograms(ids)
      showToast(`Deleted ${n} program${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  function clearAll() {
    const ids = state.programs.map((p) => p.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete all ${n} program${n === 1 ? '' : 's'}? Every course and block section is deleted with them. This cannot be undone.`
      )
    ) {
      deletePrograms(ids)
      showToast('All programs cleared')
      sel.exit()
    }
  }

  const total = state.programs.length

  return (
    <div>
      <PageHeader
        title="Programs"
        subtitle="Add each degree program you schedule (e.g. BSIT, BSED). A program's number of years sets which year levels its courses and block sections can use. This is the first step — courses, faculty and blocks all attach to a program."
        action={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            Add program
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon="book"
          title="No programs yet"
          message="Start by adding the degree programs your college or university offers. Everything else in Tertiary mode — courses, faculty, and block sections — is organized under a program."
          action={
            <Button variant="primary" icon="plus" onClick={openAdd}>
              Add your first program
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500">
                {total} {total === 1 ? 'program' : 'programs'}
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

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  {sel.selecting ? (
                    <th className="w-10 px-4 py-2.5">
                      <Checkbox
                        checked={visibleIds.length > 0 && sel.count >= visibleIds.length}
                        onChange={selectAllVisible}
                        aria-label="Select all programs"
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-2.5 font-semibold">Code</th>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Years</th>
                  <th className="px-4 py-2.5 font-semibold">Courses</th>
                  <th className="px-4 py-2.5 font-semibold">Blocks</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => {
                  const s = stats[p.id] || { courses: 0, blocks: 0 }
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                        sel.selecting && sel.isSelected(p.id) ? 'bg-green-50' : ''
                      }`}
                    >
                      {sel.selecting ? (
                        <td className="px-4 py-2.5">
                          <Checkbox
                            checked={sel.isSelected(p.id)}
                            onChange={() => sel.toggle(p.id)}
                            aria-label={`Select ${p.code || p.name}`}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{p.code || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.name || <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.years}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={s.courses ? 'green' : 'slate'}>{s.courses}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={s.blocks ? 'green' : 'slate'}>{s.blocks}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton icon="edit" title="Edit program" onClick={() => openEdit(p)} />
                          <IconButton icon="trash" title="Delete program" variant="danger" onClick={() => remove(p)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit program' : 'Add program'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={save}>
              {editing ? 'Save changes' : 'Add program'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Program code" required hint="Short identifier shown everywhere.">
              <TextInput
                autoFocus
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="BSIT"
              />
            </Field>
            <Field label="Years" hint="Length of the program.">
              <Select value={String(form.years)} onChange={(e) => setForm({ ...form, years: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'year' : 'years'}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Full name" hint="Optional — e.g. Bachelor of Science in Information Technology.">
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bachelor of Science in Information Technology"
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
