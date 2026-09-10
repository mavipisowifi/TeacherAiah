import React from 'react'
import { useStore, THEMES, THEME_FIELDS, effectiveTheme, pickTextColor } from '../store.jsx'
import { useUI } from '../appContext.jsx'
import { Button, Card, Icon } from './ui.jsx'
import { PageHeader } from './TeachersPanel.jsx'
import logoUrl from '../assets/logo.png'

// App version, injected from package.json at build time (see vite.config.mjs).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

function MiniPreview({ theme }) {
  const cellBorder = `1px solid ${theme.border}`
  const sample = [
    { t: '8:10-8:30', band: 'HOMEROOM TIME' },
    { t: '8:30-9:30', subj: 'GEN. MATH', color: '#166534' },
    { t: '9:30-10:30', subj: 'GEN. SCI.', color: '#1d4ed8' },
    { t: '10:30-10:45', band: 'RECESS' },
  ]
  return (
    <table className="w-full border-collapse text-[9px]" style={{ tableLayout: 'fixed', border: cellBorder }}>
      <tbody>
        <tr>
          <td colSpan={3} style={{ background: theme.title, color: theme.onDark, border: cellBorder }} className="py-1 text-center font-bold">
            GRADE 11
          </td>
        </tr>
        <tr>
          <td colSpan={3} style={{ background: theme.section, color: theme.onDark, border: cellBorder }} className="py-0.5 text-center font-semibold">
            DIAMOND
          </td>
        </tr>
        <tr>
          <td style={{ background: theme.header, color: theme.onDark, border: cellBorder }} className="py-0.5 text-center font-bold">TIME</td>
          <td style={{ background: theme.header, color: theme.onDark, border: cellBorder }} className="py-0.5 text-center font-bold">MON</td>
          <td style={{ background: theme.header, color: theme.onDark, border: cellBorder }} className="py-0.5 text-center font-bold">TUE</td>
        </tr>
        {sample.map((r, i) => (
          <tr key={i}>
            <td style={{ background: theme.timeCol, color: theme.onTime, border: cellBorder }} className="py-0.5 text-center font-semibold">{r.t}</td>
            {r.band ? (
              <td colSpan={2} style={{ background: theme.band, color: theme.onBand, border: cellBorder }} className="py-0.5 text-center font-bold">{r.band}</td>
            ) : (
              <>
                <td style={{ background: r.color, color: pickTextColor(r.color), border: cellBorder }} className="py-0.5 text-center font-bold">{r.subj}</td>
                <td style={{ background: r.color, color: pickTextColor(r.color), border: cellBorder }} className="py-0.5 text-center font-bold">{r.subj}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function AppearancePanel() {
  const { state, setThemeKey, setCustomTheme, clearCustomTheme, setSetting, importData, resetAll } = useStore()
  const { showToast } = useUI()

  const current = effectiveTheme(state)
  const isCustom = !!state.customTheme

  function editField(key, value) {
    setCustomTheme({ ...current, [key]: value })
  }

  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `class-schedules-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showToast('Backup exported')
    } catch {
      showToast('Export failed', 'error')
    }
  }

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const known = ['teachers', 'schedules', 'rooms', 'subjects']
        if (!data || typeof data !== 'object' || !known.some((k) => Array.isArray(data[k]))) {
          throw new Error('bad format')
        }
        if (!window.confirm('Importing will replace all current rooms, teachers, subjects, and schedules. Continue?')) return
        importData(data)
        showToast('Data imported')
      } catch {
        showToast('Could not read that backup file', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function reset() {
    if (window.confirm('Erase all rooms, teachers, subjects, and schedules? This cannot be undone.')) {
      resetAll()
      showToast('All data cleared')
    }
  }

  return (
    <div>
      <PageHeader title="Appearance & Data" subtitle="Choose the color scheme for printed schedules, and back up or restore your data." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="Color scheme"
            actions={isCustom ? <Button size="sm" onClick={clearCustomTheme}>Reset to preset</Button> : null}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(THEMES).map(([key, th]) => {
                const active = !isCustom && state.themeKey === key
                return (
                  <button
                    key={key}
                    onClick={() => setThemeKey(key)}
                    className={`rounded-lg border p-1.5 text-left transition-colors ${
                      active ? 'border-green-600 ring-2 ring-green-200' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="overflow-hidden rounded">
                      <MiniPreview theme={th} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between px-0.5">
                      <span className="text-xs font-semibold text-slate-700">{th.name}</span>
                      {active ? <Icon name="check" className="h-3.5 w-3.5 text-green-600" /> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card title="Customize colors" >
            <p className="mb-3 text-xs text-slate-500">
              Fine-tune any part of the schedule. Solid colors only — no gradients. Editing here creates a custom scheme.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEME_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2">
                  <input
                    type="color"
                    value={current[f.key]}
                    onChange={(e) => editField(f.key, e.target.value)}
                    className="h-7 w-9 shrink-0"
                  />
                  <span className="text-xs text-slate-600">{f.label}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Printing options">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={state.settings.showTeacherInCell}
                onChange={(e) => setSetting('showTeacherInCell', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-green-700 focus:ring-green-400"
              />
              Show teacher names inside subject cells
            </label>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Live preview">
            <div className="rounded border border-slate-200 p-2">
              <MiniPreview theme={current} />
            </div>
            <p className="mt-2 text-xs text-slate-400">This is how the printed schedule header and bands will look.</p>
          </Card>

          <Card title="Backup & restore">
            <div className="space-y-2">
              <Button icon="download" className="w-full justify-start" onClick={exportData}>Export all data (.json)</Button>
              <label className="block">
                <span className="sr-only">Import data</span>
                <input type="file" accept="application/json,.json" onChange={onImportFile} className="hidden" id="import-file" />
                <Button icon="upload" className="w-full justify-start" onClick={() => document.getElementById('import-file').click()}>
                  Import from backup
                </Button>
              </label>
              <Button variant="danger" icon="trash" className="w-full justify-start" onClick={reset}>Clear all data</Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Your data is saved on this computer automatically. Use export to back it up or move it to another PC.
            </p>
          </Card>

          <Card title="About">
            <div className="flex items-start gap-3">
              <img src={logoUrl} alt="TEACHERaiah logo" className="h-12 w-12 shrink-0 rounded-md object-contain" />
              <div className="min-w-0">
                <div className="text-base font-extrabold leading-tight tracking-tight text-slate-800">
                  TEACHER<span className="text-green-600">aiah</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Class schedule maker · Version {APP_VERSION}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Developer:</span> Marvin T. Bangcailan
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a className="font-medium text-green-700 hover:underline" href="https://github.com/mavipisowifi/TeacherAiah" target="_blank" rel="noreferrer">GitHub repository</a>
              <a className="font-medium text-green-700 hover:underline" href="https://github.com/mavipisowifi" target="_blank" rel="noreferrer">GitHub</a>
              <a className="font-medium text-green-700 hover:underline" href="https://www.linkedin.com/in/marvin-bangcailan-a519582ab/" target="_blank" rel="noreferrer">LinkedIn</a>
            </div>

            <p className="mt-4 rounded-md border border-green-100 bg-green-50 px-3 py-2.5 text-xs leading-relaxed text-green-900">
              <span className="font-semibold">Free for all teachers all over the Philippines.</span> Built to lighten your load so you can focus on what matters most — your students. <span className="italic">Salamat sa inyong walang sawang paglilingkod!</span>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
