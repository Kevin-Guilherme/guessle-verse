'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ModeGridProps {
  slug:        string
  color:       string
  modes:       string[]
  challengeIds: Record<string, number>   // mode → challenge id (only for available modes)
  modeMeta:    Record<string, { label: string; description: string }>
}

export function ModeGrid({ slug, color, modes, challengeIds, modeMeta }: ModeGridProps) {
  const [completedModes, setCompletedModes] = useState<Set<string>>(new Set())
  const [loadingCompletion, setLoadingCompletion] = useState(true)

  useEffect(() => {
    const ids = Object.values(challengeIds)
    if (!ids.length) { setLoadingCompletion(false); return }

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoadingCompletion(false); return }

      const { data: sessions } = await supabase
        .from('game_sessions')
        .select('daily_challenge_id')
        .eq('user_id', user.id)
        .in('daily_challenge_id', ids)
        .not('completed_at', 'is', null)

      const completedIds = new Set((sessions ?? []).map(s => s.daily_challenge_id))
      const done = new Set(
        Object.entries(challengeIds)
          .filter(([, id]) => completedIds.has(id))
          .map(([mode]) => mode)
      )
      setCompletedModes(done)
      setLoadingCompletion(false)
    })
  }, [challengeIds])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {modes.map(mode => {
        const meta      = modeMeta[mode]
        const available = mode in challengeIds
        const done      = completedModes.has(mode)

        const content = (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-display text-sm text-white tracking-wide">
                  {(meta?.label ?? mode).toUpperCase()}
                </h3>
                {available && !done && (
                  <span className="w-1.5 h-1.5 rounded-full bg-correct animate-pulse" />
                )}
              </div>
              <p className="text-xs text-slate-500">{meta?.description ?? ''}</p>
            </div>

            <div className="shrink-0">
              {loadingCompletion && available ? (
                <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-neon-purple/60 animate-spin" />
              ) : done ? (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: `${color}30`, border: `1px solid ${color}60` }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M20 6L9 17L4 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              ) : available ? (
                <span
                  className="text-xs font-display font-bold px-3 py-1 rounded-full tracking-wider"
                  style={{
                    background: `${color}20`,
                    color: color,
                    border: `1px solid ${color}40`,
                  }}
                >
                  JOGAR
                </span>
              ) : (
                <span className="text-xs text-slate-700 bg-white/3 px-3 py-1 rounded-full border border-white/5 font-display tracking-wider">
                  BREVE
                </span>
              )}
            </div>
          </div>
        )

        const baseClass = `relative rounded-xl p-4 border transition-all duration-300 overflow-hidden`

        return available ? (
          <Link
            key={mode}
            href={`/games/${slug}/${mode}`}
            className={`${baseClass} bg-surface border-white/5 hover:border-white/20 cursor-pointer group ${done ? 'opacity-70' : ''}`}
            style={{ ['--mode-color' as string]: color }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `radial-gradient(ellipse at 100% 50%, ${color}10 0%, transparent 60%)` }}
            />
            <div className="relative">{content}</div>
          </Link>
        ) : (
          <div key={mode} className={`${baseClass} bg-surface/50 border-white/3 opacity-40 cursor-not-allowed`}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
