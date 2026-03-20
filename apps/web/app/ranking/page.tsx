import { createServiceClient } from '@/lib/supabase/server'

export const revalidate = 300

const TIERS: [number, string, string][] = [
  [50000, 'Diamond',  '💎'],
  [30000, 'Platinum', '🥈'],
  [15000, 'Gold',     '🥇'],
  [5000,  'Silver',   '🪙'],
  [0,     'Bronze',   '🥉'],
]

function getTier(score: number) {
  return TIERS.find(([min]) => score >= min) ?? TIERS[TIERS.length - 1]
}

export default async function RankingPage() {
  const service = createServiceClient()

  const { data: rows } = await service
    .from('rankings')
    .select('user_id, score, total_wins, total_games, best_streak')

  if (!rows || rows.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Nenhum ranking ainda.</p>
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
      <h1 className="text-2xl font-bold text-white mb-8">Ranking Global</h1>
      <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-gray-500 text-xs uppercase">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Jogador</th>
              <th className="px-4 py-3 text-right">Tier</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Vitorias</th>
              <th className="px-4 py-3 text-right">Streak</th>
            </tr>
          </thead>
          <tbody>
            {(aggregated as any[]).map((row, i) => {
              const [, tierName, tierIcon] = getTier(row.score)
              const initials = (row.user_id as string).slice(0, 2).toUpperCase()

              return (
                <tr key={row.user_id} className="border-t border-border hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        {initials}
                      </div>
                      <span className="text-gray-300 font-mono text-xs">{(row.user_id as string).slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs">{tierIcon} {tierName}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{row.score.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.total_wins}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{row.best_streak}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
