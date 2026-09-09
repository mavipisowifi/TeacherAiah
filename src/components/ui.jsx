import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/* ---------- Icons (inline SVG, no external dependency) ---------- */

export function Icon({ name, className = 'w-4 h-4' }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    warning: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    up: <path d="m18 15-6-6-6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    palette: (
      <>
        <circle cx="13.5" cy="6.5" r=".5" />
        <circle cx="17.5" cy="10.5" r=".5" />
        <circle cx="8.5" cy="7.5" r=".5" />
        <circle cx="6.5" cy="12.5" r=".5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8M7 3v5h8" />
      </>
    ),
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8l-5-5-5 5" />
        <path d="M12 3v12" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  }
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  )
}

/* ---------- Buttons ---------- */

const BTN_VARIANTS = {
  primary:
    'bg-green-700 text-white border border-green-700 hover:bg-green-800 hover:border-green-800 focus-visible:ring-green-400',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-green-400',
  danger:
    'bg-white text-red-700 border border-red-300 hover:bg-red-50 focus-visible:ring-red-400',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 focus-visible:ring-green-400',
  dark: 'bg-green-900 text-white border border-green-900 hover:bg-green-950 focus-visible:ring-green-400',
  warn:
    'bg-amber-500 text-white border border-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400',
}

export function Button({ variant = 'secondary', size = 'md', icon, children, className = '', ...props }) {
  const sizes = { sm: 'text-xs px-2.5 py-1.5 gap-1.5', md: 'text-sm px-3.5 py-2 gap-2', lg: 'text-base px-4 py-2.5 gap-2' }
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon ? <Icon name={icon} className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> : null}
      {children}
    </button>
  )
}

export function IconButton({ icon, title, variant = 'ghost', className = '', ...props }) {
  return (
    <button
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:opacity-40 ${BTN_VARIANTS[variant]}`}
      {...props}
    >
      <Icon name={icon} className={className || 'w-4 h-4'} />
    </button>
  )
}

/* ---------- Checkbox ---------- */

// A plain checkbox styled to match the app's green accent — used for the
// bulk-select ticks on list rows and cards.
export function Checkbox({ className = '', ...props }) {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 cursor-pointer rounded border-slate-300 text-green-700 focus:ring-green-400 ${className}`}
      {...props}
    />
  )
}

/* ---------- Bulk selection (multi-select + Clear all) ---------- */

// Shared state for "tick several rows, then delete them," plus a Clear-all.
// One hook drives every list that offers bulk delete (Subjects, Teachers,
// Rooms, Classrooms) so the behavior — enter select mode, toggle rows, select
// all / none, exit — is identical everywhere.
export function useSelection() {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const set = (ids) => setSelected(new Set(ids))
  const clear = () => setSelected(new Set())
  const start = () => setSelecting(true)
  // Leaving select mode always drops the current selection.
  const exit = () => {
    setSelecting(false)
    setSelected(new Set())
  }

  return {
    selecting,
    selected,
    count: selected.size,
    isSelected: (id) => selected.has(id),
    toggle,
    set,
    clear,
    start,
    exit,
  }
}

// Toolbar controls that pair with useSelection. Idle, it shows "Select" +
// "Clear all"; while selecting it swaps to a Select-all/none toggle, a live
// count, "Delete (N)", and Cancel. Layout-agnostic — each panel drops it into
// its own header/toolbar. Confirmation of the destructive actions is left to
// the caller (panels use window.confirm, matching their single-item deletes).
export function BulkActions({
  selecting,
  count,
  total,
  onStart,
  onCancel,
  onSelectAll,
  onDeleteSelected,
  onClearAll,
  clearAllLabel = 'Clear all',
  size = 'sm',
  disabled = false,
}) {
  if (selecting) {
    const allOn = total > 0 && count >= total
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size={size} onClick={onSelectAll} disabled={total === 0}>
          {allOn ? 'Select none' : 'Select all'}
        </Button>
        <span className="text-xs font-medium text-slate-500">{count} selected</span>
        <Button variant="danger" size={size} icon="trash" onClick={onDeleteSelected} disabled={count === 0}>
          Delete{count ? ` (${count})` : ''}
        </Button>
        <Button variant="secondary" size={size} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size={size} onClick={onStart} disabled={disabled}>
        Select
      </Button>
      <Button variant="danger" size={size} icon="trash" onClick={onClearAll} disabled={disabled}>
        {clearAllLabel}
      </Button>
    </div>
  )
}

/* ---------- Form fields ---------- */

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </span>
      ) : null}
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  )
}

const INPUT_CLS =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200'

export function TextInput({ className = '', ...props }) {
  return <input className={`${INPUT_CLS} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${INPUT_CLS} ${className}`} {...props}>
      {children}
    </select>
  )
}

/* ---------- Radio pills (segmented) ---------- */

export function Segmented({ options, value, onChange, name }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            name={name}
            onClick={() => onChange(opt.value)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-green-700 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Badge ---------- */

export function Badge({ tone = 'slate', children, className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ---------- Card ---------- */

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon = 'grid', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const dialogRef = useRef(null)

  // While open: close on Escape and lock background scroll. Cleanup restores both.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  // Deterministically focus the first field when the dialog opens. Portalled
  // dialogs make per-field `autoFocus` fire inconsistently ("the field looks
  // muted / can't type until I click it"); focusing here on the next frame,
  // once the portal is mounted, makes every modal's first field reliably active.
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      const el = dialogRef.current
      if (!el) return
      const first = el.querySelector('input, select, textarea')
      if (!first) return
      first.focus({ preventScroll: true })
      if (typeof first.select === 'function' && first.tagName === 'INPUT') {
        try {
          first.select()
        } catch {
          /* some input types don't support select() */
        }
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  // Rendered through a portal to <body> so the dialog can never be trapped,
  // clipped, or de-activated by an ancestor's stacking context, transform, or
  // overflow — a common cause of "the modal shows but its fields can't be
  // clicked." z-[80] keeps it above the toast (z-60) and print overlay (z-70).
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onMouseDown={(e) => {
        // Click on the dimmed area (not the dialog) closes.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={`relative w-full ${widths[size]} rounded-lg border border-slate-200 bg-white shadow-xl`}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <IconButton icon="close" title="Close" onClick={onClose} />
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  )
}

/* ---------- Toast ---------- */

export function Toast({ toast }) {
  if (!toast) return null
  const tones = {
    success: 'bg-green-700 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-800 text-white',
  }
  return (
    <div className="no-print fixed bottom-5 left-1/2 z-[60] -translate-x-1/2">
      <div className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium ${tones[toast.tone] || tones.info}`}>
        <Icon name={toast.tone === 'error' ? 'warning' : 'check'} className="h-4 w-4" />
        {toast.message}
      </div>
    </div>
  )
}
