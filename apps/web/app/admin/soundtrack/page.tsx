'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Game {
  id: number
  name: string
  audio_url: string | null
  youtube_id: string | null
}

type AudioStatus = 'idle' | 'loading' | 'ok' | 'error'

function AudioRow({ game }: { game: Game }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [status, setStatus] = useState<AudioStatus>('idle')
  const [playing, setPlaying] = useState(false)

  const hasSource = !!(game.audio_url || game.youtube_id)

  async function test() {
    if (!game.audio_url) return
    setStatus('loading')
    const a = audioRef.current!
    a.src = game.audio_url
    try {
      await a.play()
      setStatus('ok')
      setPlaying(true)
      setTimeout(() => { a.pause(); a.currentTime = 0; setPlaying(false) }, 5000)
    } catch {
      setStatus('error')
    }
  }

  const statusColor = {
    idle:    'text-slate-500',
    loading: 'text-yellow-400',
    ok:      'text-green-400',
    error:   'text-red-400',
  }[status]

  const statusLabel = {
    idle:    '—',
    loading: '⏳',
    ok:      '✓ OK',
    error:   '✗ Erro',
  }[status]

  const sourceType = game.audio_url?.includes('supabase')
    ? 'storage'
    : game.audio_url?.includes('dzcdn')
    ? 'deezer'
    : game.youtube_id
    ? 'youtube'
    : 'none'

  const sourceColor = {
    storage: 'bg-green-500/20 text-green-300 border-green-500/30',
    deezer:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    youtube: 'bg-red-500/20 text-red-300 border-red-500/30',
    none:    'bg-slate-500/10 text-slate-500 border-slate-500/20',
  }[sourceType]

  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-2.5 text-sm text-slate-300 font-display">{game.name}</td>
      <td className="px-4 py-2.5">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${sourceColor}`}>
          {sourceType}
        </span>
      </td>
      <td className="px-4 py-2.5 max-w-xs">
        {game.audio_url ? (
          <span className="text-[10px] text-slate-600 font-mono truncate block">
            {game.audio_url.slice(0, 60)}…
          </span>
        ) : (
          <span className="text-[10px] text-slate-700">sem URL</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <audio ref={audioRef} preload="none" />
        <div className="flex items-center gap-2">
          {game.audio_url && (
            <button
              onClick={test}
              disabled={playing || status === 'loading'}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-40 text-slate-300"
            >
              {playing ? '▶ 5s...' : '▶ Testar'}
            </button>
          )}
          <span className={`text-xs font-mono ${statusColor}`}>{statusLabel}</span>
        </div>
      </td>
    </tr>
  )
}

export default function SoundtrackAdminPage() {
  const [games, setGames]       = useState<Game[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'storage' | 'deezer' | 'none'>('all')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('gamedle_pool')
      .select('id, name, audio_url, youtube_id')
      .eq('active', true)
      .order('name')
      .then(({ data }) => { setGames(data ?? []); setLoading(false) })
  }, [])

  const stats = {
    total:   games.length,
    storage: games.filter(g => g.audio_url?.includes('supabase')).length,
    deezer:  games.filter(g => g.audio_url?.includes('dzcdn')).length,
    youtube: games.filter(g => g.youtube_id && !g.audio_url).length,
    none:    games.filter(g => !g.audio_url && !g.youtube_id).length,
  }

  const filtered = games.filter(g => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'storage') return g.audio_url?.includes('supabase')
    if (filter === 'deezer')  return g.audio_url?.includes('dzcdn')
    if (filter === 'none')    return !g.audio_url && !g.youtube_id
    return true
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="font-display text-2xl text-white tracking-wide">Soundtrack — Validação de Áudio</h1>
        <p className="text-slate-500 text-sm mt-1">Gamedle pool · {stats.total} jogos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Storage (✓)', value: stats.storage, color: 'text-green-400' },
          { label: 'Deezer (exp)', value: stats.deezer,  color: 'text-yellow-400' },
          { label: 'YouTube',     value: stats.youtube, color: 'text-red-400' },
          { label: 'Sem fonte',   value: stats.none,    color: 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-white/5 rounded-xl p-4">
            <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar jogo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 outline-none focus:border-white/30 w-56"
        />
        <div className="flex gap-1.5">
          {(['all', 'storage', 'deezer', 'none'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-3 py-1.5 rounded-lg font-display tracking-widest uppercase transition-colors ${
                filter === f ? 'bg-neon-purple text-white' : 'bg-surface border border-white/10 text-slate-400 hover:border-white/30'
              }`}
            >
              {f === 'all' ? 'Todos' : f}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} jogos</span>
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-slate-500 text-sm">Carregando...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="px-4 py-3 text-left text-[10px] font-display tracking-widest text-slate-600 uppercase">Jogo</th>
                <th className="px-4 py-3 text-left text-[10px] font-display tracking-widest text-slate-600 uppercase">Fonte</th>
                <th className="px-4 py-3 text-left text-[10px] font-display tracking-widest text-slate-600 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-[10px] font-display tracking-widest text-slate-600 uppercase">Teste</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => <AudioRow key={g.id} game={g} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
