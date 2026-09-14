import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useStore, useTertiary, computeConflicts } from './store.jsx'
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
import ConflictReport from './components/ConflictReport.jsx'
import TertiaryPanel from './components/TertiaryPanel.jsx'
import TertiaryProgramsPanel from './components/TertiaryPrograms.jsx'
import TertiaryCoursesPanel from './components/TertiaryCourses.jsx'
import TertiaryFacultyPanel from './components/TertiaryFaculty.jsx'
import TertiaryRoomsPanel from './components/TertiaryRooms.jsx'
import TertiaryBlocksPanel from './components/TertiaryBlocks.jsx'
import TertiarySchedulesPanel from './components/TertiarySchedules.jsx'
import { buildSampleK12State } from './sampleData.js'

// App version, injected from package.json at build time (see vite.config.mjs).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

// K–12 (basic education) tab set — unchanged by the tertiary work.
const TABS = [
  { key: 'subjects', label: 'Subjects', icon: 'book' },
  { key: 'teachers', label: 'Subject Teachers', icon: 'users' },
  { key: 'rooms', label: 'Grade Level Rooms', icon: 'calendar' },
  { key: 'times', label: 'Schedule Times', icon: 'clock' },
  { key: 'individual', label: 'Teacher Schedules', icon: 'grid' },
  { key: 'appearance', label: 'Appearance & Data', icon: 'palette' },
]

// Tertiary (college / university) tab set. Overview + the CRUD tabs
// (Programs → Courses → Faculty → Rooms → Blocks) plus the shared Appearance &
// Data panel. The schedule-generation tab is added in a following phase.
const TERTIARY_TABS = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'programs', label: 'Programs', icon: 'book' },
  { key: 'courses', label: 'Courses', icon: 'copy' },
  { key: 'faculty', label: 'Faculty', icon: 'users' },
  { key: 'rooms', label: 'Rooms', icon: 'calendar' },
  { key: 'blocks', label: 'Block Sections', icon: 'grid' },
  { key: 'schedules', label: 'Schedules', icon: 'clock' },
  { key: 'appearance', label: 'Appearance & Data', icon: 'palette' },
]

