import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useStore, computeConflicts } from './store.jsx'
import { UIContext } from './appContext.jsx'
import { Icon, Toast } from './components/ui.jsx'
import logoUrl from './assets/logo.png'
import TeachersPanel from './components/TeachersPanel.jsx'
import SubjectsPanel from './components/SubjectsPanel.jsx'
import RoomsPanel from './components/RoomsPanel.jsx'
import BellSchedulePanel from './components/BellSchedulePanel.jsx'
import IndividualPanel from './components/IndividualPanel.jsx'
import AppearancePanel from './components/AppearancePanel.jsx'
import PrintPortal from './components/PrintPortal.jsx'

// App version, injected from package.json at build time (see vite.config.mjs).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

const TABS = [
  { key: 'subjects', label: 'Subjects', icon: 'book' },
  { key: 'teachers', label: 'Subject Teachers', icon: 'users' },
  { key: 'rooms', label: 'Grade Level Rooms', icon: 'calendar' },
  { key: 'times', label: 'Schedule Times', icon: 'clock' },
  { key: 'individual', label: 'Teacher Schedules', icon: 'grid' },
  { key: 'appearance', label: 'Appearance & Data', icon: 'palette' },
]

export default function App() {
  const { state } = useStore()
  const [tab, setTab] = useState('subjects')
  const [toast, setToast] = useState(null)
  const [printTarget, setPrintTarget] = useState(null)

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() })
  }, [])

  const openPrint = useCallback((target) => setPrintTarget(target), [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const conflictCount = useMemo(() => computeConflicts(state.schedules).conflicts.length, [state.schedules])

  const ctx = useMemo(() => ({ showToast, openPrint }), [showToast, openPrint])

  const counts = {
    rooms: state.rooms.length,
    teachers: state.teachers.length,
    subjects: state.subjects.length,
    times: Object.keys((state.settings && state.settings.bellSchedules) || {}).length,
    individual: state.teachers.length,
    appearance: null,
  }

  return (
    <UIContext.Provider value={ctx}>
      <div className="app-shell flex h-screen overflow-hidden bg-[#f1f5f4] print:hidden">
        {/* Sidebar */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-green-800 px-4 py-4">
            <img
              src={logoUrl}
              alt="TEACHERaiah logo"
              className="h-9 w-9 shrink-0 rounded-md object-contain"
            />
            <div className="leading-tight">
              <div className="text-base font-extrabold tracking-tight text-white">
                TEACHER<span className="text-green-300">aiah</span>
              </div>
              <div className="text-[11px] text-green-100">Class schedule maker</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-green-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon name={t.icon} className="h-4 w-4" />
                  <span className="flex-1 text-left">{t.label}</span>
                  {counts[t.key] != null && counts[t.key] > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {counts[t.key]}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          <div className="border-t border-slate-200 p-3">
            {conflictCount > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {conflictCount} scheduling {conflictCount === 1 ? 'conflict' : 'conflicts'} detected. Open a
                  classroom to review.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                <Icon name="check" className="h-4 w-4 shrink-0" />
                <span>No teacher conflicts.</span>
              </div>
            )}
            <div className="mt-2 text-center text-[10px] font-medium tracking-wide text-slate-400">
              TEACHERaiah v{APP_VERSION}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-6">
              {tab === 'rooms' && <RoomsPanel />}
              {tab === 'teachers' && <TeachersPanel />}
              {tab === 'subjects' && <SubjectsPanel />}
              {tab === 'times' && <BellSchedulePanel />}
              {tab === 'individual' && <IndividualPanel />}
              {tab === 'appearance' && <AppearancePanel />}
            </div>
          </div>
        </main>
      </div>

      {printTarget && <PrintPortal target={printTarget} onClose={() => setPrintTarget(null)} />}
      <Toast toast={toast} />
    </UIContext.Provider>
  )
}
