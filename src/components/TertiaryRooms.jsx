import React, { useMemo, useState } from 'react'
import { useTertiary } from '../store.jsx'
import { ROOM_TYPES } from '../tertiary.js'
import { useUI } from '../appContext.jsx'
import {
  Button,
  IconButton,
  Field,
  TextInput,
  Segmented,
  Badge,
  Modal,
  EmptyState,
  Checkbox,
  BulkActions,
  useSelection,
} from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

const BLANK = { name: '', type: 'Lecture' }

export default function TertiaryRoomsPanel() {
  const { state, addRoom, updateRoom, deleteRoom, deleteRooms } = useTertiary()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const sel = useSelection()

  const rooms = useMemo(
    () =>
      state.rooms
        .filter((r) => !typeFilter || r.type === typeFilter)
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })),
    [state.rooms, typeFilter]
  )
  const visibleIds = useMemo(() => rooms.map((r) => r.id), [rooms])
  const labs = state.rooms.filter((r) => r.type === 'Laboratory').length

  function openAdd() {
    setEditing(null)
    setForm(BLANK)
    setError('')
    setModalOpen(true)
  }

  function openEdit(r) {
    setEditing(r)
    setForm({ name: r.name || '', type: ROOM_TYPES.includes(r.type) ? r.type : 'Lecture' })
    setError('')
    setModalOpen(true)
  }

  function save() {
    const name = form.name.trim()
    if (!name) return setError('Please enter a room name.')
    const dup = state.rooms.find(
      (r) => (r.name || '').trim().toLowerCase() === name.toLowerCase() && (!editing || r.id !== editing.id)
    )
    if (dup) return setError(`A room named "${name}" already exists.`)
    const payload = { name, type: ROOM_TYPES.includes(form.type) ? form.type : 'Lecture' }
    if (editing) {
      updateRoom(editing.id, payload)
      showToast('Room updated')
    } else {
      addRoom(payload)
      showToast('Room added')
    }
    setModalOpen(false)
  }

  function remove(r) {
    if (window.confirm(`Delete room "${r.name}"? It is removed from any meeting that uses it.`)) {
      deleteRoom(r.id)
      showToast('Room deleted')
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
        `Delete ${n} selected room${n === 1 ? '' : 's'}? ${n === 1 ? 'It is' : 'They are'} removed from any meeting that uses ${n === 1 ? 'it' : 'them'}.`
      )
    ) {
      deleteRooms(ids)
      showToast(`Deleted ${n} room${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  function clearAll() {
    const ids = state.rooms.map((r) => r.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete all ${n} room${n === 1 ? '' : 's'}? They are removed from every meeting that uses them. This cannot be undone.`
      )
    ) {
      deleteRooms(ids)
      showToast('All rooms cleared')
      sel.exit()
    }
  }

  const total = state.rooms.length

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle="List your lecture rooms and laboratories. The scheduler keeps courses with lab hours in laboratory rooms and never double-books a room across two classes."
        action={
          <Button variant="primary" icon="plus" onClick={openAdd}>
            Add room
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon="calendar"
          title="No rooms yet"
          message="Add the lecture rooms and laboratories available for scheduling. Mark labs as Laboratory so courses with lab hours land in the right place."
          action={
            <Button variant="primary" icon="plus" onClick={openAdd}>
              Add your first room
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Segmented
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: '', label: 'All' }, ...ROOM_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-500">
                {total} {total === 1 ? 'room' : 'rooms'} · {labs} {labs === 1 ? 'lab' : 'labs'}
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
                        aria-label="Select all rooms"
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-2.5 font-semibold">Room</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                      sel.selecting && sel.isSelected(r.id) ? 'bg-green-50' : ''
                    }`}
                  >
                    {sel.selecting ? (
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={sel.isSelected(r.id)}
                          onChange={() => sel.toggle(r.id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.type === 'Laboratory' ? 'amber' : 'slate'}>{r.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton icon="edit" title="Edit room" onClick={() => openEdit(r)} />
                        <IconButton icon="trash" title="Delete room" variant="danger" onClick={() => remove(r)} />
                      </div>
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={sel.selecting ? 4 : 3} className="px-4 py-8 text-center text-sm text-slate-400">
                      No rooms match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit room' : 'Add room'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="check" onClick={save}>
              {editing ? 'Save changes' : 'Add room'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Room name" required>
            <TextInput
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Room 301"
            />
          </Field>
          <Field label="Type" hint="Courses with lab hours are placed only in laboratory rooms.">
            <Segmented
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v })}
              options={ROOM_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
