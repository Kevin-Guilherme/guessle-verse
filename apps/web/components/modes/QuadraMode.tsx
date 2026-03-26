'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import type { ModeComponentProps } from '@/lib/game/registry'

interface Tile  { name: string; image_url: string }
interface Group { category: string; color: string; champions: string[] }

const COLOR_MAP: Record<string, string> = {
  green:  'bg-green-600/80  border-green-400/50',
  yellow: 'bg-yellow-600/80 border-yellow-400/50',
  orange: 'bg-orange-600/80 border-orange-400/50',
  purple: 'bg-purple-600/80 border-purple-400/50',
}

const COLOR_TEXT: Record<string, string> = {
  green:  'text-green-300',
  yellow: 'text-yellow-300',
  orange: 'text-orange-300',
  purple: 'text-purple-300',
}

export default function QuadraMode({ challenge, config }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const tiles:  Tile[]  = (challenge.extra?.tiles  ?? []) as Tile[]
  const groups: Group[] = ((challenge.attributes as Record<string, unknown>)?.groups ?? []) as Group[]
  const totalLives = config.lives ?? 4

  const [selected,     setSelected]     = useState<string[]>([])
  const [solvedGroups, setSolvedGroups] = useState<Group[]>([])
  const [shaking,      setShaking]      = useState(false)

  const wrongGuesses  = guesses.filter(g => !g.feedback.every(f => f.feedback === 'correct')).length
  const livesLeft     = totalLives - wrongGuesses
  const solvedNames   = new Set(solvedGroups.flatMap(g => g.champions))
  const activeTiles   = tiles.filter(t => !solvedNames.has(t.name))

  function toggleSelect(name: string) {
    if (solvedNames.has(name) || won || lost) return
    setSelected(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : prev.length < 4 ? [...prev, name] : prev
    )
  }

  async function validate() {
    if (selected.length !== 4 || loading) return
    const value = selected.join(',')
    const res = await submitGuess(value)
    if (!res) return

    if (res.feedback?.[0]?.feedback === 'correct' && res.group) {
      setSolvedGroups(prev => [...prev, res.group!])
      setSelected([])
    } else {
      setShaking(true)
      setTimeout(() => setShaking(false), 600)
      setSelected([])
    }
  }

  return (
    <div className="space-y-4">
      {/* Lives */}
      <div className="flex gap-1 justify-center">
        {Array.from({ length: totalLives }).map((_, i) => (
          <span key={i} className={`text-xl transition-opacity ${i < livesLeft ? 'opacity-100' : 'opacity-20'}`}>
            ❤️
          </span>
        ))}
      </div>

      {/* Champion tiles grid */}
      {!won && !lost && (
        <div className={`grid grid-cols-4 gap-1.5 ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
          {activeTiles.map(tile => {
            const isSelected = selected.includes(tile.name)
            return (
              <button
                key={tile.name}
                onClick={() => toggleSelect(tile.name)}
                className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all duration-150 ${
                  isSelected
                    ? 'border-neon-purple bg-neon-purple/20 scale-95'
                    : 'border-white/10 bg-surface hover:border-white/30 hover:scale-[1.02]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.image_url}
                  alt={tile.name}
                  className="w-full aspect-square object-cover object-top rounded-lg"
                  loading="lazy"
                />
                <span className="text-[9px] font-display tracking-wide text-slate-300 text-center leading-tight w-full truncate">
                  {tile.name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Validate button */}
      {!won && !lost && livesLeft > 0 && (
        <button
          onClick={validate}
          disabled={selected.length !== 4 || loading}
          className="w-full py-3 rounded-xl font-display font-bold tracking-widest uppercase text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-neon-purple hover:bg-neon-purple/80 text-white"
        >
          {selected.length === 4 ? 'Validar' : `Selecione ${4 - selected.length} mais`}
        </button>
      )}

      {/* Solved groups history — shown below grid during gameplay */}
      {!won && !lost && solvedGroups.length > 0 && (
        <div className="space-y-2 pt-1">
          {solvedGroups.map(g => (
            <div key={g.category} className={`rounded-xl border px-4 py-3 ${COLOR_MAP[g.color] ?? 'bg-surface border-white/10'}`}>
              <p className={`text-xs font-display font-bold uppercase tracking-widest mb-1 ${COLOR_TEXT[g.color] ?? 'text-white'}`}>
                {g.category}
              </p>
              <p className="text-[11px] text-white/80 font-sans">{g.champions.join(' · ')}</p>
            </div>
          ))}
        </div>
      )}

      {/* End-game: reveal all categories */}
      {(won || lost) && (
        <div className="space-y-2 pt-1">
          <p className="text-center text-xs font-display font-bold uppercase tracking-widest text-white/40 pb-1">
            {won ? 'Categorias' : 'Resultado'}
          </p>
          {groups.map(g => (
            <div key={g.category} className={`rounded-xl border px-4 py-3 ${COLOR_MAP[g.color] ?? 'bg-surface border-white/10'}`}>
              <p className={`text-xs font-display font-bold uppercase tracking-widest mb-1 ${COLOR_TEXT[g.color] ?? 'text-white'}`}>
                {g.category}
              </p>
              <p className="text-[11px] text-white/80 font-sans">{g.champions.join(' · ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
