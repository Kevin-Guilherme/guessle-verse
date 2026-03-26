import { createServiceClient } from '@/lib/supabase/server'

export const revalidate = 300

const TIERS: [number, string, string, string][] = [
  [50000, 'DIAMOND',  '💎', '#06B6D4'],
  [30000, 'PLATINUM', '⬡',  '#A78BFA'],
  [15000, 'GOLD',     '◈',  '#F59E0B'],
  [5000,  'SILVER',   '◇',  '#94A3B8'],
  [0,     'BRONZE',   '◯',  '#CD7F32'],
]

function getTier(score: number) {
  return TIERS.find(([min]) => score >= min) ?? TIERS[TIERS.length - 1]
}

function emailToDisplayName(email: string): string {
  const prefix = (email ?? '').split('@')[0]
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\d+$/, '')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()) || prefix
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default async function RankingPage() {
  const service = createServiceClient()

  const [{ data: rows }, { data: { users } }] = await Promise.all([
    service.from('rankings').select('user_id, score, total_wins, total_games, best_streak'),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const userMap: Record<string, { name: string; initials: string; avatarUrl: string | null }> = {}
  for (const u of users ?? []) {
    const name = (u.user_metadata?.full_name as string | undefined)
      || (u.user_metadata?.name as string | undefined)
      || emailToDisplayName(u.email ?? '')
    const avatarUrl = (u.user_metadata?.avatar_url as string | undefined) ?? null
    userMap[u.id] = { name, initials: getInitials(name), avatarUrl }
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="font-display text-slate-600 tracking-widest">SEM DADOS AINDA</p>
      </div>
    )
  }

  const aggregated = Object.values(
    rows.reduce((acc: Record<string, any>, r) => {
      const uid = r.user_id
      if (!acc[uid]) acc[uid] = { user_id: uid, score: 0, total_wins: 0, total_games: 0, best_streak: 0 }
      acc[uid].score       += r.score ?? 0
      acc[uid].total_wins  += r.total_wins ?? 0
      acc[uid].total_games += r.total_games ?? 0
      acc[uid].best_streak  = Math.max(acc[uid].best_streak, r.best_streak ?? 0)
      return acc
    }, {})
  ).sort((a: any, b: any) => b.score - a.score).slice(0, 100)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-display text-neon-purple tracking-widest uppercase mb-1">Global</p>
        <h1 className="font-display text-3xl text-white tracking-wide">RANKING</h1>
      </div>

      {/* Podium top 3 */}
      {(aggregated as any[]).length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[1, 0, 2].map((pos) => {
            const row = (aggregated as any[])[pos]
            const [, tierName, tierIcon, tierColor] = getTier(row.score)
            const isFirst = pos === 0
            const { name, initials, avatarUrl } = userMap[row.user_id] ?? { name: row.user_id.slice(0, 8), initials: row.user_id.slice(0, 2).toUpperCase(), avatarUrl: null }
            return (
              <div
                key={pos}
                className={`relative rounded-xl border p-4 text-center ${isFirst ? 'border-yellow-500/30 bg-yellow-500/5 -mt-3' : 'border-white/5 bg-surface'}`}
              >
                {isFirst && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-yellow-400 text-lg">👑</div>
                )}
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full mx-auto mb-2 object-cover" style={{ border: `1px solid ${tierColor}40` }} />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${tierColor}80, ${tierColor}40)`, border: `1px solid ${tierColor}40` }}
                  >
                    {initials}
                  </div>
                )}
                <p className="text-xs text-slate-500 font-sans mb-1 truncate max-w-[120px] mx-auto">{name}</p>
                <p className="font-display text-white text-sm font-bold">{row.score.toLocaleString()}</p>
                <p className="text-xs mt-0.5" style={{ color: tierColor }}>{tierIcon} {tierName}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_90px_90px_70px_70px] text-xs font-display tracking-widest text-slate-600 uppercase px-4 py-3 border-b border-white/5">
          <span>#</span>
          <span>Jogador</span>
          <span className="text-right">Tier</span>
          <span className="text-right">Score</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Streak</span>
        </div>
        {(aggregated as any[]).map((row, i) => {
          const [, tierName, tierIcon, tierColor] = getTier(row.score)
          const { name, initials, avatarUrl } = userMap[row.user_id] ?? { name: row.user_id.slice(0, 8), initials: row.user_id.slice(0, 2).toUpperCase(), avatarUrl: null }
          return (
            <div
              key={row.user_id}
              className="grid grid-cols-[40px_1fr_90px_90px_70px_70px] items-center px-4 py-3 border-t border-white/5 hover:bg-white/3 transition-colors"
            >
              <span className="font-display text-slate-600 text-xs">{i + 1}</span>
              <div className="flex items-center gap-2 min-w-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${tierColor}80, ${tierColor}30)` }}
                  >
                    {initials}
                  </div>
                )}
                <span className="text-slate-300 font-sans text-sm truncate">{name}</span>
              </div>
              <span className="text-right text-xs font-display" style={{ color: tierColor }}>
                {tierIcon} {tierName}
              </span>
              <span className="text-right font-display text-white text-sm font-bold">{row.score.toLocaleString()}</span>
              <span className="text-right text-slate-500 text-sm">{row.total_wins}</span>
              <span className="text-right text-slate-500 text-sm">{row.best_streak}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
