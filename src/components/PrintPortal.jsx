import React, { useEffect, useMemo, useState } from 'react'
import { useStore, formatTeacherName, isShsGrade, semesterLabel } from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Icon, Button } from './ui.jsx'
import ScheduleTable from './ScheduleTable.jsx'
import IndividualTable from './IndividualTable.jsx'

function sanitize(name) {
  return (name || 'schedule')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export default function PrintPortal({ target, onClose }) {
  const { state } = useStore()
  const { showToast } = useUI()
  const [busy, setBusy] = useState(false)

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Build the list of printable items for the requested target.
  const items = useMemo(() => {
    if (!target) return []
    const sem = target.semester || ''
    if (target.type === 'section') {
      // One classroom — print the semester currently in view (SHS); K–10 prints
      // its single all-year grid regardless.
      const s = state.schedules.find((x) => x.id === target.scheduleId)
      if (!s) return []
      return [{ key: s.id, node: <ScheduleTable schedule={s} print semester={sem} /> }]
    }
    if (target.type === 'section-all') {
      // A whole room — print everything: both semester programs for each SHS
      // section, a single grid for each K–10 section.
      return [...state.schedules]
        .filter((s) => (target.roomId ? s.roomId === target.roomId : true))
        .sort((a, b) => (a.gradeLevel + a.section).localeCompare(b.gradeLevel + b.section))
        .flatMap((s) =>
          isShsGrade(s.gradeLevel)
            ? ['1', '2'].map((sm) => ({ key: `${s.id}-${sm}`, node: <ScheduleTable schedule={s} print semester={sm} /> }))
            : [{ key: s.id, node: <ScheduleTable schedule={s} print /> }]
        )
    }
    if (target.type === 'individual') {
      return [{ key: target.teacherId, node: <IndividualTable teacherId={target.teacherId} print semester={sem} /> }]
    }
    if (target.type === 'individual-all') {
      return [...state.teachers]
        .sort((a, b) => formatTeacherName(a).localeCompare(formatTeacherName(b)))
        .map((t) => ({ key: t.id, node: <IndividualTable teacherId={t.id} print semester={sem} /> }))
    }
    return []
  }, [target, state.schedules, state.teachers])

  // Title + default file name for the toolbar / save dialog.
  const { title, defaultName } = useMemo(() => {
    if (!target) return { title: 'Print preview', defaultName: 'schedule.pdf' }
    const sem = target.semester || ''
    const semShort = semesterLabel(sem) // '' for a non-semestered target
    const semTitle = semShort ? ` · ${semShort}` : ''
    const semFile = semShort ? `-${sanitize(semShort)}` : ''
    if (target.type === 'section') {
      const s = state.schedules.find((x) => x.id === target.scheduleId)
      return s
        ? { title: `${s.gradeLevel} · ${s.section}${semTitle}`, defaultName: `${sanitize(`${s.gradeLevel}-${s.section}`)}${semFile}-schedule.pdf` }
        : { title: 'Schedule', defaultName: 'schedule.pdf' }
    }
    if (target.type === 'section-all') {
      if (target.roomId) {
        const room = state.rooms.find((r) => r.id === target.roomId)
        const label = room ? (room.name ? `${room.gradeLevel}-${room.name}` : room.gradeLevel) : 'room'
        const heading = room ? (room.name ? `${room.gradeLevel} · ${room.name}` : room.gradeLevel) : 'Room'
        return { title: `${heading} — all classrooms`, defaultName: `${sanitize(label)}-schedules.pdf` }
      }
      return { title: 'All class schedules', defaultName: 'all-class-schedules.pdf' }
    }
    if (target.type === 'individual') {
      const t = state.teachers.find((x) => x.id === target.teacherId)
      return t
        ? { title: `${formatTeacherName(t)}${semTitle}`, defaultName: `${sanitize(formatTeacherName(t))}${semFile}-schedule.pdf` }
        : { title: 'Teacher schedule', defaultName: 'teacher-schedule.pdf' }
    }
    if (target.type === 'individual-all') {
      return { title: `All teacher schedules${semTitle}`, defaultName: `all-teacher-schedules${semFile}.pdf` }
    }
    return { title: 'Print preview', defaultName: 'schedule.pdf' }
  }, [target, state.schedules, state.teachers, state.rooms])

  async function handlePrint() {
    if (busy) return
    if (window.scheduleAPI && window.scheduleAPI.printPage) {
      setBusy(true)
      try {
        await window.scheduleAPI.printPage({ landscape: true })
      } catch {
        showToast('Printing failed', 'error')
      } finally {
        setBusy(false)
      }
    } else {
      window.print()
    }
  }

  async function handlePDF() {
    if (busy) return
    if (window.scheduleAPI && window.scheduleAPI.exportPDF) {
      setBusy(true)
      try {
        const res = await window.scheduleAPI.exportPDF({ defaultName, landscape: true })
        if (res && res.ok) {
          showToast('PDF saved')
        } else if (res && res.canceled) {
          // user dismissed the save dialog — no message
        } else {
          showToast('Could not save PDF' + (res && res.error ? `: ${res.error}` : ''), 'error')
        }
      } catch {
        showToast('Could not save PDF', 'error')
      } finally {
        setBusy(false)
      }
    } else {
      // Browser / dev fallback: the system print dialog offers "Save as PDF".
      showToast('Choose “Save as PDF” in the print dialog', 'info')
      window.print()
    }
  }

  const empty = items.length === 0

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900/70 print:static print:z-auto print:bg-white">
      {/* Toolbar (never printed) */}
      <div className="no-print flex items-center justify-between gap-3 border-b border-green-950 bg-green-900 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="print" className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="text-xs text-green-200">Preview · colors print exactly as shown</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" icon="print" onClick={handlePrint} disabled={busy || empty}>
            Print
          </Button>
          <Button variant="primary" icon="download" onClick={handlePDF} disabled={busy || empty}>
            Save as PDF
          </Button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-green-100 transition-colors hover:bg-white/10"
          >
            <Icon name="close" className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {/* Scrollable preview / print area */}
      <div className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
        {empty ? (
          <div className="mx-auto max-w-md rounded-lg bg-white p-8 text-center text-sm text-slate-500">
            Nothing to print yet.
          </div>
        ) : (
          <div className="print-area mx-auto max-w-5xl print:max-w-none">
            {items.map((it) => (
              <div
                key={it.key}
                className="page-break mb-6 rounded bg-white p-5 shadow-sm print:mb-0 print:rounded-none print:p-0 print:shadow-none"
              >
                {it.node}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
