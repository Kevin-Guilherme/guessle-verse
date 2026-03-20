import type { Universe } from '@guessle/shared'

export const UNIVERSES: Universe[] = [
  { slug: 'lol',           name: 'LoLdle',        icon: '⚔️',  color: '#C89B3C', type: 'character', modes: ['classic','quote','ability','splash','build','skill-order','quadra'] },
  { slug: 'naruto',        name: 'Narutodle',      icon: '🍥',  color: '#FF6B2B', type: 'character', modes: ['classic','jutsu','quote','eye','voice'] },
  { slug: 'onepiece',      name: 'OnePiecedle',    icon: '🏴‍☠️', color: '#E8C84A', type: 'character', modes: ['classic','devil-fruit','wanted','laugh'] },
  { slug: 'jujutsu',       name: 'Jujutsudle',     icon: '🩸',  color: '#8B5CF6', type: 'character', modes: ['classic','cursed-technique','quote','eyes'] },
  { slug: 'pokemon',       name: 'Pokédle',         icon: '⚡',  color: '#FFCC02', type: 'character', modes: ['classic','silhouette','ability','cry'] },
  { slug: 'smash',         name: 'Smashdle',        icon: '🥊',  color: '#E8534A', type: 'character', modes: ['classic','silhouette','kirby','final-smash'] },
  { slug: 'zelda',         name: 'Zeldadle',        icon: '🧝',  color: '#4ADE80', type: 'character', modes: ['classic','item','location','music'] },
  { slug: 'mario',         name: 'Mariodle',        icon: '⭐',  color: '#EF4444', type: 'character', modes: ['classic','game','sound','level'] },
  { slug: 'gow',           name: 'GoWdle',           icon: '🪓',  color: '#DC2626', type: 'character', modes: ['classic','weapon','voice','quote'] },
  { slug: 'monsterhunter', name: 'MHdle',            icon: '🐉',  color: '#F97316', type: 'character', modes: ['classic','silhouette','roar','weakness'] },
  { slug: 'gamedle',       name: 'Gamedle',          icon: '🕹️', color: '#6366F1', type: 'game',      modes: ['classic','screenshot','cover','soundtrack'] },
  { slug: 'js',            name: 'JSdle',            icon: '🟨',  color: '#F7DF1E', type: 'code',      modes: ['complete','fix','output'] },
  { slug: 'ts',            name: 'TSdle',            icon: '🟦',  color: '#3178C6', type: 'code',      modes: ['complete','fix','output'] },
  { slug: 'python',        name: 'Pythondle',        icon: '🐍',  color: '#3B82F6', type: 'code',      modes: ['complete','fix','output'] },
]

export function getUniverse(slug: string): Universe | undefined {
  return UNIVERSES.find(u => u.slug === slug)
}
