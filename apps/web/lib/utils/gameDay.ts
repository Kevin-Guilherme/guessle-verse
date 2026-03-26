/** Retorna a string de data do desafio ativo (reseta às 07:00 UTC). */
export function getGameDay(): string {
  const now = new Date()
  if (now.getUTCHours() < 7) {
    const yesterday = new Date(now)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
  return now.toISOString().split('T')[0]
}
