'use client'

import { useEffect, useState, useMemo } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import type { ModeComponentProps } from '@/lib/game/registry'

const LANE_FILTERS = [
  { label: 'All',  value: '' },
  { label: 'Top',  value: 'top' },
  { label: 'Jg',   value: 'jungle' },
  { label: 'Mid',  value: 'mid' },
  { label: 'ADC',  value: 'bottom' },
  { label: 'Sup',  value: 'support' },
]

interface ChampRow { name: string; image_url: string | null; positions: string }

function ItemSlot({ url, index }: { url?: string; index: number }) {
  return (
    <div className="relative w-[64px] h-[64px] rounded-lg overflow-hidden border border-white/10 bg-surface shrink-0 flex items-center justify-center">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Item ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-slate-700 font-display text-xl font-bold">?</span>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: 'high' | 'low' | 'wrong' | 'correct' }) {
  const cls =
    status === 'correct' ? 'bg-correct'
    : status === 'wrong'  ? 'bg-red-500'
    : status === 'high'   ? 'bg-green-400'
    : 'bg-white/20'
  return <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border border-black/30 ${cls}`} />
}

export default function SkillOrderMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())

  const items:     string[]                    = (challenge.extra?.build_items       ?? []) as string[]
  const skillOrder: string[]                   = (challenge.extra?.build_skill_order ?? []) as string[]
  const lane:       string                     = (challenge.extra?.build_lane        ?? '') as string
  const runeUrl:    string                     = (challenge.extra?.build_rune_url    ?? '') as string
  const affinity:   Record<string, 'high'|'low'> = (challenge.extra?.build_champion_affinity ?? {}) as Record<string, 'high'|'low'>

  // Progressive reveal: start with 1 item, +1 per wrong guess
  const wrongGuesses  = guesses.filter(g => !g.feedback.every(f => f.feedback === 'correct')).length
  const revealedCount = Math.min(wrongGuesses + 1, items.length)
  const paddedItems   = [...items, ...Array(6).fill('')].slice(0, 6) as string[]

  const [nameFilter, setNameFilter] = useState('')
  const [laneFilter, setLaneFilter] = useState('')
  const [champions,  setChampions]  = useState<ChampRow[]>([])

  useEffect(() => {
    fetch(`/api/characters?themeId=${challenge.theme_id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((data: ChampRow[]) => setChampions(data))
      .catch(() => {})
  }, [challenge.theme_id])

  const filtered = useMemo(() => {
    return champions.filter(c => {
      const nameOk = nameFilter === '' || c.name.toLowerCase().includes(nameFilter.toLowerCase())
      const laneOk = laneFilter === '' || c.positions.toLowerCase().includes(laneFilter)
      return nameOk && laneOk
    })
  }, [champions, nameFilter, laneFilter])

  function getTileStatus(name: string): 'high' | 'low' | 'wrong' | 'correct' {
    const lower = name.toLowerCase()
    if (won && guesses.some(g => g.value.toLowerCase() === lower && g.feedback.every(f => f.feedback === 'correct'))) return 'correct'
    if (alreadyGuessed.includes(lower)) return 'wrong'
    if (guesses.length > 0) return affinity[name] ?? 'low'
    return 'low'
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
        Qual campeão usa esse build?
      </p>

      {/* Progressive item reveal */}
      <div className="flex items-center gap-1.5 justify-center flex-wrap">
        {paddedItems.map((url, i) => (
          <ItemSlot key={i} url={i < revealedCount ? url : undefined} index={i} />
        ))}
      </div>

      {/* Lane + Rune badges */}
      {(lane || runeUrl) && (
        <div className="flex items-center justify-center gap-4">
          {lane && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-lg border border-white/10 bg-surface flex items-center justify-center">
                <span className="text-[8px] font-display tracking-widest text-slate-400 uppercase text-center leading-tight px-1">{lane}</span>
              </div>
              <span className="text-[9px] text-slate-600 font-display uppercase tracking-widest">Lane</span>
            </div>
          )}
          {runeUrl && (
            <div className="flex flex-col items-center gap-1">
              <div className="relative w-10 h-10 rounded-full border border-white/10 bg-surface overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={runeUrl} alt="Keystone" className="w-full h-full object-contain p-1" loading="lazy" />
              </div>
              <span className="text-[9px] text-slate-600 font-display uppercase tracking-widest">Rune</span>
            </div>
          )}
        </div>
      )}

      {/* Search + lane filter */}
      {!won && !lost && (
        <div className="space-y-2">
          <input
            type="text"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder="Buscar campeão..."
            className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-neon-purple/50"
          />
          <div className="flex gap-1 flex-wrap">
            {LANE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setLaneFilter(f.value)}
                className={`px-2 py-1 rounded-md text-[10px] font-display uppercase tracking-wide transition-colors ${
                  laneFilter === f.value
                    ? 'bg-neon-purple text-white'
                    : 'bg-surface border border-white/10 text-slate-400 hover:border-white/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Champion grid */}
      {!won && !lost && (
        <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 max-h-64 overflow-y-auto pr-1">
          {filtered.map(c => {
            const status  = getTileStatus(c.name)
            const guessed = alreadyGuessed.includes(c.name.toLowerCase())
            return (
              <button
                key={c.name}
                onClick={() => {
                  if (guessed || loading) return
                  submitGuess(c.name)
                }}
                disabled={guessed || loading}
                className={`relative flex flex-col items-center gap-0.5 group transition-all duration-150 ${
                  guessed ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105'
                }`}
              >
                <div className={`relative w-full aspect-square rounded-lg overflow-hidden border transition-colors ${
                  status === 'correct' ? 'border-correct' : status === 'wrong' ? 'border-red-500/40' : 'border-white/10 group-hover:border-white/30'
                }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.image_url?.replace('/splash/', '/tiles/') ?? ''}
                    alt={c.name}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                  <StatusDot status={status} />
                </div>
                <span className={`text-[9px] font-display text-center leading-tight truncate w-full ${
                  status === 'correct' ? 'text-correct' : status === 'wrong' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
