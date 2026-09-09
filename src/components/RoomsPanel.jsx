import React, { useMemo, useState } from 'react'
import {
  useStore,
  GRADE_CATEGORIES,
  categoryForGrade,
  gradeOptionGroups,
  pickTextColor,
  formatTeacherName,
  computeConflicts,
  roomLabel,
  subjectsForGrade,
  subjectsForClass,
  subjectsMissingTeacher,
  subjectsMissingTeacherForClass,
  teachersForSubject,
  assignedCount,
  isShsGrade,
  strandLabel,
  strandFullName,
  strandOptionGroups,
  SEMESTERS,
} from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, IconButton, Field, TextInput, Select, Modal, EmptyState, Badge, Icon, Checkbox, BulkActions, useSelection } from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'
import ScheduleBuilder from './ScheduleBuilder.jsx'

/* ============================================================
   RoomsPanel — the home of the create-a-schedule workflow.
   Rooms (grade levels) → inside a room: classrooms → open a
   classroom to auto-generate and preview its weekly program.
   Subjects live in their own top-level tab and link by grade.
   ============================================================ */

export default function RoomsPanel() {
  const { state } = useStore()
  const [openRoomId, setOpenRoomId] = useState(null)

  const openRoom = openRoomId ? state.rooms.find((r) => r.id === openRoomId) : null

  if (openRoom) {
    return <RoomDetail room={openRoom} onBack={() => setOpenRoomId(null)} />
  }
  return <RoomList onOpenRoom={setOpenRoomId} />
}

/* ---------------- Room list ---------------- */

const ROOM_BLANK = { gradeLevel: 'Grade 1', name: '' }

