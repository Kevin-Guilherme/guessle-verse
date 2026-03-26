import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUniverse } from '@/lib/constants/universes'
import { getGameDay } from '@/lib/utils/gameDay'
import { ModeGrid } from '@/components/game/ModeGrid'

export const revalidate = 3600

interface Props {
  params: { slug: string }
}

const MODE_META: Record<string, { label: string; description: string }> = {
  classic:            { label: 'Classic',          description: 'Adivinhe pelos atributos'          },
  silhouette:         { label: 'Silhouette',        description: 'Identifique pela silhueta'         },
  quote:              { label: 'Quote',             description: 'Adivinhe pela frase'               },
  ability:            { label: 'Ability',           description: 'Identifique pela habilidade'       },
  splash:             { label: 'Splash Art',        description: 'Adivinhe pelo splash art'          },
  build:              { label: 'Build',             description: 'Identifique pelos itens'           },
  'skill-order':      { label: 'Detective',          description: 'Identifique pelos itens do build'  },
  quadra:             { label: 'Quadra Kill',       description: 'Classic com 4 vidas'              },
  'devil-fruit':      { label: 'Devil Fruit',       description: 'Identifique pela fruta'           },
  wanted:             { label: 'Wanted',            description: 'Poster de procurado'              },
  laugh:              { label: 'Laugh',             description: 'Adivinhe pelo riso'               },
  jutsu:              { label: 'Jutsu',             description: 'Identifique pelo jutsu'           },
  eye:                { label: 'Eye',               description: 'Adivinhe pelo dojutsu'           },
  voice:              { label: 'Voice',             description: 'Identifique pela voz'            },
  'cursed-technique': { label: 'Cursed Technique',  description: 'Identifique pela tecnica'        },
  eyes:               { label: 'Eyes',              description: 'Identifique pelos olhos'         },
  cry:                { label: 'Cry',               description: 'Adivinhe pelo grito'             },
  kirby:              { label: 'Kirby',             description: 'Kirby copiou a habilidade'       },
  'final-smash':      { label: 'Final Smash',       description: 'Identifique pelo Final Smash'    },
  item:               { label: 'Item',              description: 'Identifique pelo item'           },
  location:           { label: 'Location',          description: 'Adivinhe pelo local'             },
  music:              { label: 'Music',             description: 'Identifique pela musica'         },
  game:               { label: 'Game',              description: 'Adivinhe pelo jogo'              },
  sound:              { label: 'Sound',             description: 'Identifique pelo som'            },
  level:              { label: 'Level',             description: 'Adivinhe pela fase'              },
  weapon:             { label: 'Weapon',            description: 'Identifique pela arma'           },
  roar:               { label: 'Roar',              description: 'Identifique pelo rugido'         },
  weakness:           { label: 'Weakness',          description: 'Identifique pelas fraquezas'     },
  screenshot:         { label: 'Screenshot',        description: 'Adivinhe pelo screenshot'        },
  cover:              { label: 'Cover',             description: 'Adivinhe pela capa'              },
  soundtrack:         { label: 'Soundtrack',        description: 'Identifique pela trilha sonora'  },
  complete:           { label: 'Complete',          description: 'Complete o codigo'               },
  fix:                { label: 'Fix',               description: 'Corrija o bug'                   },
  output:             { label: 'Output',            description: 'Qual e a saida?'                 },
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
  const today    = getGameDay()

  const { data: theme } = await supabase
    .from('themes')
    .select('id')
    .eq('slug', params.slug)
    .single()

  const { data: challenges } = theme
    ? await supabase
        .from('daily_challenges')
        .select('id, mode')
        .eq('theme_id', theme.id)
        .eq('date', today)
        .in('mode', universe.modes)
    : { data: null }

  const modesWithChallenge = new Set(challenges?.map(c => c.mode) ?? [])
  // Map mode → challenge id so the client component can check completion per mode
  const challengeIds: Record<string, number> = Object.fromEntries(
    (challenges ?? []).map(c => [c.mode, c.id])
  )
  const color = universe.color ?? '#7C3AED'

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-neon-purple-light transition-colors duration-200 font-display tracking-wider mb-8 group"
      >
        <span className="group-hover:-translate-x-1 transition-transform duration-200">←</span>
        VOLTAR
      </Link>

      {/* Universe header */}
      <div className="relative rounded-2xl border border-white/5 bg-surface overflow-hidden p-8 mb-8">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at 0% 50%, ${color}30 0%, transparent 60%)`,
          }}
        />
        <div className="relative flex items-center gap-5">
          <span className="text-5xl">{universe.icon}</span>
          <div>
            <h1 className="font-display text-3xl text-white tracking-wide mb-1">{universe.name.toUpperCase()}</h1>
            <p className="text-slate-400 text-sm">
              {universe.modes.length} modos &middot; {modesWithChallenge.size} disponíveis hoje
            </p>
          </div>
        </div>
      </div>

      {/* Modes grid — client component handles per-mode completion checkmarks */}
      <ModeGrid
        slug={universe.slug}
        color={color}
        modes={universe.modes}
        challengeIds={challengeIds}
        modeMeta={MODE_META}
      />
    </div>
  )
}
