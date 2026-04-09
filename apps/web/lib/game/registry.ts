import type { ComponentType } from 'react'

export type ModeComponentProps = {
  challenge:    any
  config:       { slug: string; label: string; maxAttempts: number | null; lives?: number }
  submitGuess?: (value: string) => Promise<any>
  loading?:     boolean
}

const registry: Record<string, () => Promise<{ default: ComponentType<ModeComponentProps> }>> = {
  classic:            () => import('@/components/modes/ClassicMode'),
  silhouette:         () => import('@/components/modes/SilhouetteMode'),
  quote:              () => import('@/components/modes/QuoteMode'),
  splash:             () => import('@/components/modes/SplashMode'),
  ability:            () => import('@/components/modes/AbilityMode'),
  build:              () => import('@/components/modes/BuildMode'),
  'skill-order':      () => import('@/components/modes/SkillOrderMode'),
  quadra:             () => import('@/components/modes/QuadraMode'),
  'devil-fruit':      () => import('@/components/modes/ClassicMode'),
  wanted:             () => import('@/components/modes/WantedMode'),
  laugh:              () => import('@/components/modes/AudioMode'),
  jutsu:              () => import('@/components/modes/JutsuMode'),
  eye:                () => import('@/components/modes/EyeMode'),
  voice:              () => import('@/components/modes/AudioMode'),
  'cursed-technique': () => import('@/components/modes/AbilityMode'),
  eyes:               () => import('@/components/modes/SilhouetteMode'),
  cry:                () => import('@/components/modes/AudioMode'),
  'pokemon-classic':     () => import('@/components/modes/PokemonClassicMode'),
  'pokemon-card':        () => import('@/components/modes/PokemonCardMode'),
  'pokemon-description': () => import('@/components/modes/PokemonDescriptionMode'),
  'pokemon-silhouette':  () => import('@/components/modes/PokemonSilhouetteMode'),
  'monsterhunter-classic':     () => import('@/components/modes/MonsterHunterClassicMode'),
  'monsterhunter-description': () => import('@/components/modes/MonsterHunterDescriptionMode'),
  'monsterhunter-silhouette':  () => import('@/components/modes/MonsterHunterSilhouetteMode'),
  kirby:              () => import('@/components/modes/KirbyMode'),
  'final-smash':      () => import('@/components/modes/FinalSmashMode'),
  item:               () => import('@/components/modes/AbilityMode'),
  location:           () => import('@/components/modes/SilhouetteMode'),
  music:              () => import('@/components/modes/AudioMode'),
  game:               () => import('@/components/modes/ClassicMode'),
  sound:              () => import('@/components/modes/AudioMode'),
  level:              () => import('@/components/modes/SilhouetteMode'),
  weapon:             () => import('@/components/modes/AbilityMode'),
  roar:               () => import('@/components/modes/AudioMode'),
  weakness:           () => import('@/components/modes/WeaknessMode'),
  screenshot:         () => import('@/components/modes/SplashMode'),
  cover:              () => import('@/components/modes/SplashMode'),
  soundtrack:         () => import('@/components/modes/AudioMode'),
  complete:           () => import('@/components/modes/CodeMode'),
  fix:                () => import('@/components/modes/CodeMode'),
  output:             () => import('@/components/modes/CodeMode'),
}

export const MODE_CONFIGS: Record<string, { label: string; maxAttempts: number | null; lives?: number }> = {
  classic:            { label: 'Classic',     maxAttempts: null },
  silhouette:         { label: 'Silhouette',  maxAttempts: null },
  quote:              { label: 'Quote',       maxAttempts: null },
  splash:             { label: 'Splash',      maxAttempts: null },
  ability:            { label: 'Ability',     maxAttempts: null },
  build:              { label: 'Build',       maxAttempts: null },
  'skill-order':      { label: 'Detective',   maxAttempts: null },
  quadra:             { label: 'Quadra',      maxAttempts: null, lives: 4 },
  'devil-fruit':      { label: 'Devil Fruit', maxAttempts: null },
  wanted:             { label: 'Wanted',      maxAttempts: null },
  laugh:              { label: 'Laugh',       maxAttempts: null },
  jutsu:              { label: 'Jutsu',       maxAttempts: null },
  eye:                { label: 'Eye',         maxAttempts: null },
  voice:              { label: 'Voice',       maxAttempts: null },
  'cursed-technique': { label: 'Cursed',      maxAttempts: null },
  eyes:               { label: 'Eyes',        maxAttempts: null },
  cry:                { label: 'Cry',         maxAttempts: null },
  'pokemon-classic':     { label: 'Classic',     maxAttempts: null },
  'pokemon-card':        { label: 'Card',         maxAttempts: null },
  'pokemon-description': { label: 'Description',  maxAttempts: null },
  'pokemon-silhouette':  { label: 'Silhouette',   maxAttempts: null },
  'monsterhunter-classic':     { label: 'Classic',      maxAttempts: null },
  'monsterhunter-description': { label: 'Description',  maxAttempts: null },
  'monsterhunter-silhouette':  { label: 'Silhouette',   maxAttempts: null },
  kirby:              { label: 'Kirby',       maxAttempts: null },
  'final-smash':      { label: 'Final Smash', maxAttempts: null },
  item:               { label: 'Item',        maxAttempts: null },
  location:           { label: 'Location',    maxAttempts: null },
  music:              { label: 'Music',       maxAttempts: null },
  game:               { label: 'Game',        maxAttempts: null },
  sound:              { label: 'Sound',       maxAttempts: null },
  level:              { label: 'Level',       maxAttempts: null },
  weapon:             { label: 'Weapon',      maxAttempts: null },
  roar:               { label: 'Roar',        maxAttempts: null },
  weakness:           { label: 'Weakness',    maxAttempts: null },
  screenshot:         { label: 'Screenshot',  maxAttempts: null },
  cover:              { label: 'Cover',       maxAttempts: null },
  soundtrack:         { label: 'Soundtrack',  maxAttempts: null },
  complete:           { label: 'Complete',    maxAttempts: 3 },
  fix:                { label: 'Fix',         maxAttempts: 3 },
  output:             { label: 'Output',      maxAttempts: 3 },
}

const gamedleRegistry: Record<string, () => Promise<{ default: ComponentType<ModeComponentProps> }>> = {
  classic:    () => import('@/components/modes/GameClassicMode'),
  screenshot: () => import('@/components/modes/GameImageMode'),
  cover:      () => import('@/components/modes/GameImageMode'),
  soundtrack: () => import('@/components/modes/GameAudioMode'),
}

export function getModeLoader(slug: string, universeSlug?: string) {
  if (universeSlug === 'gamedle' && gamedleRegistry[slug]) return gamedleRegistry[slug]
  return registry[slug] ?? registry.classic
}
