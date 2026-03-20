import Link from 'next/link'
import type { Universe } from '@guessle/shared'

interface UniverseCardProps {
  universe: Universe
}

const MODE_LABELS: Record<string, string> = {
  classic:            'Classic',
  silhouette:         'Silhouette',
  quote:              'Quote',
  ability:            'Ability',
  splash:             'Splash',
  build:              'Build',
  'skill-order':      'Skill Order',
  quadra:             'Quadra',
  'devil-fruit':      'Devil Fruit',
  wanted:             'Wanted',
  laugh:              'Laugh',
  jutsu:              'Jutsu',
  eye:                'Eye',
  voice:              'Voice',
  'cursed-technique': 'Cursed Technique',
  eyes:               'Eyes',
  cry:                'Cry',
  kirby:              'Kirby',
  'final-smash':      'Final Smash',
  item:               'Item',
  location:           'Location',
  music:              'Music',
  game:               'Game',
  sound:              'Sound',
  level:              'Level',
  weapon:             'Weapon',
  roar:               'Roar',
  weakness:           'Weakness',
  screenshot:         'Screenshot',
  cover:              'Cover',
  soundtrack:         'Soundtrack',
  complete:           'Complete',
  fix:                'Fix',
  output:             'Output',
}

export function UniverseCard({ universe }: UniverseCardProps) {
  return (
    <Link href={`/games/${universe.slug}`}>
      <div
        className="group relative bg-bg-surface border border-border rounded-xl p-5 hover:border-gray-500 transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full"
      >
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"
          style={{ backgroundColor: universe.color }}
        />
        <div className="relative">
          <div className="text-4xl mb-3">{universe.icon}</div>
          <h3 className="font-bold text-white text-lg mb-1">{universe.name}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {universe.modes.length} {universe.modes.length === 1 ? 'modo' : 'modos'}
          </p>
          <div className="flex flex-wrap gap-1">
            {universe.modes.slice(0, 3).map(mode => (
              <span
                key={mode}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400"
              >
                {MODE_LABELS[mode] ?? mode}
              </span>
            ))}
            {universe.modes.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
                +{universe.modes.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
