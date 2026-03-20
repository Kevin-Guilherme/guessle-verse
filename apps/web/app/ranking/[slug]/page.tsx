import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'

export const revalidate = 300

interface Props {
  params: { slug: string }
}

const TIERS: [number, string, string][] = [
  [50000, 'Diamond',  'Diamond'],
  [30000, 'Platinum', 'Platinum'],
  [15000, 'Gold',     'Gold'],
  [5000,  'Silver',   'Silver'],
  [0,     'Bronze',   'Bronze'],
]

function getTier(score: number) {
  return TIERS.find(([min]) => score >= min) ?? TIERS[TIERS.length - 1]
}

export default async function UniverseRankingPage({ params }: Props) {
  const universe = getUniverse(params.slug)
  if (!universe) notFound()

  const service = createServiceClient()

  const { data: theme } = await service
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  if (!theme) notFound()

  const { data: rows } = await service
    .from('rankings')
    .select('user_id, score, total_wins, total_games, best_streak, win_rate, avg_attempts')
    .eq('theme_id', theme.id)
    .order('score', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link href="/ranking" className="text-sm text-gray-500 hover:text-gray-300">&larr; Ranking Global</Link>
        <h1 className="text-2xl font-bold text-white mt-2">{universe.icon} {universe.name} &mdash; Ranking</h1>
      </div>

      {(!rows || rows.length === 0) ? (
        <p className="text-gray-500">Nenhum jogador nesse universo ainda.</p>
      ) : (
        <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-gray-500 text-xs uppercase">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Jogador</th>
                <th className="px-4 py-3 text-right">Tier</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Win%</th>
                <th className="px-4 py-3 text-right">Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const [, tierName] = getTier(row.score ?? 0)
                const initials = row.user_id.slice(0, 2).toUpperCase()
                return (
                  <tr key={row.user_id} className="border-t border-border hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                          {initials}
                        </div>
                        <span className="text-gray-300 font-mono text-xs">{row.user_id.slice(0, 8)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">{tierName}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{(row.score ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{row.win_rate != null ? `${Number(row.win_rate).toFixed(1)}%` : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{row.best_streak ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
