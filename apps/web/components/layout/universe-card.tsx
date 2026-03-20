import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Universe } from '@guessle/shared'

interface UniverseCardProps {
  universe: Universe
}

const MODE_LABELS: Record<string, string> = {
  classic: 'Classic', silhouette: 'Silhouette', quote: 'Quote',
  ability: 'Ability', splash: 'Splash', build: 'Build',
  'skill-order': 'Skill', quadra: 'Quadra', 'devil-fruit': 'Devil Fruit',
  wanted: 'Wanted', laugh: 'Laugh', jutsu: 'Jutsu', eye: 'Eye',
  voice: 'Voice', 'cursed-technique': 'Cursed', eyes: 'Eyes', cry: 'Cry',
  kirby: 'Kirby', 'final-smash': 'Final Smash', item: 'Item',
  location: 'Location', music: 'Music', game: 'Game', sound: 'Sound',
  level: 'Level', weapon: 'Weapon', roar: 'Roar', weakness: 'Weakness',
  screenshot: 'Screenshot', cover: 'Cover', soundtrack: 'Soundtrack',
  complete: 'Complete', fix: 'Fix', output: 'Output',
}

export function UniverseCard({ universe }: UniverseCardProps) {
  const color = universe.color ?? '#7C3AED'

  return (
    <Link href={`/games/${universe.slug}`} className="group block h-full">
      <div
        className="relative h-full bg-surface border border-white/5 rounded-xl p-5 transition-all duration-300 cursor-pointer overflow-hidden"
        style={{
          '--universe-color': color,
        } as CSSProperties}
      >
        {/* Hover glow overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${color}15 0%, transparent 70%)`,
            boxShadow: `inset 0 0 30px ${color}10`,
          }}
        />
        {/* Border glow on hover */}
        <div
          className="absolute inset-0 rounded-xl border opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ borderColor: `${color}60` }}
        />

        <div className="relative">
          {/* Icon */}
          <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300 inline-block">
            {universe.icon}
          </div>

          {/* Name */}
          <h3 className="font-display text-white text-base mb-1 tracking-wide group-hover:text-white transition-colors duration-200">
            {universe.name}
          </h3>

          {/* Mode count */}
          <p className="text-xs text-slate-500 mb-3 font-medium">
            {universe.modes.length} {universe.modes.length === 1 ? 'modo' : 'modos'}
          </p>

          {/* Mode pills */}
          <div className="flex flex-wrap gap-1">
            {universe.modes.slice(0, 3).map(mode => (
              <span
                key={mode}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `${color}15`,
                  color: `${color}CC`,
                  border: `1px solid ${color}25`,
                }}
              >
                {MODE_LABELS[mode] ?? mode}
              </span>
            ))}
            {universe.modes.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500 border border-white/5">
                +{universe.modes.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
