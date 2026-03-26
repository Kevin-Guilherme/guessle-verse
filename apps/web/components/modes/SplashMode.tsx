'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

export default function SplashMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  // Zoom out as the user makes more champion guesses
  const champGuesses = guesses.filter(g => g.feedback?.[0]?.key === 'champion')
  const zoom = Math.max(500 - champGuesses.length * 80, 100)

  // Detect phase: champion was guessed correctly → skin phase
  const champCorrectGuess = guesses.find(g => g.feedback?.[0]?.key === 'champion' && g.feedback[0].feedback === 'correct')
  const skinPhase = !!champCorrectGuess
  const skinGuess = guesses.find(g => g.feedback?.[0]?.key === 'skin')

  // Skin autocomplete state
  const [query,       setQuery]       = useState('')
  const [allSkins,    setAllSkins]    = useState<string[]>([])
  const [open,        setOpen]        = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!skinPhase) return
    const skinName = (challenge.extra as Record<string, unknown>)?.skin_name as string | undefined
    const include  = skinName ? `&include=${encodeURIComponent(skinName)}` : ''
    fetch(`/api/skins?themeId=${challenge.theme_id}${include}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: Array<{ name: string }>) => setAllSkins(data.map(d => d.name)))
      .catch(() => {})
  }, [skinPhase, challenge.theme_id, challenge.extra])

  const filtered = useMemo(() => {
    if (query.length < 2) return []
    const q = query.toLowerCase()
    return allSkins.filter(s => s.toLowerCase().includes(q)).slice(0, 8)
  }, [allSkins, query])

  useEffect(() => {
    setOpen(filtered.length > 0 && query.length >= 2)
    setHighlighted(0)
  }, [filtered, query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectSkin(name: string) {
    setQuery('')
    setOpen(false)
    submitGuess(name, undefined, 'skin')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && filtered[highlighted]) selectSkin(filtered[highlighted])
    if (e.key === 'Escape') setOpen(false)
  }

  const cropPos = useMemo(() => ({
    x: Math.floor(Math.random() * 60) + 20,  // 20%–80%
    y: Math.floor(Math.random() * 60) + 20,
  }), [])

  const alreadyGuessedChamps = champGuesses.map(g => g.value.toLowerCase())

  return (
    <div className="space-y-4">
      {/* Splash art — zooms out with each wrong champion guess */}
      {challenge.image_url && (
        <div className="flex justify-center">
          <div className="w-[220px] h-[220px] overflow-hidden rounded-xl">
            <div
              className="w-full h-full bg-no-repeat transition-all duration-500"
              style={{ backgroundImage: `url(${challenge.image_url as string})`, backgroundSize: `${zoom}%`, backgroundPosition: won || lost ? 'center' : `${cropPos.x}% ${cropPos.y}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase label */}
      {!won && !lost && (
        <p className="text-center text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
          {skinPhase ? 'Qual é o nome dessa skin? (+50 pts bônus)' : 'Qual campeão aparece nesse splash?'}
        </p>
      )}

      {/* Phase 1: champion search */}
      {!skinPhase && !won && !lost && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessedChamps.includes(name.toLowerCase())) return
            submitGuess(name, undefined, 'champion')
          }}
          disabled={loading}
          placeholder="Digite o nome do campeão..."
        />
      )}

      {/* Phase 2: skin autocomplete */}
      {skinPhase && !won && !lost && !skinGuess && (
        <div ref={dropdownRef} className="relative">
          <div className="relative group">
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
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading}
              placeholder="Digite o nome da skin..."
              autoComplete="off"
              spellCheck={false}
              className={`
                w-full pl-10 pr-4 py-3.5 rounded-xl border appearance-none
                font-sans text-sm placeholder:text-slate-600
                outline-none transition-all duration-200
                border-game-border focus:border-neon-purple/60
                focus:shadow-[0_0_0_2px_rgba(124,58,237,0.25),0_0_20px_rgba(124,58,237,0.15)]
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
              style={{ backgroundColor: '#13132B', color: '#f1f5f9' }}
            />
            {loading && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-xl">
                <div className="h-full bg-neon-purple animate-pulse" />
              </div>
            )}
          </div>

          {open && filtered.length > 0 && (
            <div
              role="listbox"
              className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-xl border border-game-border bg-surface overflow-hidden shadow-2xl shadow-black/50"
            >
              {filtered.map((name, i) => (
                <button
                  key={name}
                  role="option"
                  aria-selected={i === highlighted}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectSkin(name) }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-sans transition-colors duration-100 cursor-pointer
                    ${i === highlighted ? 'bg-neon-purple/15 text-white' : 'text-slate-300 hover:bg-white/[0.04]'}
                    ${i < filtered.length - 1 ? 'border-b border-white/[0.04]' : ''}
                  `}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skin result feedback */}
      {skinGuess && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-display text-center ${
          skinGuess.feedback[0].feedback === 'correct'
            ? 'border-correct/40 bg-correct/10 text-correct'
            : 'border-red-500/30 bg-red-900/10 text-red-400'
        }`}>
          {skinGuess.feedback[0].feedback === 'correct'
            ? `✓ ${skinGuess.value} — +50 pts bônus!`
            : `✕ Skin era: ${(challenge.extra as Record<string, unknown>)?.skin_name as string ?? '?'}`
          }
        </div>
      )}
    </div>
  )
}
