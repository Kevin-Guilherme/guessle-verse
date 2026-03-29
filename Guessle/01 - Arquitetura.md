# Arquitetura

## Monorepo

```
guessle-verse/
├── apps/web/          # Next.js 14 App Router
├── packages/shared/   # types + feedback utils (computeFeedback)
└── supabase/          # migrations + edge functions + seed
```

**Build tool:** Turborepo + pnpm workspaces

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| State | Zustand (UI state) + TanStack Query v5 (server state) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase Postgres + RLS |
| Edge Functions | Deno (Supabase) |
| Deploy | Vercel (web) + Supabase (infra) |

---

## Decisoes Criticas

1. **Frontend nao chama APIs externas** — tudo passa por Supabase
2. **Guess validation e server-side** — `/api/guess` valida e persiste; cliente nao computa resultado
3. **Usuarios nao autenticados podem jogar** — estado fica em Zustand (memoria), sem writes no DB
4. **Sessions sao inseridas com `completed_at = null`** — trigger de ranking so dispara no UPDATE
5. **`daily_challenges` armazena snapshot completo** — nao apenas FK para `characters`
6. **Mode Registry pattern** — `registry.ts` mapeia slug -> dynamic import; adicionar modo = 1 arquivo + 1 entrada

---

## Camadas de Acesso

```
RSC (Server Components)
  -> /games/[slug]          ISR 1h
  -> /games/[slug]/[mode]   ISR 24h (shell)
  -> /ranking               ISR 5min

Client Components
  -> GameClient (orquestrador)
  -> useGameSession -> /api/session
  -> useGuess -> /api/guess

API Routes (Next.js)
  -> POST /api/guess         (server-side feedback + persist)
  -> POST /api/session       (create/recover session)
  -> GET  /api/session/guesses
  -> GET  /api/characters    (autocomplete)
  -> GET  /api/skins         (splash mode)

Edge Functions (Supabase/Deno)
  -> cron-daily-challenges   (0 10 * * * UTC)
  -> refresh-catalog         (0 3 * * 0 UTC)
  -> generate-code-puzzle    (chamado pelo cron)
```

---

## Database — Tabelas Principais

| Tabela | Finalidade |
|--------|-----------|
| `themes` | 14 universos |
| `characters` | Personagens scrapeados (attributes + extra jsonb) |
| `gamedle_pool` | 150 jogos curados para Gamedle |
| `daily_challenges` | Snapshot diario por tema+modo |
| `game_sessions` | Sessao de jogo por usuario+challenge |
| `guesses` | Historico de tentativas |
| `rankings` | Agregado de stats por usuario+tema |

**Trigger:** `fn_update_ranking` dispara em `UPDATE OF completed_at` — calcula streak, win_rate, avg_attempts incrementalmente.
