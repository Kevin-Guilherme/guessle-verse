'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store/game-store'
import { useGuess } from '@/hooks/useGuess'
import type { ModeComponentProps } from '@/lib/game/registry'

const SKILLS = ['Q', 'W', 'E', 'R'] as const

interface QuestData {
  answer: string
  build_items: string[]
  build_lane: string
  build_rune_url: string | null
  build_skill_order: string[]
  build_options: Array<{ name: string; image_url: string }>
}

function ItemSlot({ url, index }: { url?: string; index: number }) {
  return (
    <div className="relative w-[72px] h-[72px] rounded-lg overflow-hidden border border-white/10 bg-surface shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Item ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-700 font-display text-lg">?</div>
      )}
    </div>
  )
}

function Connector() {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
      <span className="w-3 h-px bg-white/10" />
      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
    </div>
  )
}

function ItemRow({ items, startIdx }: { items: string[]; startIdx: number }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1">
          <ItemSlot url={items[startIdx + i]} index={startIdx + i} />
          {i < 2 && <Connector />}
        </div>
      ))}
    </div>
  )
}

function SkillOrderGrid({ skillOrder }: { skillOrder: string[] }) {
  if (!skillOrder.length) return null
  const levels = skillOrder.length

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex">
        <div className="flex flex-col gap-px mr-1">
          <div className="h-5" />
          {SKILLS.map(s => (
            <div key={s} className="w-6 h-6 flex items-center justify-center text-[10px] font-display font-bold text-slate-500 uppercase">
              {s}
            </div>
          ))}
        </div>
        <div className="flex gap-px">
          {Array.from({ length: levels }).map((_, lvl) => {
            const skill = skillOrder[lvl]
            return (
              <div key={lvl} className="flex flex-col gap-px">
                <div className="w-6 h-5 flex items-center justify-center text-[9px] text-slate-600 font-display tabular-nums">
                  {lvl + 1}
                </div>
                {SKILLS.map(s => (
                  <div
                    key={s}
                    className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-display font-bold transition-colors ${
                      skill === s
                        ? s === 'R'
                          ? 'bg-neon-purple text-white'
                          : 'bg-correct/80 text-white'
                        : 'bg-white/[0.04] text-transparent'
                    }`}
                  >
                    {skill === s ? s : '·'}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ChampionTile({
  option,
  state,
  onClick,
  disabled,
}: {
  option: { name: string; image_url: string }
  state: 'idle' | 'correct' | 'wrong'
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-1.5 group transition-all duration-200 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105'
      }`}
    >
      <div
        className={`relative w-full aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
          state === 'correct'
            ? 'border-correct shadow-[0_0_12px_rgba(34,197,94,0.5)]'
            : state === 'wrong'
            ? 'border-red-500/60 opacity-50'
            : 'border-white/10 group-hover:border-white/30'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={option.image_url}
          alt={option.name}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
        {state === 'wrong' && (
          <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
            <span className="text-red-400 text-xl font-bold">✕</span>
          </div>
        )}
        {state === 'correct' && (
          <div className="absolute inset-0 bg-correct/10 flex items-center justify-center">
            <span className="text-correct text-xl font-bold">✓</span>
          </div>
        )}
      </div>
      <span
        className={`text-[10px] font-display tracking-wide text-center leading-tight ${
          state === 'correct'
            ? 'text-correct'
            : state === 'wrong'
            ? 'text-slate-600'
            : 'text-slate-400 group-hover:text-white'
        }`}
      >
        {option.name}
      </span>
    </button>
  )
}

// ─── Quest campaign UI ───────────────────────────────────────────────────────

function QuestBuildPanel({ quest, questIndex, total, onGuess, locked }: {
  quest: QuestData
  questIndex: number
  total: number
  onGuess: (name: string) => Promise<boolean>
  locked: boolean
}) {
  const items      = [...(quest.build_items ?? []), ...Array(6).fill('')].slice(0, 6) as string[]
  const skillOrder = quest.build_skill_order ?? []
  const lane       = quest.build_lane ?? ''
  const runeUrl    = quest.build_rune_url ?? ''
  const options    = quest.build_options ?? []

  const [currentPick,    setCurrentPick]    = useState<string | null>(null)
  const [wrongPicks,     setWrongPicks]      = useState<Set<string>>(new Set())
  const [resolvedCorrect, setResolvedCorrect] = useState<string | null>(null)

  async function handlePick(name: string) {
    if (currentPick || locked || wrongPicks.has(name.toLowerCase())) return
    setCurrentPick(name)
    const isCorrect = await onGuess(name)
    if (isCorrect) {
      setResolvedCorrect(name)
      setCurrentPick(null)
    } else {
      // Only show error after API confirms wrong
      setWrongPicks(prev => new Set([...prev, name.toLowerCase()]))
      setTimeout(() => setCurrentPick(null), 800)
    }
  }

  function tileState(name: string): 'idle' | 'correct' | 'wrong' {
    const lower = name.toLowerCase()
    if (resolvedCorrect && lower === resolvedCorrect.toLowerCase()) return 'correct'
    if (wrongPicks.has(lower)) return 'wrong'
    return 'idle'  // currentPick is pending — show neutral until API responds
  }

  return (
    <div className="space-y-4">
      {/* Quest counter */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
          Qual campeão usa esse build?
        </p>
        <span className="text-[10px] font-display text-slate-500">
          {questIndex + 1}/{total}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i < questIndex
                ? 'w-6 bg-correct'
                : i === questIndex
                ? 'w-6 bg-neon-purple'
                : 'w-3 bg-white/10'
            }`}
          />
        ))}
      </div>

      {/* Build items */}
      <div className="flex flex-col items-center gap-2">
        <ItemRow items={items} startIdx={0} />
        <ItemRow items={items} startIdx={3} />
      </div>

      {/* Lane + Rune */}
      {(lane || runeUrl) && (
        <div className="flex items-center justify-center gap-4">
          {lane && (
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-lg border border-white/10 bg-surface flex items-center justify-center">
                <span className="text-[9px] font-display tracking-widest text-slate-400 uppercase text-center leading-tight px-1">{lane}</span>
              </div>
              <span className="text-[9px] text-slate-600 font-display uppercase tracking-widest">Lane</span>
            </div>
          )}
          {runeUrl && (
            <div className="flex flex-col items-center gap-1">
              <div className="relative w-12 h-12 rounded-full border border-white/10 bg-surface overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={runeUrl} alt="Keystone" className="w-full h-full object-contain p-1" loading="lazy" />
              </div>
              <span className="text-[9px] text-slate-600 font-display uppercase tracking-widest">Rune</span>
            </div>
          )}
        </div>
      )}

      {/* Skill order */}
      {skillOrder.length > 0 && (
        <div className="bg-surface/50 rounded-xl p-3 border border-white/[0.06] flex flex-col items-center">
          <p className="text-[9px] font-display tracking-widest text-slate-600 uppercase mb-2">Ordem de habilidades</p>
          <SkillOrderGrid skillOrder={skillOrder} />
        </div>
      )}

      {/* Champion tiles */}
      {options.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {options.map((opt) => (
            <ChampionTile
              key={opt.name}
              option={opt}
              state={tileState(opt.name)}
              disabled={!!currentPick || locked || wrongPicks.has(opt.name.toLowerCase())}
              onClick={() => handlePick(opt.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Score summary ───────────────────────────────────────────────────────────

function ScoreSummary({ quests, results }: { quests: QuestData[]; results: Array<'correct' | 'wrong'> }) {
  const score = results.filter(r => r === 'correct').length * 100
  return (
    <div className="space-y-3">
      <p className="text-center text-[10px] font-display tracking-[0.2em] text-slate-500 uppercase">Resultado</p>
      {quests.map((q, i) => {
        const imgUrl = q.build_options?.find(o => o.name.toLowerCase() === q.answer.toLowerCase())?.image_url ?? null
        const isCorrect = results[i] === 'correct'
        return (
          <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
            isCorrect ? 'border-correct/40 bg-correct/10' : 'border-red-500/30 bg-red-900/10'
          }`}>
            {imgUrl && (
              <div className={`w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 ${
                isCorrect ? 'border-correct/60' : 'border-red-500/40'
              }`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt={q.answer} className="w-full h-full object-cover object-top" loading="lazy" />
              </div>
            )}
            <span className="flex-1 text-sm font-display text-white/80">{q.answer}</span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-display tracking-widest uppercase ${isCorrect ? 'text-correct' : 'text-red-400'}`}>
                {isCorrect ? '+100' : '+0'}
              </span>
              <span className={`text-base ${isCorrect ? 'text-correct' : 'text-red-400'}`}>
                {isCorrect ? '✓' : '✕'}
              </span>
            </div>
          </div>
        )
      })}
      <div className="flex items-center justify-between rounded-xl border border-neon-purple/40 bg-neon-purple/10 px-4 py-3">
        <span className="text-sm font-display font-bold text-white">Total</span>
        <span className="text-sm font-display font-bold text-neon-purple">{score} pts</span>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BuildMode({ challenge }: ModeComponentProps) {
  const { won, lost, guesses } = useGameStore()
  const { submitGuess, loading } = useGuess(challenge.id)

  const quests = (challenge.extra?.quests ?? []) as QuestData[]
  const isQuestMode = quests.length > 0

  // Quest campaign state
  const [questIndex, setQuestIndex]   = useState(0)
  const [results, setResults]         = useState<Array<'correct' | 'wrong'>>([])
  const [advancing, setAdvancing]     = useState(false)
  const [allDone, setAllDone]         = useState(false)
  const advanceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasHydrated   = useRef(false)

  // Restore state from guess history (hydration after reload)
  useEffect(() => {
    if (hasHydrated.current || !isQuestMode || !guesses.length) return
    hasHydrated.current = true

    const questGuesses = guesses.filter(g => g.feedback?.[0]?.key === 'champion')
    if (questGuesses.length === 0) return

    // Simulate quest progression: only correct guesses advance the quest index.
    // Wrong guesses within a quest don't count as a separate quest result.
    let qi = 0
    const restored: Array<'correct' | 'wrong'> = []
    for (const g of questGuesses) {
      if (g.feedback?.[0]?.feedback === 'correct') {
        restored[qi] = 'correct'
        qi++
        if (qi >= quests.length) break
      }
    }

    setResults(restored)
    if (qi >= quests.length) {
      setAllDone(true)
      setQuestIndex(quests.length - 1)
    } else {
      setQuestIndex(qi)
    }
  }, [guesses]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  // Legacy single-build mode (no quests array)
  if (!isQuestMode) {
    const alreadyGuessed = guesses.map((g) => g.value.toLowerCase())
    const items      = (challenge.extra?.build_items       ?? []) as string[]
    const skillOrder = (challenge.extra?.build_skill_order ?? []) as string[]
    const lane       = (challenge.extra?.build_lane        ?? '') as string
    const runeUrl    = (challenge.extra?.build_rune_url    ?? '') as string
    const options    = (challenge.extra?.build_options     ?? []) as Array<{ name: string; image_url: string }>
    const paddedItems = [...items, ...Array(6).fill('')].slice(0, 6) as string[]
    const correctName = (challenge.attributes as Record<string, unknown>)?.answer as string | undefined

    const resolvedState = (name: string): 'idle' | 'correct' | 'wrong' => {
      if (won && correctName && name.toLowerCase() === correctName.toLowerCase()) return 'correct'
      if (lost && correctName && name.toLowerCase() === correctName.toLowerCase()) return 'correct'
      if (alreadyGuessed.includes(name.toLowerCase())) return 'wrong'
      return 'idle'
    }

    return (
      <div className="space-y-5">
        <p className="text-center text-[10px] font-display tracking-[0.2em] text-slate-600 uppercase">
          Qual campeão usa esse build?
        </p>
        <div className="flex flex-col items-center gap-2">
          <ItemRow items={paddedItems} startIdx={0} />
          <ItemRow items={paddedItems} startIdx={3} />
        </div>
        {(lane || runeUrl) && (
          <div className="flex items-center justify-center gap-4">
            {lane && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-lg border border-white/10 bg-surface flex items-center justify-center">
                  <span className="text-[9px] font-display tracking-widest text-slate-400 uppercase text-center leading-tight px-1">{lane}</span>
                </div>
                <span className="text-[9px] text-slate-600 font-display uppercase tracking-widest">Lane</span>
              </div>
            )}
            {runeUrl && (
              <div className="flex flex-col items-center gap-1">
                <div className="relative w-12 h-12 rounded-full border border-white/10 bg-surface overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={runeUrl} alt="Keystone" className="w-full h-full object-contain p-1" loading="lazy" />
                </div>
                <span className="text-[9px] text-slate-600 font-display uppercase tracking-widest">Rune</span>
              </div>
            )}
          </div>
        )}
        {skillOrder.length > 0 && (
          <div className="bg-surface/50 rounded-xl p-3 border border-white/[0.06] flex flex-col items-center">
            <p className="text-[9px] font-display tracking-widest text-slate-600 uppercase mb-2">Ordem de habilidades</p>
            <SkillOrderGrid skillOrder={skillOrder} />
          </div>
        )}
        {options.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {options.map((opt) => (
              <ChampionTile
                key={opt.name}
                option={opt}
                state={resolvedState(opt.name)}
                disabled={won || lost || loading || alreadyGuessed.includes(opt.name.toLowerCase())}
                onClick={() => {
                  if (alreadyGuessed.includes(opt.name.toLowerCase())) return
                  submitGuess(opt.name)
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Quest campaign ────────────────────────────────────────────────────────

  if (allDone || (won && results.length >= quests.length)) {
    return <ScoreSummary quests={quests} results={results} />
  }

  const currentQuest = quests[questIndex]
  if (!currentQuest) return null

  async function handleQuestGuess(name: string): Promise<boolean> {
    if (advancing || loading) return false
    const res = await submitGuess(name, questIndex)
    if (!res) return false

    const isCorrect = res.feedback?.[0]?.feedback === 'correct'
    if (!isCorrect) return false

    setResults(prev => [...prev, 'correct'])
    setAdvancing(true)
    advanceTimer.current = setTimeout(() => {
      setAdvancing(false)
      if (questIndex < quests.length - 1) {
        setQuestIndex(qi => qi + 1)
      } else {
        setAllDone(true)
      }
    }, 1500)
    return true
  }

  return (
    <QuestBuildPanel
      key={questIndex}
      quest={currentQuest}
      questIndex={questIndex}
      total={quests.length}
      onGuess={handleQuestGuess}
      locked={advancing || loading}
    />
  )
}
