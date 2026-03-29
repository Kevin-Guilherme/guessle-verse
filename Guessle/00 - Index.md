# Guessle — Hub de Jogos Diários

**Repositório:** `guessle-verse` (monorepo Turborepo)
**Stack:** Next.js 14 App Router + Supabase (Postgres + Auth + Edge Functions) + Vercel
**Atualizado em:** 2026-03-24

---

## Navegacao

- [[01 - Arquitetura]] — Stack, monorepo, decisoes tecnicas
- [[02 - Universos e Modos]] — 14 universos, todos os modos por universo
- [[03 - Engine de Jogo]] — Registry, feedback, scoring, API routes
- [[04 - Pipeline de Dados]] — Cron, scrapers, Edge Functions
- [[05 - Status por Universo]] — Estado atual, dados completos ou nao
- [[06 - Gaps e Bugs]] — O que esta faltando, bugs conhecidos
- [[07 - Roadmap]] — Proximas tarefas priorizadas
- [[08 - Decisoes Tecnicas]] — ADRs e motivos por tras das escolhas

---

## Resumo Executivo

Guessle e uma plataforma no estilo Wordle com 14 universos tematicos.
Cada universo tem multiplos modos de jogo (classic, splash, quote, jutsu, etc).

**14 Universos:**
- Character (10): LoL, Naruto, One Piece, Jujutsu, Pokemon, Smash, Zelda, Mario, GoW, Monster Hunter
- Game (1): Gamedle
- Code (3): JSdle, TSdle, Pythondle

**44 slugs de modo** mapeados no registry -> 15 componentes (reuso via alias).

**Status geral:**
- LoL: Corrigido (10 fixes aplicados)
- Naruto: Re-scrape em andamento
- Demais universos: Necessitam auditoria de dados

---

## Notas de Modo Específico

- [[09 - Quadra Mode - Design Melhorado]] — design e algoritmo original
- [[10 - Briefing Backend - Quadra Curated Groups]] — CURATED_GROUPS implementados + Step 4.5
- [[11 - Quadra Groups - Mapeamento Completo]] — mapeamento de grupos, capacidade combinatória
- [[12 - Build Mode e Quote Mode - OP.GG MCP]] — OP.GG MCP + DDragon tips fix (2026-03-25)
- [[13 - QuadraMode Frontend - History e End Game]] — histórico de grupos + reveal end-game (2026-03-25)
- [[00 - Workflow - Orquestração Claude]] — como Claude deve orquestrar via Maestri

**Atualizado em:** 2026-03-25

---
> **Nota:** Vault migrado para `guessle-verse/Guessle/` em 2026-03-25.
