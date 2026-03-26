'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import { SearchInput } from '@/components/game/SearchInput'
import type { ModeComponentProps } from '@/lib/game/registry'

interface Ability {
  slot:     string
  name:     string
  icon_url: string
}

const SLOTS = ['Passive', 'Q', 'W', 'E', 'R'] as const
// Short labels that fit inside the fixed-width button
const SLOT_LABEL: Record<string, string> = { Passive: 'PASS', Q: 'Q', W: 'W', E: 'E', R: 'R' }

export default function AbilityMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses }  = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)
  const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
  const abilities: Ability[] = (challenge.extra?.abilities as Ability[]) ?? []
  const ability = abilities.length > 0 ? abilities[challenge.id % abilities.length] : null

  const [slotPhase, setSlotPhase]   = useState(false)
  const [slotResult, setSlotResult] = useState<'correct' | 'wrong' | null>(null)
  const [triedSlots, setTriedSlots] = useState<Set<string>>(new Set())
  const hasHydrated = useRef(false)

  // All 5 slots tried and none correct → bonus phase failed
  const slotFailed = triedSlots.size >= SLOTS.length

  // Any correct champion guess in history (not just lastGuess — handles reload after slot attempts)
  const champWasCorrect =
    guesses.some(
      g => g.feedback?.[0]?.key === 'champion' && g.feedback?.[0]?.feedback === 'correct'
    ) && !won

  // Activate slot phase when champion was correctly guessed
  useEffect(() => {
    if (champWasCorrect && !slotPhase && !slotResult) {
      setSlotPhase(true)
    }
  }, [champWasCorrect, slotPhase, slotResult])

  // Restore triedSlots from guess history on hydration
  useEffect(() => {
    if (hasHydrated.current || !guesses.length) return
    hasHydrated.current = true

    const tried = new Set<string>(
      guesses
        .filter(g => g.value?.startsWith('SLOT:'))
        .map(g => g.value.replace('SLOT:', ''))
    )
    if (tried.size > 0) setTriedSlots(tried)
  }, [guesses]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fixed rotation per challenge: 0°, 90°, 180° or 270°
  const rotation = useMemo(() => [0, 90, 180, 270][challenge.id % 4], [challenge.id])

  async function handleSlot(slot: string) {
    if (loading || won || slotResult === 'correct' || triedSlots.has(slot)) return
    const res = await submitGuess(`SLOT:${slot}`)
    if (res) {
      const correct = res.feedback?.[0]?.feedback === 'correct'
      setTriedSlots(prev => new Set([...prev, slot]))
      setSlotResult(correct ? 'correct' : 'wrong')
      if (!correct) {
        setTimeout(() => setSlotResult(null), 1200)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Single ability icon */}
      {ability && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
            Qual campeão possui esta habilidade?
          </p>
          <div
            className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-surface shadow-neon-purple"
            style={{ filter: 'grayscale(1)', transform: `rotate(${rotation}deg)` }}
          >
            <Image src={ability.icon_url} alt="?" fill className="object-cover" unoptimized />
          </div>
        </div>
      )}

      {/* Fallback for legacy challenges without abilities */}
      {abilities.length === 0 && challenge.extra?.ability_url && (
        <div className="relative w-24 h-24 mx-auto">
          <Image
            src={challenge.extra.ability_url as string}
            alt="Habilidade" fill
            className="object-contain rounded-xl"
            unoptimized
          />
        </div>
      )}

      {/* Champion search — only when not in slot phase */}
      {!won && !lost && !slotPhase && (
        <SearchInput
          themeId={challenge.theme_id}
          onSubmit={(name) => {
            if (alreadyGuessed.includes(name.toLowerCase())) return
            submitGuess(name)
          }}
          disabled={loading}
        />
      )}

      {/* Slot phase — pick Passive/Q/W/E/R */}
      {!won && !lost && slotPhase && !slotFailed && (
        <div className="space-y-3">
          <p className="text-center text-[10px] font-display tracking-[0.2em] text-slate-400 uppercase">
            Em qual slot está esta habilidade?
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {SLOTS.map(slot => {
              const tried = triedSlots.has(slot)
              return (
                <button
                  key={slot}
                  onClick={() => handleSlot(slot)}
                  disabled={loading || slotResult === 'correct' || tried}
                  className={`w-14 h-14 rounded-xl font-display font-bold text-xs tracking-widest uppercase transition-all duration-200 border
                    ${tried
                      ? 'opacity-30 cursor-not-allowed bg-red-900/30 border-red-500/20 text-red-400'
                      : slotResult === 'correct'
                        ? 'opacity-40 cursor-not-allowed bg-surface border-white/10 text-white'
                        : 'cursor-pointer hover:scale-105 bg-surface border-white/10 text-white hover:border-neon-purple/50 hover:bg-neon-purple/10'
                    }`}
                >
                  {SLOT_LABEL[slot]}
                </button>
              )
            })}
          </div>
          {slotResult === 'wrong' && (
            <p className="text-center text-xs text-red-400 font-display tracking-wider">
              Slot errado! Tente novamente.
            </p>
          )}
        </div>
      )}

      {/* Slot phase failed — all slots tried incorrectly */}
      {!won && !lost && slotPhase && slotFailed && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/10 px-4 py-3 text-center">
          <p className="text-sm text-red-400 font-display tracking-wide">
            Não acertou o slot bônus desta vez!
          </p>
        </div>
      )}
    </div>
  )
}