function RoomList({ onOpenRoom }) {
  const { state, addRoom, updateRoom, deleteRoom, deleteRooms } = useStore()
  const { showToast } = useUI()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(ROOM_BLANK)
  const [error, setError] = useState('')
  const sel = useSelection()

  const conflicts = useMemo(() => computeConflicts(state.schedules), [state.schedules])

  const rooms = useMemo(
    () =>
      [...state.rooms].sort((a, b) =>
        roomLabel(a).localeCompare(roomLabel(b), undefined, { numeric: true })
      ),
    [state.rooms]
  )

  // Rooms bucketed into the four school categories (Preschool → Senior High),
  // with any uncategorized grade collected under "Other". Preserves the sorted
  // room order within each category.
  const grouped = useMemo(() => {
    const byCat = {}
    for (const r of rooms) {
      const cat = categoryForGrade(r.gradeLevel)
      const key = cat ? cat.key : 'other'
      if (!byCat[key]) byCat[key] = { key, label: cat ? cat.name : 'Other', rooms: [] }
      byCat[key].rooms.push(r)
    }
    const order = [...GRADE_CATEGORIES.map((c) => c.key), 'other']
    return order.filter((k) => byCat[k]).map((k) => byCat[k])
  }, [rooms])

  function openNew() {
    setEditing(null)
    setForm(ROOM_BLANK)
    setError('')
    setModalOpen(true)
  }

  function openEdit(r) {
    setEditing(r)
    setForm({ gradeLevel: r.gradeLevel || 'Grade 1', name: r.name || '' })
    setError('')
    setModalOpen(true)
  }

  function save() {
    if (!form.gradeLevel) {
      setError('Please choose a grade level.')
      return
    }
    if (editing) {
      updateRoom(editing.id, { gradeLevel: form.gradeLevel, name: form.name.trim() })
      showToast('Grade Level Room updated')
      setModalOpen(false)
    } else {
      const created = addRoom({ gradeLevel: form.gradeLevel, name: form.name.trim() })
      showToast('Grade Level Room created — add classrooms')
      setModalOpen(false)
      onOpenRoom(created.id)
    }
  }

  function remove(r) {
    const nClassrooms = state.schedules.filter((s) => s.roomId === r.id).length
    const detail = nClassrooms
      ? ` This also deletes ${nClassrooms} classroom${nClassrooms === 1 ? '' : 's'} in it. (Subjects belong to the grade level and are kept.)`
      : ''
    if (window.confirm(`Delete the "${roomLabel(r)}" room?${detail} This cannot be undone.`)) {
      deleteRoom(r.id)
      showToast('Grade Level Room deleted')
    }
  }

  // Every room shown — the scope of "Select all".
  const visibleIds = useMemo(() => rooms.map((r) => r.id), [rooms])

  function selectAllVisible() {
    if (sel.count >= visibleIds.length) sel.clear()
    else sel.set(visibleIds)
  }

  // How many classrooms live inside a set of rooms — surfaced in confirms so a
  // bulk room delete never quietly takes sections with it.
  function classroomsInRooms(ids) {
    const set = new Set(ids)
    return state.schedules.filter((s) => set.has(s.roomId)).length
  }

  // Delete just the ticked rooms (and their classrooms), then leave select mode.
  function deleteSelected() {
    const ids = [...sel.selected]
    if (!ids.length) return
    const n = ids.length
    const nc = classroomsInRooms(ids)
    const detail = nc ? ` This also deletes ${nc} classroom${nc === 1 ? '' : 's'} inside ${n === 1 ? 'it' : 'them'}.` : ''
    if (
      window.confirm(
        `Delete ${n} selected room${n === 1 ? '' : 's'}?${detail} (Subjects belong to the grade level and are kept.) This cannot be undone.`
      )
    ) {
      deleteRooms(ids)
      showToast(`Deleted ${n} room${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  // Delete every Grade Level Room and all their classrooms.
  function clearAllRooms() {
    const ids = rooms.map((r) => r.id)
    if (!ids.length) return
    const n = ids.length
    const nc = classroomsInRooms(ids)
    const detail = nc ? ` This also deletes all ${nc} classroom${nc === 1 ? '' : 's'} inside them.` : ''
    if (
      window.confirm(
        `Delete all ${n} Grade Level Room${n === 1 ? '' : 's'}?${detail} (Subjects belong to the grade level and are kept.) This cannot be undone.`
      )
    ) {
      deleteRooms(ids)
      showToast('All rooms cleared')
      sel.exit()
    }
  }

  return (
    <div>
      <PageHeader
        title="Grade Level Rooms"
        subtitle="Create a Grade Level Room, then add its classrooms (sections). Open a classroom to auto-generate its weekly program from the grade's subjects."
        action={<Button variant="primary" icon="plus" onClick={openNew}>New room</Button>}
      />

      {rooms.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
          </span>
          <div className="ml-auto">
            <BulkActions
              selecting={sel.selecting}
              count={sel.count}
              total={visibleIds.length}
              onStart={sel.start}
              onCancel={sel.exit}
              onSelectAll={selectAllVisible}
              onDeleteSelected={deleteSelected}
              onClearAll={clearAllRooms}
              clearAllLabel="Clear all rooms"
            />
          </div>
        </div>
      )}

      {state.subjects.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Before you can generate a schedule, create your <strong>Subjects</strong> (each with a grade level), then link a
            teacher to each subject in the <strong>Subject Teachers</strong> tab.
          </span>
        </div>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No Grade Level Rooms yet"
          message="A Grade Level Room groups the classrooms for one grade level (e.g. Grade 1). Create your first room to begin."
          action={<Button variant="primary" icon="plus" onClick={openNew}>Create a room</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((cat) => (
            <div key={cat.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{cat.label}</h2>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">
                  {cat.rooms.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {cat.rooms.map((r) => {
            const classrooms = state.schedules.filter((s) => s.roomId === r.id)
            const subjects = subjectsForGrade(state.subjects, r.gradeLevel)
            const hasConflict = classrooms.some((s) =>
              conflicts.conflicts.some((arr) => arr.some((it) => it.scheduleId === s.id))
            )
            return (
              <div
                key={r.id}
                className={`flex flex-col rounded-lg border bg-white ${
                  sel.selecting && sel.isSelected(r.id)
                    ? 'border-green-500 ring-2 ring-green-500'
                    : 'border-slate-200'
                }`}
              >
                <button
                  onClick={() => onOpenRoom(r.id)}
                  className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold text-slate-900">{r.gradeLevel || 'Grade level'}</h3>
                      {hasConflict ? (
                        <Badge tone="amber"><Icon name="warning" className="h-3 w-3" /> conflict</Badge>
                      ) : null}
                    </div>
                    {r.name ? <p className="mt-0.5 truncate text-xs text-slate-500">{r.name}</p> : null}
                  </div>
                  <Icon name="grid" className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                </button>
                <div className="flex items-center gap-3 px-4 py-2 text-xs text-slate-500">
                  <span>{classrooms.length} {classrooms.length === 1 ? 'classroom' : 'classrooms'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}</span>
                </div>
                <div className="mt-auto flex items-center gap-1 border-t border-slate-100 px-3 py-2">
                  {sel.selecting ? (
                    <Checkbox
                      checked={sel.isSelected(r.id)}
                      onChange={() => sel.toggle(r.id)}
                      className="mr-1"
                      aria-label={`Select ${roomLabel(r)}`}
                    />
                  ) : null}
                  <Button variant="primary" size="sm" icon="grid" onClick={() => onOpenRoom(r.id)}>Open room</Button>
                  <div className="ml-auto flex items-center gap-1">
                    <IconButton icon="edit" title="Rename / edit room" onClick={() => openEdit(r)} />
                    <IconButton icon="trash" title="Delete room" variant="danger" onClick={() => remove(r)} />
                  </div>
                </div>
              </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Grade Level Room' : 'New Grade Level Room'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={save}>{editing ? 'Save' : 'Create room'}</Button>
          </>
        }
      >
        <div className="space-y-4">
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
            label="Room label"
            hint="Optional — use it to tell apart two rooms of the same grade (e.g. a building or campus name)."
          >
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Main Building"
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}

/* ---------------- Room detail (classrooms) ---------------- */

const CLASS_BLANK = { section: '', moderatorId: '', strandId: '' }

function RoomDetail({ room, onBack }) {
  const { state, addSchedule, updateSchedule, deleteSchedule, deleteSchedules, duplicateSchedule, generateSchedule, generateSchedules, resolveConflicts } = useStore()
  const { showToast, openPrint } = useUI()

  const [openClassroomId, setOpenClassroomId] = useState(null)

  // classroom create/edit modal
  const [classOpen, setClassOpen] = useState(false)
  const [classEditing, setClassEditing] = useState(null)
  const [classForm, setClassForm] = useState(CLASS_BLANK)
  const [classError, setClassError] = useState('')
  const sel = useSelection()

  const conflicts = useMemo(() => computeConflicts(state.schedules), [state.schedules])
  const moderators = useMemo(() => state.teachers.filter((t) => t.role === 'Moderator'), [state.teachers])
  // Senior High rooms carry strands + two semesters; every other grade keeps the
  // simpler grade-wide model.
  const isShs = isShsGrade(room.gradeLevel)
  const gradeSubjects = useMemo(
    () => subjectsForGrade(state.subjects, room.gradeLevel).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [state.subjects, room.gradeLevel]
  )

  const classrooms = useMemo(
    () =>
      state.schedules
        .filter((s) => s.roomId === room.id)
        .sort((a, b) => (a.section || '').localeCompare(b.section || '', undefined, { numeric: true })),
    [state.schedules, room.id]
  )

  // Every classroom in this room — the scope of "Select all".
  const visibleIds = useMemo(() => classrooms.map((s) => s.id), [classrooms])

  // The subjects one SHS section actually studies — its strand's subjects plus
  // Core, across BOTH semesters (deduped). For a non-SHS grade this is just the
  // grade's subjects, so the gate below is unchanged.
  const sectionSubjects = (s) => {
    if (!isShs) return gradeSubjects
    const sid = s.strandId || ''
    const seen = new Set()
    const out = []
    for (const sem of ['1', '2']) {
      for (const subj of subjectsForClass(state.subjects, room.gradeLevel, sid, sem)) {
        if (!seen.has(subj.id)) { seen.add(subj.id); out.push(subj) }
      }
    }
    return out
  }
  // The subjects a section takes that still have no teacher — the strict gate.
  // Scoped to the section's strand + both semesters for SHS.
  const sectionMissing = (s) => {
    if (!isShs) return subjectsMissingTeacher(state.subjects, state.teachers, room.gradeLevel)
    const sid = s.strandId || ''
    const seen = new Set()
    const out = []
    for (const sem of ['1', '2']) {
      for (const subj of subjectsMissingTeacherForClass(state.subjects, state.teachers, room.gradeLevel, sid, sem)) {
        if (!seen.has(subj.id)) { seen.add(subj.id); out.push(subj) }
      }
    }
    return out
  }
  // A single section can generate when it has subjects and every one has a teacher.
  const sectionCanGenerate = (s) => sectionSubjects(s).length > 0 && sectionMissing(s).length === 0

  // Grade-wide gate (used for the summary + "Generate all"). For SHS this is the
  // union of teacher gaps across the strands actually present in this room, so a
  // strand with no section here never blocks the others.
  const missing = useMemo(() => {
    if (!isShs) return subjectsMissingTeacher(state.subjects, state.teachers, room.gradeLevel)
    const strands = [...new Set(classrooms.map((s) => s.strandId || ''))]
    const seen = new Set()
    const out = []
    for (const sid of strands) {
      for (const sem of ['1', '2']) {
        for (const subj of subjectsMissingTeacherForClass(state.subjects, state.teachers, room.gradeLevel, sid, sem)) {
          if (!seen.has(subj.id)) { seen.add(subj.id); out.push(subj) }
        }
      }
    }
    return out
  }, [isShs, classrooms, state.subjects, state.teachers, room.gradeLevel])
  const missingTeacher = missing.length
  const missingIds = useMemo(() => new Set(missing.map((s) => s.id)), [missing])
  // Can every section in this room be generated? Non-SHS: subjects exist and all
  // have teachers. SHS: every existing section passes its own strand/semester gate.
  const canGenerate = isShs
    ? classrooms.length > 0 && classrooms.every(sectionCanGenerate)
    : gradeSubjects.length > 0 && missingTeacher === 0

  // Does any section in this room currently have a teacher clash? Drives the
  // room-level "Fix conflicts" button.
  const roomHasConflict = useMemo(
    () =>
      classrooms.some((s) =>
        conflicts.conflicts.some((arr) => arr.some((it) => it.scheduleId === s.id))
      ),
    [classrooms, conflicts]
  )

  const openClassroom = openClassroomId ? state.schedules.find((s) => s.id === openClassroomId) : null

  function openNewClass() {
    setClassEditing(null)
    setClassForm(CLASS_BLANK)
    setClassError('')
    setClassOpen(true)
  }

  function openEditClass(s) {
    setClassEditing(s)
    setClassForm({
      section: s.section,
      moderatorId: s.moderatorId,
      strandId: s.strandId || '',
    })
    setClassError('')
    setClassOpen(true)
  }

  function saveClass() {
    if (!classForm.section.trim()) {
      setClassError('Please enter a section name.')
      return
    }
    if (isShs && !classForm.strandId) {
      setClassError('Please choose a strand for this Senior High section.')
      return
    }
    // Strand only applies to Senior High; a non-SHS section always stores it blank.
    const payload = {
      section: classForm.section.trim(),
      moderatorId: classForm.moderatorId,
      strandId: isShs ? classForm.strandId || '' : '',
    }
    if (classEditing) {
      updateSchedule(classEditing.id, payload)
      showToast('Classroom updated')
      setClassOpen(false)
    } else {
      const created = addSchedule({ ...payload, roomId: room.id })
      showToast('Classroom created — click Generate to build its schedule')
      setClassOpen(false)
      setOpenClassroomId(created.id)
    }
  }

  function removeClass(s) {
    if (window.confirm(`Delete the ${s.section} classroom in ${roomLabel(room)}? This cannot be undone.`)) {
      if (openClassroomId === s.id) setOpenClassroomId(null)
      deleteSchedule(s.id)
      showToast('Classroom deleted')
    }
  }

  // "Select all" toggles between every classroom in this room and none.
  function selectAllVisible() {
    if (sel.count >= visibleIds.length) sel.clear()
    else sel.set(visibleIds)
  }

  // Delete just the ticked classrooms, then leave select mode.
  function deleteSelectedClasses() {
    const ids = [...sel.selected]
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete ${n} selected classroom${n === 1 ? '' : 's'} in ${roomLabel(room)}? This cannot be undone.`
      )
    ) {
      if (ids.includes(openClassroomId)) setOpenClassroomId(null)
      deleteSchedules(ids)
      showToast(`Deleted ${n} classroom${n === 1 ? '' : 's'}`)
      sel.exit()
    }
  }

  // Delete every classroom (section) in this room.
  function clearAllClasses() {
    const ids = classrooms.map((s) => s.id)
    if (!ids.length) return
    const n = ids.length
    if (
      window.confirm(
        `Delete all ${n} classroom${n === 1 ? '' : 's'} in ${roomLabel(room)}? The room itself is kept. This cannot be undone.`
      )
    ) {
      setOpenClassroomId(null)
      deleteSchedules(ids)
      showToast('All classrooms cleared')
      sel.exit()
    }
  }

  function duplicateClass(s) {
    const copy = duplicateSchedule(s.id)
    if (copy) {
      showToast('Classroom copied — rename, then Regenerate to stagger teachers')
      openEditClass(copy)
    }
  }

  function handleGenerate(s) {
    const subs = sectionSubjects(s)
    const miss = sectionMissing(s)
    if (subs.length === 0) {
      showToast(
        isShs
          ? `No subjects for ${strandLabel(s.strandId)} in ${room.gradeLevel} yet — add them (with this strand) in the Subjects tab`
          : `No subjects for ${room.gradeLevel} yet — add them in the Subjects tab`,
        'error'
      )
      return
    }
    if (miss.length > 0) {
      showToast(
        `${miss.length} subject${miss.length === 1 ? '' : 's'} still need a teacher — assign one in the Subject Teachers tab`,
        'error'
      )
      return
    }
    const res = generateSchedule(s.id)
    if (!res.ok) {
      showToast(
        res.reason === 'no-subjects'
          ? `No subjects for ${room.gradeLevel} yet — add them in the Subjects tab`
          : 'Could not generate schedule',
        'error'
      )
      return
    }
    let msg = `Generated ${res.placed} of ${res.requested} session${res.requested === 1 ? '' : 's'} for ${s.section || 'section'}`
    const notes = []
    if (isShs) notes.push('1st + 2nd semester')
    if (res.unplaced) notes.push(`${res.unplaced} couldn't fit conflict-free`)
    if (res.missingTeacher) notes.push(`${res.missingTeacher} without a teacher`)
    if (notes.length) msg += ` · ${notes.join(' · ')}`
    showToast(msg, res.unplaced || res.missingTeacher ? 'error' : 'success')
  }

  function generateAll() {
    if (gradeSubjects.length === 0) {
      showToast(`No subjects for ${room.gradeLevel} yet — add them in the Subjects tab`, 'error')
      return
    }
    // SHS: block only if some existing section can't be generated (its strand's
    // subjects still lack a teacher). Non-SHS: the grade-wide gate.
    if (isShs) {
      const blocked = classrooms.filter((s) => !sectionCanGenerate(s))
      if (blocked.length > 0) {
        showToast(
          `${blocked.length} section${blocked.length === 1 ? '' : 's'} still need a teacher for every subject in ${blocked.length === 1 ? 'its' : 'their'} strand — assign in the Subject Teachers tab`,
          'error'
        )
        return
      }
    } else if (missingTeacher > 0) {
      showToast(
        `${missingTeacher} subject${missingTeacher === 1 ? '' : 's'} in ${room.gradeLevel} still need a teacher — assign one in the Subject Teachers tab`,
        'error'
      )
      return
    }
    // Threaded batch: each section is staggered around the ones already built in
    // this same pass, so "Generate all" comes out conflict-free in one go.
    const res = generateSchedules(classrooms.map((s) => s.id))
    const base = `Generated ${classrooms.length} classroom${classrooms.length === 1 ? '' : 's'}`
    if (res.unplaced) {
      showToast(`${base} · ${res.unplaced} session${res.unplaced === 1 ? '' : 's'} couldn't fit conflict-free`, 'error')
    } else {
      showToast(base)
    }
  }

  // One-click fix for the teacher clashes flagged on the section cards.
  // Regenerates only the conflicting sections in this room, re-staggering the
  // shared teachers into free periods; non-conflicting sections stay untouched.
  function handleFixConflicts() {
    const res = resolveConflicts(classrooms.map((s) => s.id))
    if (res.nothing || res.count === 0) {
      showToast('No conflicts to fix in this room')
      return
    }
    const base = `Fixed ${res.count} conflicting classroom${res.count === 1 ? '' : 's'}`
    if (res.unplaced) {
      showToast(
        `${base} · ${res.unplaced} session${res.unplaced === 1 ? '' : 's'} still can't fit — add a class period in Schedule Times or free up a teacher`,
        'error'
      )
    } else {
      showToast(base)
    }
  }

  // ----- Builder view (inside a classroom) -----
  if (openClassroom) {
    return (
      <ScheduleBuilder
        scheduleId={openClassroom.id}
        onBack={() => setOpenClassroomId(null)}
        onEditMeta={() => openEditClass(openClassroom)}
      />
    )
  }

  const roomClassroomsPrint = { type: 'section-all', roomId: room.id }

  // ----- Room detail view -----
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <IconButton icon="up" title="Back to rooms" variant="secondary" onClick={onBack} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900">{room.gradeLevel || 'Grade level'}</h1>
          {room.name ? <p className="truncate text-sm text-slate-500">{room.name}</p> : null}
        </div>
      </div>

      {/* Subjects summary for this grade (managed in the Subjects tab) */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Subjects for {room.gradeLevel || 'this grade'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              These are scheduled automatically — each subject meets its set number of days per week, and free periods are
              left as rest time for the teacher. Manage subjects and their weekly sessions in the Subjects tab.
            </p>
          </div>
          <Badge tone={gradeSubjects.length ? 'green' : 'amber'}>
            {gradeSubjects.length} {gradeSubjects.length === 1 ? 'subject' : 'subjects'}
          </Badge>
        </div>
        <div className="p-4">
          {gradeSubjects.length === 0 ? (
            <p className="text-sm text-amber-700">
              No subjects for {room.gradeLevel || 'this grade'} yet. Open the <strong>Subjects</strong> tab to add them —
              you need at least one before you can generate a schedule.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {gradeSubjects.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
                    style={{ background: s.color, color: pickTextColor(s.color) }}
                    title={missingIds.has(s.id) ? 'No teacher assigned yet' : 'Has a teacher'}
                  >
                    {s.name}
                    {s.code ? <span className="ml-1 opacity-75">· {s.code}</span> : null}
                  </span>
                ))}
              </div>
              {missingTeacher > 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  {missingTeacher} subject{missingTeacher === 1 ? '' : 's'} still need a teacher: <strong>{missing.map((s) => s.name).join(', ')}</strong>.
                  Link {missingTeacher === 1 ? 'a teacher' : 'teachers'} in the Subject Teachers tab — every subject needs one before you can generate.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Classrooms / sections */}
      <div className="mt-6 mb-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Classrooms (Sections)</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Each classroom is one weekly program. Click <strong>Generate</strong> to fill it automatically — teachers are
            staggered across sections to avoid clashes.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {!sel.selecting && roomHasConflict && (
            <Button variant="warn" icon="check" onClick={handleFixConflicts}>Fix conflicts</Button>
          )}
          {!sel.selecting && classrooms.length > 1 && (
            <Button icon="calendar" onClick={generateAll} disabled={!canGenerate}>Generate all</Button>
          )}
          {!sel.selecting && classrooms.length > 0 && (
            <Button icon="print" onClick={() => openPrint(roomClassroomsPrint)}>Print all</Button>
          )}
          {classrooms.length > 0 && (
            <BulkActions
              selecting={sel.selecting}
              count={sel.count}
              total={visibleIds.length}
              onStart={sel.start}
              onCancel={sel.exit}
              onSelectAll={selectAllVisible}
              onDeleteSelected={deleteSelectedClasses}
              onClearAll={clearAllClasses}
            />
          )}
          {!sel.selecting && (
            <Button variant="primary" icon="plus" onClick={openNewClass}>New classroom</Button>
          )}
        </div>
      </div>

      {state.teachers.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Add teachers in the Subject Teachers tab so you can pick a section adviser and generate schedules.</span>
        </div>
      )}

      {classrooms.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No classrooms yet"
          message="Create a classroom with a section name, then click Generate to build its weekly program automatically."
          action={<Button variant="primary" icon="plus" onClick={openNewClass}>Create a classroom</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {classrooms.map((s) => {
            const adviser = state.teachers.find((t) => t.id === s.moderatorId)
            const count = assignedCount(s)
            const hasConflict = conflicts.conflicts.some((arr) => arr.some((it) => it.scheduleId === s.id))
            const canGen = sectionCanGenerate(s)
            return (
              <div
                key={s.id}
                className={`flex flex-col rounded-lg border bg-white ${
                  sel.selecting && sel.isSelected(s.id)
                    ? 'border-green-500 ring-2 ring-green-500'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    {sel.selecting ? (
                      <Checkbox
                        checked={sel.isSelected(s.id)}
                        onChange={() => sel.toggle(s.id)}
                        className="mt-1 shrink-0"
                        aria-label={`Select ${s.section || 'section'}`}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-bold text-slate-900">{s.section || 'Section'}</h3>
                        {isShs ? (
                          <Badge tone={s.strandId ? 'green' : 'slate'} title={strandFullName(s.strandId)}>
                            {strandLabel(s.strandId)}
                          </Badge>
                        ) : null}
                        {hasConflict ? (
                          <Badge tone="amber"><Icon name="warning" className="h-3 w-3" /> conflict</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {adviser ? `Adviser: ${formatTeacherName(adviser)}` : 'No adviser set'}
                      </p>
                    </div>
                  </div>
                  <Badge tone={count > 0 ? 'green' : 'slate'}>{count > 0 ? `${count} assigned` : 'Not generated'}</Badge>
                </div>
                {isShs ? (
                  <div className="border-b border-slate-100 px-4 py-1.5 text-[11px] text-slate-400">
                    1st + 2nd semester programs
                  </div>
                ) : null}
                <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-slate-100 px-3 py-2">
                  {hasConflict && (
                    <Button variant="warn" size="sm" icon="check" onClick={handleFixConflicts} title="Auto-fix teacher clashes in this room">
                      Fix
                    </Button>
                  )}
                  <Button variant="primary" size="sm" icon="calendar" onClick={() => handleGenerate(s)} disabled={!canGen}>
                    {count > 0 ? 'Regenerate' : 'Generate'}
                  </Button>
                  <Button variant="secondary" size="sm" icon="grid" onClick={() => setOpenClassroomId(s.id)}>Open</Button>
                  <div className="ml-auto flex items-center gap-1">
                    <IconButton icon="print" title="Print / Save PDF" onClick={() => openPrint({ type: 'section', scheduleId: s.id })} />
                    <IconButton icon="copy" title="Duplicate section" onClick={() => duplicateClass(s)} />
                    <IconButton icon="edit" title="Edit details" onClick={() => openEditClass(s)} />
                    <IconButton icon="trash" title="Delete" variant="danger" onClick={() => removeClass(s)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={classOpen}
        onClose={() => setClassOpen(false)}
        title={classEditing ? 'Edit classroom details' : `New classroom · ${room.gradeLevel}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setClassOpen(false)}>Cancel</Button>
            <Button variant="primary" icon="check" onClick={saveClass}>{classEditing ? 'Save' : 'Create classroom'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Grade level: <span className="font-semibold text-slate-700">{room.gradeLevel}</span>
            {room.name ? <> · {room.name}</> : null}
          </div>
          <Field label="Section" required>
            <TextInput
              autoFocus
              value={classForm.section}
              onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
              placeholder="e.g. Diamond"
            />
          </Field>

          {/* Strand — Senior High only. It decides which strand-specific subjects
              (on top of Core) this section studies, in both semesters. */}
          {isShs && (
            <Field
              label="Strand"
              required
              hint="This section studies its strand's subjects plus every Core subject. Each semester is built separately."
            >
              <Select value={classForm.strandId} onChange={(e) => setClassForm({ ...classForm, strandId: e.target.value })}>
                <option value="">— Choose a strand —</option>
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

          <Field label="Classroom moderator / adviser" hint="Handles Homeroom Time. Only teachers marked as Moderator appear here.">
            <Select value={classForm.moderatorId} onChange={(e) => setClassForm({ ...classForm, moderatorId: e.target.value })}>
              <option value="">— None —</option>
              {moderators.map((t) => (
                <option key={t.id} value={t.id}>{formatTeacherName(t)}</option>
              ))}
            </Select>
          </Field>
          {moderators.length === 0 && (
            <p className="-mt-2 text-xs text-amber-700">
              No moderators yet. Mark a teacher as “Moderator” in the Subject Teachers tab to assign an adviser.
            </p>
          )}

          {classError ? <p className="text-sm text-red-600">{classError}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
