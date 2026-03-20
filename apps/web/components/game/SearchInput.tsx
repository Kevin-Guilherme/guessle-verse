'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'

interface SearchInputProps {
  themeId:      number
  onSubmit:     (value: string) => void
  disabled?:    boolean
  placeholder?: string
}

export function SearchInput({ themeId, onSubmit, disabled, placeholder }: SearchInputProps) {
  const supabase       = createClient()
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<string[]>([])
  const [open,    setOpen]    = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('characters')
        .select('name')
        .eq('theme_id', themeId)
        .ilike('name', `%${query}%`)
        .limit(8)

      setResults(data?.map((d) => d.name) ?? [])
      setOpen(true)
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

  return (
    <div ref={ref} className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) select(results[0]) }}
        disabled={disabled}
        placeholder={placeholder ?? 'Digite o nome...'}
        className="bg-bg-surface border-border text-white"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-surface border border-border rounded-lg overflow-hidden shadow-xl">
          {results.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => select(name)}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
