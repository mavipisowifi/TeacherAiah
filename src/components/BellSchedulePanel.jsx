import React, { useEffect, useMemo, useState } from 'react'
import {
  useStore,
  GRADE_LEVELS,
  GRADE_CATEGORIES,
  gradeOptionGroups,
  categoryForGrade,
  DEFAULT_BELL,
  normalizeBell,
  bellForGrade,
  buildAutoTimeSlots,
  fridayOverrides,
  BAND_DEFAULT_LABEL,
} from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, Field, TextInput, Select, Badge, Icon } from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'

/* ============================================================
   BellSchedulePanel — "Schedule Times" tab.
   Lets the user set, per grade level, the start time and the
   length of Homeroom, each class period, Recess, Lunch, and
   Dismissal. Whatever is saved here is exactly what the
   auto-generator uses to lay out that grade's timetable.
   ============================================================ */

// A labeled number input that keeps its own string value so the field can be
// cleared while typing; the store clamps everything on save anyway.
function NumberField({ label, hint, value, onChange, min = 0, max = 240, suffix }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <TextInput
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[7rem]"
        />
        {suffix ? <span className="text-xs text-slate-500">{suffix}</span> : null}
      </div>
    </Field>
  )
}

export default function BellSchedulePanel() {
  const { state, setBellSchedule } = useStore()
  const { showToast } = useUI()

  const [grade, setGrade] = useState(() => {
    const custom = Object.keys((state.settings && state.settings.bellSchedules) || {})
    return custom[0] || GRADE_LEVELS[0]
  })
  const [form, setForm] = useState(() => bellForGrade(state, grade))

  // Reseed the editor whenever the selected grade changes. Switching grades
  // discards unsaved edits (expected — each grade is edited then saved).
  useEffect(() => {
    setForm(bellForGrade(state, grade))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade])

  const bellMap = (state.settings && state.settings.bellSchedules) || {}
  const customGrades = useMemo(
    () => GRADE_LEVELS.filter((g) => bellMap[g]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.settings]
  )

  const nb = useMemo(() => normalizeBell(form), [form])
  const savedNb = useMemo(() => bellForGrade(state, grade), [state, grade])
  const isCustom = !!bellMap[grade]
  const dirty = JSON.stringify(nb) !== JSON.stringify(savedNb)

  const slots = useMemo(() => buildAutoTimeSlots(form), [form])
  // Friday-only overrides for the preview (null unless a toggle is on).
  const friPreview = useMemo(() => fridayOverrides(nb, slots), [nb, slots])
  const fri = nb.friday || {}

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }))
  // Update a nested Friday field, leaving the rest of the bell untouched.
  const setFri = (key) => (val) => setForm((f) => ({ ...f, friday: { ...(f.friday || {}), [key]: val } }))

  function save() {
    setBellSchedule(grade, nb)
    showToast(`Saved schedule times for ${grade}`)
  }

  function resetToDefault() {
    setBellSchedule(grade, null)
    setForm(normalizeBell(DEFAULT_BELL))
    showToast(`${grade} reset to the default times`)
  }

  function applyTo(targets, label) {
    const clean = normalizeBell(form)
    for (const g of targets) setBellSchedule(g, clean)
    showToast(`Applied these times to ${label}`)
  }

  const cat = categoryForGrade(grade)
  // Period-number labels for the preview (class rows are numbered in order).
  let periodNo = 0

  return (
    <div>
      <PageHeader
        title="Schedule Times"
        subtitle="Set the daily bell schedule for each grade level — the start time and how long Homeroom, each class period, Recess, Lunch, and Dismissal last. Generated timetables for that grade use exactly these times."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Grade level" className="w-64">
          <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {gradeOptionGroups().map((grp) => (
              <optgroup key={grp.label} label={grp.label}>
                {grp.grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                    {bellMap[g] ? ' — custom' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Badge tone={isCustom ? 'green' : 'slate'}>
          {isCustom ? 'Custom times' : 'Using default times'}
        </Badge>
        {dirty ? <Badge tone="amber">Unsaved changes</Badge> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---- Editor ---- */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-bold text-slate-900">Times for {grade}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Set a break's length to 0 to remove it. Times use the school clock (e.g. <code>8:10</code> is morning,
              <code> 1:30</code> is afternoon).
            </p>
          </div>
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start time" hint="When Homeroom (or the first period) begins.">
                <TextInput
                  value={form.startTime}
                  onChange={(e) => set('startTime')(e.target.value)}
                  placeholder="8:10"
                  className="max-w-[7rem]"
                />
              </Field>
              <NumberField
                label="Homeroom length"
                value={form.homeroomMin}
                onChange={set('homeroomMin')}
                min={0}
                max={120}
                suffix="min"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Class periods"
                hint="How many teaching periods per day."
                value={form.periods}
                onChange={set('periods')}
                min={1}
                max={12}
                suffix="periods"
              />
              <NumberField
                label="Period length"
                value={form.periodMin}
                onChange={set('periodMin')}
                min={20}
                max={180}
                suffix="min"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Recess after period" hint="0 = no recess.">
                <Select value={String(nb.recessAfter)} onChange={(e) => set('recessAfter')(e.target.value)}>
                  <option value="0">No recess</option>
                  {Array.from({ length: nb.periods }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>After period {p}</option>
                  ))}
                </Select>
              </Field>
              <NumberField
                label="Recess length"
                value={form.recessMin}
                onChange={set('recessMin')}
                min={0}
                max={120}
                suffix="min"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Lunch after period" hint="0 = no lunch break.">
                <Select value={String(nb.lunchAfter)} onChange={(e) => set('lunchAfter')(e.target.value)}>
                  <option value="0">No lunch</option>
                  {Array.from({ length: nb.periods }, (_, i) => i + 1).map((p) => (
                    <option key={p} value={p}>After period {p}</option>
                  ))}
                </Select>
              </Field>
              <NumberField
                label="Lunch length"
                value={form.lunchMin}
                onChange={set('lunchMin')}
                min={0}
                max={120}
                suffix="min"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Dismissal length"
                hint="A short closing band at the end of the day. 0 = none."
                value={form.dismissalMin}
                onChange={set('dismissalMin')}
                min={0}
                max={120}
                suffix="min"
              />
            </div>

            {/* ---- Friday only (optional) ---- */}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Friday only
                </p>
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  Optional
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Special Friday tweaks for this grade — leave both off and Friday matches the other days.
                Monday–Thursday are never affected.
              </p>

              {/* Activity period */}
              <div className="mt-3 border-t border-slate-200 pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!fri.activityEnabled}
                    onChange={(e) => setFri('activityEnabled')(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-400"
                  />
                  Activity period (no class — e.g. club meetings)
                </label>
                {fri.activityEnabled ? (
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Field label="Label" hint="Shown in the Friday cell.">
                      <TextInput
                        value={fri.activityLabel}
                        onChange={(e) => setFri('activityLabel')(e.target.value)}
                        placeholder="Activity Period"
                      />
                    </Field>
                    <Field label="Starts at" hint="School clock (1:30 = PM).">
                      <TextInput
                        value={fri.activityStart}
                        onChange={(e) => setFri('activityStart')(e.target.value)}
                        placeholder="1:30"
                        className="max-w-[7rem]"
                      />
                    </Field>
                    <NumberField
                      label="Length"
                      value={fri.activityMin}
                      onChange={setFri('activityMin')}
                      min={15}
                      max={180}
                      suffix="min"
                    />
                  </div>
                ) : null}
              </div>

              {/* Early dismissal */}
              <div className="mt-3 border-t border-slate-200 pt-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!fri.dismissalEnabled}
                    onChange={(e) => setFri('dismissalEnabled')(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-400"
                  />
                  Early dismissal (Friday ends early)
                </label>
                {fri.dismissalEnabled ? (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <Field label="Dismissed at" hint="No class is scheduled at/after this time on Friday.">
                      <TextInput
                        value={fri.dismissalTime}
                        onChange={(e) => setFri('dismissalTime')(e.target.value)}
                        placeholder="2:30"
                        className="max-w-[7rem]"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <Button variant="primary" icon="check" onClick={save} disabled={!dirty}>
                Save times
              </Button>
              <Button variant="secondary" icon="close" onClick={resetToDefault} disabled={!isCustom}>
                Reset to default
              </Button>
            </div>

            {/* Copy to other grades */}
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Copy these times to…
              </p>
              <div className="flex flex-wrap gap-2">
                {cat ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="copy"
                    onClick={() => applyTo(cat.grades.filter((g) => GRADE_LEVELS.includes(g)), cat.name)}
                  >
                    All of {cat.name}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  icon="copy"
                  onClick={() => applyTo(GRADE_LEVELS, 'every grade level')}
                >
                  Every grade level
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Handy when a whole department shares one bell schedule — set it once, then copy.
              </p>
            </div>
          </div>
        </div>

        {/* ---- Live preview ---- */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-bold text-slate-900">Daily preview</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              How each day is divided for {grade}. This is the exact time column used when generating a schedule.
            </p>
          </div>
          <div className="p-4">
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <tbody>
                  {slots.map((s) => {
                    const isClass = s.kind === 'class'
                    if (isClass) periodNo += 1
                    const label = isClass
                      ? `Period ${periodNo}`
                      : s.label || BAND_DEFAULT_LABEL[s.kind] || s.kind
                    return (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0">
                        <td className="w-32 whitespace-nowrap px-3 py-2 font-medium text-slate-600">{s.time}</td>
                        <td className="px-3 py-2">
                          {isClass ? (
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span className="text-slate-800">{label}</span>
                              {friPreview && friPreview.activity[s.id] ? (
                                <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800">
                                  Fri: {friPreview.activityLabel}
                                </span>
                              ) : null}
                              {friPreview && friPreview.dismissed[s.id] ? (
                                <span className="inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  Fri: dismissed
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-green-800">
                              {label}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {nb.periods} class {nb.periods === 1 ? 'period' : 'periods'} · ends at{' '}
              {slots.length ? slots[slots.length - 1].time.split('-')[1] : '—'}
            </p>
            {friPreview ? (
              <p className="mt-1 text-xs font-medium text-green-700">
                Friday:{' '}
                {fri.activityEnabled ? `${fri.activityLabel} at ${fri.activityStart}` : ''}
                {fri.activityEnabled && fri.dismissalEnabled ? ' · ' : ''}
                {fri.dismissalEnabled ? `early dismissal at ${fri.dismissalTime}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Grades with custom overrides */}
      {customGrades.length > 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Grades with custom times</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {customGrades.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  g === grade
                    ? 'border-green-300 bg-green-100 text-green-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            All other grades use the default times ({DEFAULT_BELL.periods} periods from {DEFAULT_BELL.startTime}).
          </p>
        </div>
      ) : null}
    </div>
  )
}
