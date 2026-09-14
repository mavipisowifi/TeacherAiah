import React, { useMemo } from 'react'
import {
  useStore,
  computeConflicts,
  hasSemesteredSchedules,
  formatTeacherName,
  semesterLabel,
} from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Modal, Button, Icon } from './ui.jsx'

/* ============================================================
   ConflictReport — one consolidated view of every teacher clash.

   Opened by the "Check Conflicts" button in the sidebar. In K–12
   each section has its own classroom and grid, so the only real
   clash is a TEACHER booked in two places at the same time. This
   modal lists each one (who, when, and the two sections), lets you
   fix a single clash or all of them at once (re-staggering the
   shared teacher into a free period), and shows a reassuring green
   state when there's nothing to resolve.

   Detection here is the same computeConflicts() used across the
   app — this view just gathers it all in one place and makes it
   actionable, instead of leaving the count passive in the footer.
   ============================================================ */
export default function ConflictReport({ open, onClose, onNavigate }) {
  const { state, resolveConflicts } = useStore()
  const { showToast } = useUI()

  // Live off the store: after a fix, dispatch updates state.schedules,
  // this recomputes, and the list shrinks (down to the green state).
  const { conflicts } = useMemo(() => computeConflicts(state.schedules), [state.schedules])
  const termed = useMemo(() => hasSemesteredSchedules(state.schedules), [state.schedules])

  const teachersById = useMemo(
    () => Object.fromEntries(state.teachers.map((t) => [t.id, t])),
    [state.teachers]
  )
  const subjectsById = useMemo(
    () => Object.fromEntries(state.subjects.map((s) => [s.id, s])),
    [state.subjects]
  )

  const total = conflicts.length

  // Re-stagger conflicting classrooms. No scope = fix everything; an array of
  // schedule ids fixes just that clash (the resolver clears it even when the
  // other side sits in another room). Mirrors ScheduleBuilder's handleFix.
  function fix(scopeIds) {
    const res = resolveConflicts(scopeIds)
    if (res.nothing || res.count === 0) {
      showToast('No conflicts to fix')
      return
    }
    const base = `Fixed ${res.count} conflicting schedule${res.count === 1 ? '' : 's'}`
    showToast(
      res.unplaced
        ? `${base} · ${res.unplaced} session${res.unplaced === 1 ? '' : 's'} still can't fit — add a class period or free up a teacher`
        : base,
      res.unplaced ? 'error' : 'success'
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={total > 0 ? `Conflict report · ${total} to resolve` : 'Conflict report'}
      footer={
        <>
          {total > 0 && onNavigate ? (
            <Button variant="secondary" icon="calendar" onClick={() => onNavigate('rooms')}>
              Open Grade Level Rooms
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {total > 0 ? (
            <Button variant="warn" icon="check" onClick={() => fix()}>
              Fix all conflicts
            </Button>
          ) : null}
        </>
      }
    >
      {total === 0 ? (
        <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
          <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">No teacher conflicts.</p>
            <p className="mt-0.5 text-green-700">
              Every teacher is in just one place at a time across all grades and sections
              {termed ? ', within each term' : ''}. Your schedules are clear to print.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Each item below is one teacher booked in two places at the same time. Click{' '}
            <strong>Fix</strong> to resolve just that clash, or <strong>Fix all conflicts</strong> to
            let TEACHERaiah re-stagger every shared teacher into a free period.
          </p>
          <ul className="space-y-3">
            {conflicts.map((group, i) => {
              const t = teachersById[group[0].teacherId]
              // A cluster may mix an all-term class ('') with a term-specific one;
              // take the first non-blank term so the label is accurate.
              const sem = group.map((it) => it.semester).find(Boolean) || ''
              const semShort = semesterLabel(sem)
              return (
                <li key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <div className="text-sm font-semibold text-amber-900">
                          {t ? formatTeacherName(t) : 'A teacher'} — double-booked on {group[0].day} at{' '}
                          {group[0].time}
                          {semShort ? ` · ${semShort}` : ''}
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                          {group.map((it, j) => {
                            const subj = subjectsById[it.subjectId]
                            return (
                              <li key={j}>
                                <strong>
                                  {it.gradeLevel} {it.section}
                                </strong>
                                {subj ? ` · ${subj.name}` : ''}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                    <Button
                      variant="warn"
                      size="sm"
                      icon="check"
                      className="shrink-0"
                      onClick={() => fix(group.map((it) => it.scheduleId))}
                    >
                      Fix
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Modal>
  )
}
