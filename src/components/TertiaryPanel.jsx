import React from 'react'
import { useTertiary } from '../store.jsx'
import { TERTIARY_TERMS, YEAR_LEVELS } from '../tertiary.js'
import { Icon, Card, Badge } from './ui.jsx'

// Tertiary (college / university) landing view.
//
// Proves the mode switch + the dedicated tertiary store are wired end-to-end
// (the counts read live from useTertiary()), explains how tertiary scheduling
// differs from K–12, and acts as a launchpad: the stat tiles and setup steps
// navigate to the matching tab via onNavigate. The final step (schedule
// generation) is still upcoming and marked as such.
export default function TertiaryPanel({ onNavigate }) {
  const { state } = useTertiary()
  const go = (key) => (typeof onNavigate === 'function' ? () => onNavigate(key) : undefined)

  const stats = [
    { tab: 'programs', label: 'Programs', icon: 'book', n: state.programs.length },
    { tab: 'courses', label: 'Courses', icon: 'copy', n: state.courses.length },
    { tab: 'faculty', label: 'Faculty', icon: 'users', n: state.faculty.length },
    { tab: 'rooms', label: 'Rooms', icon: 'calendar', n: state.rooms.length },
    { tab: 'blocks', label: 'Block sections', icon: 'grid', n: state.blocks.length },
  ]

  const steps = [
    {
      tab: 'programs',
      title: 'Programs & curriculum',
      body: 'Add each degree program (e.g. BSIT, BSED) and its number of year levels.',
    },
    {
      tab: 'courses',
      title: 'Courses',
      body: 'Course code & title, program, year level, term, plus units and lecture / laboratory hours that drive how each course is placed.',
    },
    {
      tab: 'faculty',
      title: 'Faculty',
      body: 'Instructors and the courses they can teach — a course can be shared, and the generator spreads the load across them.',
    },
    {
      tab: 'rooms',
      title: 'Rooms',
      body: 'Lecture rooms and laboratories; the generator keeps labs in lab rooms and never double-books a room.',
    },
    {
      tab: 'blocks',
      title: 'Block sections',
      body: 'Group a year level into blocks (e.g. BSIT 1-A) that take a set of courses together — the tertiary equivalent of a class.',
    },
    {
      tab: 'schedules',
      title: 'Generate & fine-tune schedules',
      body: 'One-click timetables using MWF / TTh patterns within your day window, then hand-edit any meeting. Faculty loads and clash detection included.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Icon name="book" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Tertiary scheduling</h2>
              <Badge tone="green">College &amp; university</Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              You&apos;re in <span className="font-semibold text-slate-800">Tertiary</span> mode. This is a
              separate scheduling system for colleges and universities — programs, courses, faculty, rooms and
              block sections — kept completely apart from your K–12 data. Switch back any time with the{' '}
              <span className="font-semibold text-slate-800">K–12</span> button in the sidebar; nothing here
              touches your basic-education schedules, and vice-versa. The app theme, printing, and backups are
              shared across both.
            </p>
          </div>
        </div>
      </Card>

      {/* Live counts (read from the tertiary store) — click to jump to a tab */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={go(s.tab)}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-green-300 hover:bg-green-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <Icon name={s.icon} className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-bold text-slate-800">{s.n}</div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* How it differs + setup steps */}
      <Card title="Setup workflow">
        <p className="mb-4 text-sm text-slate-600">
          Tertiary schedules work differently from K–12: instead of a fixed daily bell of equal periods, courses
          meet on day patterns like <span className="font-medium text-slate-800">MWF</span> or{' '}
          <span className="font-medium text-slate-800">TTh</span>, with session lengths derived from each
          course&apos;s lecture and lab hours. Terms are{' '}
          {TERTIARY_TERMS.map((t) => t.short).join(', ')}, and year levels run{' '}
          {YEAR_LEVELS[0]}–{YEAR_LEVELS[YEAR_LEVELS.length - 1]}.
        </p>
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const clickable = step.tab && typeof onNavigate === 'function'
            const Tag = clickable ? 'button' : 'div'
            return (
              <li key={step.title}>
                <Tag
                  {...(clickable ? { type: 'button', onClick: go(step.tab) } : {})}
                  className={`flex w-full gap-3 rounded-md border border-transparent px-2 py-2 text-left ${
                    clickable
                      ? 'transition-colors hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400'
                      : ''
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      step.soon ? 'bg-slate-200 text-slate-500' : 'bg-green-700 text-white'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{step.title}</span>
                      {step.soon ? <Badge tone="amber">Coming soon</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{step.body}</p>
                  </div>
                </Tag>
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
