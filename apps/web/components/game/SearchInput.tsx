'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SearchInputProps {
  themeId:      number
  onSubmit:     (value: string) => void
  disabled?:    boolean
  placeholder?: string
}

export function SearchInput({ themeId, onSubmit, disabled, placeholder }: SearchInputProps) {
  const supabase = createClient()
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<string[]>([])
  const [open,         setOpen]         = useState(false)
  const [highlighted,  setHighlighted]  = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('characters')
        .select('name')
        .eq('theme_id', themeId)
        .ilike('name', `%${query}%`)
        .limit(8)

      const names = data?.map((d) => d.name) ?? []
      setResults(names)
      setOpen(names.length > 0)
      setHighlighted(0)
    }, 200)

    return () => clearTimeout(timer)
  }, [query, themeId, supabase])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (name: string) => {
    setQuery('')
    setOpen(false)
    onSubmit(name)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && results[highlighted]) select(results[highlighted])
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Search field */}
      <div className="relative group">
        {/* Magnifier icon */}
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-neon-purple transition-colors duration-200 pointer-events-none"
          viewBox="0 0 24 24" fill="none" aria-hidden
        >
          <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
          <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? 'Digite o nome do personagem...'}
          autoComplete="off"
          spellCheck={false}
          aria-label="Buscar personagem"
          aria-autocomplete="list"
          aria-expanded={open}
          className={`
            w-full pl-10 pr-24 py-3.5 rounded-xl border bg-surface
            font-sans text-sm text-white placeholder:text-slate-600
            outline-none transition-all duration-200
            border-game-border
            focus:border-neon-purple/60
            focus:shadow-[0_0_0_2px_rgba(124,58,237,0.25),0_0_20px_rgba(124,58,237,0.15)]
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        />

        {/* Keyboard hint */}
        {!disabled && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 pointer-events-none">
            <kbd className="text-[10px] font-sans text-slate-600 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none">↵</kbd>
          </span>
        )}

        {/* Loading bar when disabled */}
        {disabled && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-xl">
            <div className="h-full bg-neon-purple animate-pulse" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-xl border border-game-border bg-surface overflow-hidden shadow-2xl shadow-black/50"
        >
          {results.map((name, i) => (
            <button
              key={name}
              role="option"
              aria-selected={i === highlighted}
              type="button"
              onClick={() => select(name)}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-4 py-2.5 text-sm font-sans flex items-center gap-3 transition-colors duration-100 cursor-pointer
                ${i === highlighted
                  ? 'bg-neon-purple/15 text-white'
                  : 'text-slate-300 hover:bg-white/[0.04]'
                }
                ${i < results.length - 1 ? 'border-b border-white/[0.04]' : ''}
              `}
            >
              {/* Character initial dot */}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-display shrink-0
                ${i === highlighted ? 'bg-neon-purple/30 text-neon-purple-light' : 'bg-white/5 text-slate-500'}
              `}>
                {name[0]?.toUpperCase()}
              </span>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
