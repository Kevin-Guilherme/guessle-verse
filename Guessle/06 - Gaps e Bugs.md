# Gaps e Bugs Conhecidos

## CRITICOS (bloqueiam producao)

### [BACKEND] One Piece — Female Characters nao scrapeadas
- **Arquivo:** `supabase/functions/refresh-catalog/index.ts`
- **Causa:** Apenas 'Male Characters' na categoria de scrape
- **Impacto:** Nami, Robin, Boa Hancock, Perona, etc. = zero no banco
- **Fix:** Implementar "female pass" no scraper e re-executar

### [BACKEND] Naruto — Re-scrape incompleto
- **Causa:** Paginacao so retorna 50 por chamada; ~600+ personagens necessitam 12+ chamadas
- **Status:** Re-scrape em progresso com cmcontinue
- **Risco:** Modos jutsu/eye podem ter dados faltando ate a conclusao

---

## IMPORTANTES (degradam experiencia)

### [FRONTEND] Modos sem componente dedicado (reuso de ClassicMode)
- `devil-fruit` -> ClassicMode (sem logica especifica de Devil Fruit)
- `game` (Mariodle) -> ClassicMode
- Pode precisar de componentes proprios se logica especifica for necessaria

### [BACKEND] Naruto — Paginacao do cron
- Cron semanal so scrape 50 personagens por execucao
- Para universos grandes, precisar de estrategia de paginacao automatica
- **Fix sugerido:** Loop com cmcontinue dentro do cron ate esgotar

### [BACKEND] IGDB tokens para Gamedle
- Tokens IGDB expiram; sem rotacao automatica implementada
- **Risco:** Cron falha silenciosamente (try/catch por tema)

### [FRONTEND] SearchInput — loading="eager" aplicado
- Resolvido para Naruto; verificar se todos os universos tem o fix

---

## RESOLVIDOS (2026-03-26)

### [FRONTEND] BuildMode — hydration bug (ScoreSummary prematuro)
- Após acertar Quest 1 e recarregar, o ScoreSummary aparecia com todas as quests em `+0 ×`
- **Causa:** `useEffect` com deps `[]` + mapeava todos os guesses (corretos+errados) como results
- **Fix:** `hasHydrated` ref + deps `[guesses]` + apenas guesses corretos avançam `questIndex`
- **Commit:** `40a522a`

### [FRONTEND] AbilityMode — hydration bug (ability não reaparece após reload)
- Após acertar o campeão e errar a habilidade, ao sair e voltar a tela ficava em branco
- **Causa 1:** `champWasCorrect` calculava só o último guess — se era `SLOT:` errado, fase ability não ativava
- **Causa 2:** `triedSlots` não era restaurado do histórico de guesses
- **Fix:** `guesses.some()` + `hasHydrated` ref + restaura `triedSlots` de `SLOT:` guesses

### [BACKEND] Build/Detective — itens duplicados na build canônica
- Ex: Void Staff aparecia na posição 3 e 6; dois Gumes
- **Causa:** OP.GG retorna mesmo item como top pick em slots diferentes (fourth e last)
- **Fix:** round-robin pelos slots extras com `Set` de IDs vistos — garante sempre 6 itens únicos

### [FRONTEND] Quote mode — exibindo `////` em vez da frase
- **Causa:** ISR cache (`revalidate=86400`) servindo challenge com quote vazia
- **Fix:** `export const dynamic = 'force-dynamic'` no mode page

---

## MENORES (polish)

### [FRONTEND] Empty states por modo
- Cron pode falhar; cliente exibe "Desafio nao disponivel" mas UI pode melhorar
- Cada modo poderia ter empty state especifico

### [FRONTEND] Error boundaries por modo
- Atualmente erro em modo pode quebrar GameClient inteiro
- Idealmente cada modo isolado em ErrorBoundary

### [BACKEND] Campos faltando em universos nao auditados
- Jujutsu, Zelda, Mario, GoW, MH — dados via wiki scraper sem verificacao de qualidade
- Campos podem ser null/empty para muitos personagens

### [FRONTEND] Profile page incompleta
- Pagina de perfil existe mas funcionalidades detalhadas a verificar
- Historico de partidas, stats por universo, etc.

### [FRONTEND] Responsividade
- Layout principal desktop-first; mobile nao auditado formalmente

---

## GAPS DE FEATURES (roadmap)

### Share Result
- `generateShareText()` e `ShareButton` existem no design doc mas implementacao nao verificada

### Ranking Global
- Query no RSC usando service role key (acessa auth.users)
- Verificar se paginacao (50/pagina) esta implementada

### Modo Code — Monaco Editor
- Design doc especifica "Monaco-lite editor"
- Verificar se CodeMode usa Monaco ou fallback simples

### Hints System
- Hints desbloqueados em 5 e 10 erros (-150/-200 pts)
- Verificar implementacao em todos os modos que suportam

### Modo Wanted (One Piece)
- Componente WantedMode existe?
- Mostrar poster com recompensa sem nome/imagem do personagem

### Modo Kirby (Smash)
- KirbyMode existe no registry
- Mostrar Kirby copiando habilidade do personagem

### Modo Final Smash (Smash)
- FinalSmashMode existe no registry
- Mostrar descricao/imagem do Final Smash sem nome do personagem

---

## RESOLVIDOS

### [BACKEND] Positions LoL — Remapeamento via OP.GG MCP (2026-03-26)
- **Script:** `scripts/update-positions.mjs`
- **Fonte:** `lol_get_champion_analysis` → `data.summary.positions[]` (OP.GG pre-filtered)
- **Lógica:** Posições pre-filtradas pelo OP.GG (mesmo dado exibido no site), ordenadas por role_rate real
- **Threshold:** 3 tiers — ≥60% primary, ≥30% secondary, ≥10% tertiary, <10% ignorado
- **Fix técnico:** `position: 'top'` obrigatório para ativar o endpoint (summary retorna todas as lanes independente do valor passado)
- **Resultado:** 85 campeões atualizados, 0 falhas, 172 processados
- **Exemplos:** Senna → Support,Bottom | Akali → Middle,Top | Corki → Bottom | Lux → Support,Middle | Nasus → Top,Jungle
