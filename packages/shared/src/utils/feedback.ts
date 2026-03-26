import type { FeedbackType } from '../types/game.types'

export function computeFeedback(
  guessValue: unknown,
  targetValue: unknown,
  compareMode: 'exact' | 'partial' | 'arrow'
): FeedbackType {
  switch (compareMode) {
    case 'exact':
      return guessValue === targetValue ? 'correct' : 'wrong'

    case 'partial':
      if (Array.isArray(guessValue) && Array.isArray(targetValue)) {
        const hit = (guessValue as string[]).filter(v => (targetValue as string[]).includes(v))
        if (guessValue.length === targetValue.length && hit.length === targetValue.length) return 'correct'
        if (hit.length > 0) return 'partial'
        return 'wrong'
      }
      return guessValue === targetValue ? 'correct' : 'wrong'

    case 'arrow': {
      const g = Number(guessValue)
      const t = Number(targetValue)
      if (isNaN(g) || isNaN(t)) return 'wrong'
      if (g === t) return 'correct'
      return g < t ? 'higher' : 'lower'
    }
  }
}
