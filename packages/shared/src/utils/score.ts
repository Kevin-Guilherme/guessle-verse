const SCORE_CONFIG = {
  base:              1000,
  penaltyPerAttempt:   40,
  penaltyHint1:       150,
  penaltyHint2:       200,
  minScore:            50,
}

export function calculateScore(attempts: number, hintsUsed: number): number {
  const attemptPenalty = (attempts - 1) * SCORE_CONFIG.penaltyPerAttempt
  const hintPenalty    = (hintsUsed >= 1 ? SCORE_CONFIG.penaltyHint1 : 0)
                       + (hintsUsed >= 2 ? SCORE_CONFIG.penaltyHint2 : 0)
  return Math.max(SCORE_CONFIG.base - attemptPenalty - hintPenalty, SCORE_CONFIG.minScore)
}

export function shouldRevealHint(attempts: number): 1 | 2 | null {
  if (attempts >= 10) return 2
  if (attempts >= 5)  return 1
  return null
}
