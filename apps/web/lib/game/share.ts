const EMOJI: Record<string, string> = {
  correct: '🟩',
  partial: '🟨',
  wrong:   '⬛',
  higher:  '⬆️',
  lower:   '⬇️',
}

export function generateShareText(
  universeName: string,
  mode: string,
  attempts: number,
  won: boolean,
  guesses: Array<{ feedback: Array<{ feedback: string }> }>
): string {
  const header = `Guessle — ${universeName} (${mode})`
  const result = won ? `${attempts}/∞` : 'X'
  const rows   = guesses.map((g) =>
    g.feedback.map((f) => EMOJI[f.feedback] ?? '⬜').join('')
  )
  return [header, result, ...rows].join('\n')
}
