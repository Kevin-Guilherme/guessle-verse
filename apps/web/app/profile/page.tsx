import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: sessions } = await supabase
    .from('game_sessions')
    .select('*, daily_challenges(mode, themes(name, icon))')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
        <p className="text-gray-400 text-sm mt-1">{user.email}</p>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Historico recente</h2>
      {(!sessions || sessions.length === 0) ? (
        <p className="text-gray-500">Nenhuma partida concluida ainda.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any) => (
            <div key={s.id} className="bg-bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-white font-medium">
                  {s.daily_challenges?.themes?.icon} {s.daily_challenges?.themes?.name} &mdash; {s.daily_challenges?.mode}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(s.started_at).toLocaleDateString('pt-BR')} &middot; {s.attempts} tentativas
                </p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${s.won ? 'text-correct' : 'text-red-400'}`}>
                  {s.won ? `+${s.score} pts` : 'Derrota'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
