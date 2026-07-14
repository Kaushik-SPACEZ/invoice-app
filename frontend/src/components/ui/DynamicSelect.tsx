import { useState, useRef, useEffect } from 'react'
import { Check, Plus, X, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import client from '../../api/client'

interface Option {
  value: string
  label: string
  color?: string
}

interface DynamicSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  settingsKey: string      // key to persist custom options in /settings
  placeholder?: string
  className?: string
  chipStyle?: boolean      // render as chips (like platform selector) vs dropdown
}

// Cache custom options per settingsKey to avoid re-fetching
const optionsCache: Record<string, Option[]> = {}

export function DynamicSelect({
  value, onChange, options: defaultOptions, settingsKey, placeholder = 'Select…', className, chipStyle
}: DynamicSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [customOptions, setCustomOptions] = useState<Option[]>(optionsCache[settingsKey] ?? [])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const allOptions = [...defaultOptions, ...customOptions]
  const filtered = query
    ? allOptions.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : allOptions

  const selected = allOptions.find(o => o.value === value)
  const canAdd = query.trim().length > 0 && !allOptions.some(o => o.label.toLowerCase() === query.trim().toLowerCase())

  // Load custom options from server on mount
  useEffect(() => {
    if (optionsCache[settingsKey]) return
    client.get('/settings').then(r => {
      const stored = r.data?.data?.[settingsKey]
      if (stored) {
        try {
          const parsed: Option[] = JSON.parse(stored)
          setCustomOptions(parsed)
          optionsCache[settingsKey] = parsed
        } catch {}
      }
    }).catch(() => {})
  }, [settingsKey])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addOption = async (label: string) => {
    const newValue = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const newOption: Option = { value: newValue, label: label.trim() }
    const updated = [...customOptions, newOption]
    setCustomOptions(updated)
    optionsCache[settingsKey] = updated
    onChange(newValue)
    setQuery('')
    setOpen(false)
    // Persist to backend
    setSaving(true)
    try {
      await client.put('/settings', { [settingsKey]: JSON.stringify(updated) })
    } catch {}
    setSaving(false)
  }

  const removeCustomOption = async (optValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = customOptions.filter(o => o.value !== optValue)
    setCustomOptions(updated)
    optionsCache[settingsKey] = updated
    if (value === optValue) onChange(defaultOptions[0]?.value ?? '')
    try { await client.put('/settings', { [settingsKey]: JSON.stringify(updated) }) } catch {}
  }

  // ── CHIP STYLE (platform selector) ────────────────────────────────────────
  if (chipStyle) {
    return (
      <div className={className}>
        <div className="flex flex-wrap gap-2 items-center">
          {allOptions.map(opt => (
            <div key={opt.value} className="relative group">
              <button
                type="button"
                onClick={() => onChange(opt.value)}
                className={cn(
                  'text-sm px-4 py-1.5 rounded-full border font-medium transition-colors',
                  value === opt.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'
                )}
                style={value === opt.value && opt.color ? { background: opt.color, borderColor: opt.color } : {}}
              >
                {opt.label}
              </button>
              {customOptions.some(c => c.value === opt.value) && (
                <button
                  type="button"
                  onClick={(e) => removeCustomOption(opt.value, e)}
                  className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 bg-red-500 rounded-full items-center justify-center text-white"
                >
                  <X size={8} />
                </button>
              )}
            </div>
          ))}

          {/* Add new */}
          <div ref={containerRef} className="relative">
            {open ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && query.trim()) { e.preventDefault(); addOption(query.trim()) }
                    if (e.key === 'Escape') { setOpen(false); setQuery('') }
                  }}
                  placeholder="Type & Enter"
                  className="text-xs px-2 py-1.5 border border-blue-400 rounded-full w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button type="button" onClick={() => { setOpen(false); setQuery('') }} className="text-slate-400 hover:text-slate-600">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-sm px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 flex items-center gap-1"
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── DROPDOWN STYLE ────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => { setOpen(p => !p); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-slate-800 text-left flex items-center justify-between focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="px-2 pt-2 pb-1 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (canAdd) { addOption(query.trim()); return }
                  if (filtered.length > 0) { onChange(filtered[0].value); setOpen(false); setQuery('') }
                }
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
              }}
              placeholder="Search or type to add new…"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Options list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(opt => (
              <div
                key={opt.value}
                className="flex items-center justify-between px-3 py-2 hover:bg-blue-50 cursor-pointer group"
                onClick={() => { onChange(opt.value); setOpen(false); setQuery('') }}
              >
                <div className="flex items-center gap-2">
                  {opt.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />}
                  <span className="text-sm text-slate-700">{opt.label}</span>
                  {customOptions.some(c => c.value === opt.value) && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded">custom</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {value === opt.value && <Check size={13} className="text-blue-600" />}
                  {customOptions.some(c => c.value === opt.value) && (
                    <button
                      type="button"
                      onClick={(e) => removeCustomOption(opt.value, e)}
                      className="hidden group-hover:flex text-red-400 hover:text-red-600 p-0.5"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Add new option */}
            {canAdd && (
              <div
                className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer border-t border-gray-100"
                onClick={() => addOption(query.trim())}
              >
                <Plus size={13} className="text-blue-600 flex-shrink-0" />
                <span className="text-sm text-blue-600 font-medium">Add "{query.trim()}"</span>
                <span className="text-xs text-slate-400 ml-auto">↵ Enter</span>
              </div>
            )}

            {filtered.length === 0 && !canAdd && (
              <div className="px-3 py-4 text-center text-sm text-slate-400">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
