import { create } from 'zustand'
import type { AttributeFeedback } from '@guessle/shared'

interface GuessEntry {
  value: string
  feedback: AttributeFeedback[]
}

interface GameState {
  guesses:   GuessEntry[]
  attempts:  number
  hintsUsed: number
  won:       boolean
  lost:      boolean
  score:     number | null
  addGuess:  (entry: GuessEntry) => void
  setWon:    (score: number) => void
  setLost:   () => void
  reset:     () => void
  hydrate:   (state: Partial<Pick<GameState, 'guesses' | 'attempts' | 'hintsUsed' | 'won' | 'lost' | 'score'>>) => void
}

const initial = {
  guesses:   [] as GuessEntry[],
  attempts:  0,
  hintsUsed: 0,
  won:       false,
  lost:      false,
  score:     null as number | null,
}

export const useGameStore = create<GameState>((set) => ({
  ...initial,
  addGuess: (entry) =>
    set((s) => ({ guesses: [...s.guesses, entry], attempts: s.attempts + 1 })),
  setWon: (score) => set({ won: true, score }),
  setLost: ()    => set({ lost: true }),
  reset:   ()    => set(initial),
  hydrate: (state) => set((s) => ({ ...s, ...state })),
}))
