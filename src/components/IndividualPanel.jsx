import React, { useMemo, useState } from 'react'
import { useStore, formatTeacherName, teacherLoad, computeConflicts, hasSemesteredSchedules, SEMESTERS } from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, EmptyState, Badge, Icon } from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'
import IndividualTable from './IndividualTable.jsx'

export default function IndividualPanel() {
  const { state } = useStore()
  const { openPrint } = useUI()
  const conflicts = useMemo(() => computeConflicts(state.schedules), [state.schedules])
  // Show a semester switch only when some section actually runs on semesters
  // (Senior High). A pure K–10 school never sees it and prints all-year grids.
  const semestered = useMemo(() => hasSemesteredSchedules(state.schedules), [state.schedules])
  const [semester, setSemester] = useState('1')
  const activeSem = semestered ? semester : ''

  const teachers = useMemo(
    () => [...state.teachers].sort((a, b) => formatTeacherName(a).localeCompare(formatTeacherName(b))),
    [state.teachers]
  )
  const [selectedId, setSelectedId] = useState(teachers[0]?.id || null)

  const selected = teachers.find((t) => t.id === selectedId) || teachers[0] || null

  if (state.teachers.length === 0) {
    return (
      <div>
        <PageHeader title="Teacher Schedules" subtitle="Each teacher's personal weekly program, built automatically from your class schedules." />
        <EmptyState icon="users" title="No teachers yet" message="Add teachers and assign them to subjects — their individual schedules will appear here automatically." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Teacher Schedules"
        subtitle="Generated automatically from every class schedule — no extra data entry. Print one or all."
        action={<Button variant="primary" icon="print" onClick={() => openPrint({ type: 'individual-all', semester: activeSem })}>Print all teachers</Button>}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Teacher list */}
        <aside className="w-full shrink-0 lg:w-64">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teachers
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {teachers.map((t) => {
                const load = teacherLoad(t.id, state.schedules)
                const active = selected && selected.id === t.id
                const hasConflict = conflicts.teacherIds.has(t.id)
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-0 ${
                      active ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-medium ${active ? 'text-green-800' : 'text-slate-700'}`}>
                        {formatTeacherName(t)}
                      </div>
                      <div className="text-xs text-slate-400">{load} {load === 1 ? 'period' : 'periods'}/wk</div>
                    </div>
                    {hasConflict ? <Icon name="warning" className="h-4 w-4 text-amber-500" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Selected teacher schedule */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-800">{formatTeacherName(selected)}</h2>
                  <Badge tone={selected.role === 'Moderator' ? 'green' : 'slate'}>{selected.role}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {/* Semester switch — only when the school runs semestered (SHS) sections */}
                  {semestered && (
                    <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                      {SEMESTERS.map((sem) => (
                        <button
                          key={sem.id}
                          onClick={() => setSemester(sem.id)}
                          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                            semester === sem.id ? 'bg-green-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {sem.short}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button size="sm" icon="print" onClick={() => openPrint({ type: 'individual', teacherId: selected.id, semester: activeSem })}>
                    Print / Save PDF
                  </Button>
                </div>
              </div>
              {state.schedules.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
                  No class schedules yet. Once you assign this teacher to subjects, their weekly program will appear here.
                </p>
              ) : (
                <IndividualTable teacherId={selected.id} semester={activeSem} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
