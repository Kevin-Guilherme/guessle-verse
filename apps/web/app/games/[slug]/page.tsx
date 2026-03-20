import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'

export const revalidate = 3600

interface Props {
  params: { slug: string }
}

const MODE_META: Record<string, { label: string; description: string; icon: string }> = {
  classic:            { label: 'Classic',          description: 'Adivinhe pelos atributos',            icon: '🎯' },
  silhouette:         { label: 'Silhouette',        description: 'Identifique pela silhueta',           icon: '👤' },
  quote:              { label: 'Quote',             description: 'Adivinhe pela frase',                 icon: '💬' },
  ability:            { label: 'Ability',           description: 'Identifique pela habilidade',         icon: '✨' },
  splash:             { label: 'Splash Art',        description: 'Adivinhe pelo splash art',            icon: '🖼️' },
  build:              { label: 'Build',             description: 'Identifique pelos itens',             icon: '🛡️' },
  'skill-order':      { label: 'Skill Order',       description: 'Identifique pela ordem de skills',   icon: '📋' },
  quadra:             { label: 'Quadra Kill',       description: 'Classic com 4 vidas',                 icon: '💀' },
  'devil-fruit':      { label: 'Devil Fruit',       description: 'Identifique pela fruta do diabo',    icon: '🍎' },
  wanted:             { label: 'Wanted',            description: 'Adivinhe pelo poster de procurado',  icon: '📜' },
  laugh:              { label: 'Laugh',             description: 'Adivinhe pelo riso',                  icon: '😂' },
  jutsu:              { label: 'Jutsu',             description: 'Identifique pelo jutsu',              icon: '🌀' },
  eye:                { label: 'Eye',              description: 'Adivinhe pelo dojutsu',               icon: '👁️' },
  voice:              { label: 'Voice',             description: 'Identifique pela voz',                icon: '🎤' },
  'cursed-technique': { label: 'Cursed Technique',  description: 'Identifique pela tecnica maldita',   icon: '🩸' },
  eyes:               { label: 'Eyes',             description: 'Identifique pelos olhos',             icon: '👁️' },
  cry:                { label: 'Cry',              description: 'Adivinhe pelo grito',                 icon: '🔊' },
  kirby:              { label: 'Kirby',            description: 'Kirby copiou a habilidade',           icon: '⭐' },
  'final-smash':      { label: 'Final Smash',      description: 'Identifique pelo Final Smash',       icon: '💥' },
  item:               { label: 'Item',             description: 'Identifique pelo item',               icon: '🗡️' },
  location:           { label: 'Location',         description: 'Adivinhe pelo local',                 icon: '🗺️' },
  music:              { label: 'Music',            description: 'Identifique pela musica',             icon: '🎵' },
  game:               { label: 'Game',             description: 'Adivinhe pelo jogo',                  icon: '🎮' },
  sound:              { label: 'Sound',            description: 'Identifique pelo som',                icon: '🔉' },
  level:              { label: 'Level',            description: 'Adivinhe pela fase',                  icon: '🗺️' },
  weapon:             { label: 'Weapon',           description: 'Identifique pela arma',               icon: '⚔️' },
  roar:               { label: 'Roar',             description: 'Identifique pelo rugido',             icon: '🦁' },
  weakness:           { label: 'Weakness',         description: 'Identifique pelas fraquezas',         icon: '⚡' },
  screenshot:         { label: 'Screenshot',       description: 'Adivinhe pelo screenshot',            icon: '📸' },
  cover:              { label: 'Cover',            description: 'Adivinhe pela capa',                  icon: '📦' },
  soundtrack:         { label: 'Soundtrack',       description: 'Identifique pela trilha sonora',      icon: '🎼' },
  complete:           { label: 'Complete',         description: 'Complete o codigo',                   icon: '✏️' },
  fix:                { label: 'Fix',              description: 'Corrija o bug',                       icon: '🐛' },
  output:             { label: 'Output',           description: 'Qual e a saida?',                     icon: '💻' },
}

export async function generateStaticParams() {
  const supabase = createServiceClient()
  const { data } = await supabase.from('themes').select('slug').eq('active', true)
  return data?.map(t => ({ slug: t.slug })) ?? []
}

export default async function UniverseHubPage({ params }: Props) {
  const universe = getUniverse(params.slug)
  if (!universe) notFound()

  const supabase = createClient()
  const today    = new Date().toISOString().split('T')[0]

  const { data: theme } = await supabase
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  const { data: challenges } = theme
    ? await supabase
        .from('daily_challenges')
        .select('mode')
        .eq('theme_id', theme.id)
        .eq('date', today)
        .in('mode', universe.modes)
    : { data: null }

  const modesWithChallenge = new Set(challenges?.map(c => c.mode) ?? [])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Voltar
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-5xl">{universe.icon}</span>
          <div>
            <h1 className="text-3xl font-extrabold text-white">{universe.name}</h1>
            <p className="text-gray-400 mt-1">
              {universe.modes.length} modos disponíveis
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {universe.modes.map(mode => {
          const meta      = MODE_META[mode]
          const available = modesWithChallenge.has(mode)

          const content = (
            <div className="flex items-start gap-4">
              <span className="text-3xl">{meta?.icon ?? '🎮'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">
                    {meta?.label ?? mode}
                  </h3>
                  {!available && (
                    <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                      Em breve
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5">
                  {meta?.description ?? ''}
                </p>
              </div>
            </div>
          )

          const cardClass = `group relative bg-bg-surface border rounded-xl p-5 transition-all duration-300 ${
            available
              ? 'border-border hover:border-gray-500 hover:-translate-y-0.5 cursor-pointer'
              : 'border-border opacity-50 cursor-not-allowed'
          }`

          return available ? (
            <Link key={mode} href={`/games/${universe.slug}/${mode}`} className={cardClass}>
              {content}
            </Link>
          ) : (
            <div key={mode} className={cardClass}>
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
