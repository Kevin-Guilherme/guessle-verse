# Engine de Jogo

## Fluxo Completo

```
1. RSC renderiza shell (/games/[slug]/[mode]) com challengeId
2. GameClient monta -> useGameSession -> POST /api/session
3. useGameSession hidrata Zustand se attempts > 0 || completedAt
4. Modo carregado via lazy import (getModeLoader(slug))
5. Usuario faz guess -> useGuess -> POST /api/guess
6. /api/guess computa feedback server-side (computeFeedback)
7. Resposta: { feedback, won, score } -> atualiza Zustand
8. GuessRow + AttributeCell renderizam historico com animacao flip
```

---

## computeFeedback (packages/shared)

Tres modos de comparacao:
- `exact` -> correct | wrong
- `partial` -> correct | partial | wrong (array intersection)
- `arrow` -> correct | higher | lower (numerico)

Roda **server-side** em `/api/guess`. Cliente apenas renderiza o resultado.

---

## Scoring

```
base:              1000 pts
penalty/wrong:      -40 pts
hint 1 (apos 5):  -150 pts
hint 2 (apos 10): -200 pts
minimo:             50 pts
```

**Code modes:** sem hints, max 3 tentativas.

---

## API Routes

### POST /api/session
- Requer autenticacao (cookie Supabase)
- INSERT game_session ON CONFLICT DO NOTHING
- Retorna: `{ sessionId, attempts, hintsUsed, won, completedAt }`

### POST /api/guess
- Auth opcional (unauthenticated = sem writes no DB)
- Carrega daily_challenge, computa feedback
- Autentico: upsert session, insert guess, se correto: UPDATE completed_at + score
- Retorna: `{ feedback: AttributeFeedback[], won, score? }`

### GET /api/session/guesses?sessionId=X
- Retorna historico de guesses para hidratar Zustand ao voltar ao modo

---

## Anti-Repeticao

- Janela de 60 dias por `theme_id + mode`
- Code modes: lookback por `content_hash` (SHA-256 do codigo)
- Constraint `unique(theme_id, mode, content_hash)` no DB garante seguranca contra concurrent inserts

---

## Ranking Trigger

Dispara em `UPDATE OF completed_at` (nunca no INSERT).
Calcula incrementalmente:
- `win_rate = (total_wins + increment) / (total_games + 1) * 100`
- `avg_attempts = (avg_attempts * total_games + new.attempts) / (total_games + 1)`
- Streak: per theme (qualquer modo conta)