export default function App() {
  const { state, mode, setMode, importData, resetAll } = useStore()
  const { state: tState } = useTertiary()
  const isTertiary = mode === 'tertiary'

  // Each mode remembers its own active tab so switching back and forth is
  // seamless (and a tertiary tab key never leaks into the K–12 view).
  const [tabK12, setTabK12] = useState('subjects')
  const [tabTertiary, setTabTertiary] = useState('overview')
  const tab = isTertiary ? tabTertiary : tabK12
  const setTab = isTertiary ? setTabTertiary : setTabK12
  const tabs = isTertiary ? TERTIARY_TABS : TABS

  const [toast, setToast] = useState(null)
  const [printTarget, setPrintTarget] = useState(null)
  const [showConflicts, setShowConflicts] = useState(false)

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() })
  }, [])

  const openPrint = useCallback((target) => setPrintTarget(target), [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // Global demo-data hotkeys, active from anywhere in the app:
  //   Shift+F2 → load a RANDOM built-in sample school into K–12 (subjects,
  //              teachers, rooms, sections + generated three-term timetables).
  //              Every press rolls a fresh size — small, half, or full — so the
  //              data differs each time.
  //   Shift+F1 → clear all K–12 data
  // Loading replaces the whole K–12 slice and clearing wipes it, so both are
  // guarded with a confirm when there's data to lose, and both switch to K–12
  // mode so the effect is visible. Function keys double as OS/help keys, so we
  // preventDefault. Tertiary data is never touched — this matches the scope of
  // the Appearance tab's "Erase all data" (K–12 only).
  useEffect(() => {
    const onKey = (e) => {
      if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.key !== 'F1' && e.key !== 'F2') return
      const hasK12Data =
        state.subjects.length || state.teachers.length || state.rooms.length || state.schedules.length
      if (e.key === 'F2') {
        e.preventDefault()
        if (
          hasK12Data &&
          !window.confirm(
            'Load sample data?\n\nThis replaces all current K–12 subjects, teachers, rooms and sections with a randomly generated demo school. Tertiary data is not affected.'
          )
        )
          return
        const sampleState = buildSampleK12State()
        const gradeCount = new Set(sampleState.schedules.map((s) => s.gradeLevel)).size
        const label = sampleState.tier ? sampleState.tier[0].toUpperCase() + sampleState.tier.slice(1) : 'Sample'
        importData(sampleState)
        if (mode !== 'k12') setMode('k12')
        showToast(
          `${label} sample loaded — ${gradeCount} grade${gradeCount === 1 ? '' : 's'}, ${sampleState.schedules.length} sections, ${sampleState.subjects.length} subjects`
        )
      } else {
        e.preventDefault()
        if (!hasK12Data) {
          showToast('Nothing to clear', 'info')
          return
        }
        if (
          !window.confirm(
            'Clear ALL K–12 data?\n\nThis removes every subject, teacher, room and section, and cannot be undone. Tertiary data is not affected.'
          )
        )
          return
        resetAll()
        if (mode !== 'k12') setMode('k12')
        showToast('All K–12 data cleared')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, mode, importData, resetAll, setMode, showToast])

  // K–12 teacher-conflict count (shown in the K–12 footer only).
  const conflictCount = useMemo(() => computeConflicts(state.schedules).conflicts.length, [state.schedules])

  const ctx = useMemo(() => ({ showToast, openPrint }), [showToast, openPrint])

  // Nav badges. Each mode supplies counts for its own tab keys; keys that don't
  // apply resolve to undefined and simply render without a badge.
  const counts = isTertiary
    ? {
        overview: null,
        programs: tState.programs.length,
        courses: tState.courses.length,
        faculty: tState.faculty.length,
        rooms: tState.rooms.length,
        blocks: tState.blocks.length,
        schedules: null,
        appearance: null,
      }
    : {
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

          {/* Mode switch: K–12 (basic education) ⇄ Tertiary (college/university).
              The two systems keep entirely separate data; only the theme, print,
              and backup are shared. */}
          <div className="border-b border-slate-200 p-3">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Education level
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setMode('k12')}
                className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  isTertiary ? 'text-slate-600 hover:text-slate-900' : 'bg-green-700 text-white shadow-sm'
                }`}
              >
                K–12
              </button>
              <button
                onClick={() => setMode('tertiary')}
                className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  isTertiary ? 'bg-green-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tertiary
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {tabs.map((t) => {
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
            {isTertiary ? (
              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <Icon name="book" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>College &amp; university scheduling.</span>
              </div>
            ) : (
              <button
                onClick={() => setShowConflicts(true)}
                title="Check for teacher scheduling conflicts across every grade and section"
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  conflictCount > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                }`}
              >
                <Icon name={conflictCount > 0 ? 'warning' : 'check'} className="h-4 w-4 shrink-0" />
                <span className="flex-1">Check conflicts</span>
                {conflictCount > 0 ? (
                  <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {conflictCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600">clear</span>
                )}
              </button>
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
              {isTertiary ? (
                <>
                  {tab === 'overview' && <TertiaryPanel onNavigate={setTabTertiary} />}
                  {tab === 'programs' && <TertiaryProgramsPanel />}
                  {tab === 'courses' && <TertiaryCoursesPanel />}
                  {tab === 'faculty' && <TertiaryFacultyPanel />}
                  {tab === 'rooms' && <TertiaryRoomsPanel />}
                  {tab === 'blocks' && <TertiaryBlocksPanel />}
                  {tab === 'schedules' && <TertiarySchedulesPanel onNavigate={setTabTertiary} />}
                  {tab === 'appearance' && <AppearancePanel />}
                </>
              ) : (
                <>
                  {tab === 'rooms' && <RoomsPanel />}
                  {tab === 'teachers' && <TeachersPanel />}
                  {tab === 'subjects' && <SubjectsPanel />}
                  {tab === 'times' && <BellSchedulePanel />}
                  {tab === 'individual' && <IndividualPanel />}
                  {tab === 'appearance' && <AppearancePanel />}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {printTarget && <PrintPortal target={printTarget} onClose={() => setPrintTarget(null)} />}
      {showConflicts && !isTertiary && (
        <ConflictReport
          open
          onClose={() => setShowConflicts(false)}
          onNavigate={(t) => {
            setTabK12(t)
            setShowConflicts(false)
          }}
        />
      )}
      <Toast toast={toast} />
    </UIContext.Provider>
  )
}
