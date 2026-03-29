# Build Mode & Quote Mode — OP.GG MCP + DDragon

**Arquivo:** `supabase/functions/cron-daily-challenges/index.ts`
**Última atualização:** 2026-03-25

---

## Problema anterior

- **Build mode:** Build com dois pares de botas + itens aleatórios sem sentido (vinha de U.GG pro play GraphQL)
- **Detective mode:** Itens de pro play que não fazem sentido para o público casual
- **Quote mode:** `pick.extra.quotes` estava vazio/não populado → nenhuma quote gerada

---

## Solução — OP.GG MCP (Build)

### Endpoint
```
URL: https://mcp-api.op.gg/mcp
Protocol: JSON-RPC 2.0 (MCP)
Auth: nenhuma
Tool: lol_get_champion_analysis
```

### Fluxo de chamada
```
1. POST initialize → session ID
2. POST notifications/initialized
3. POST tools/call → lol_get_champion_analysis({champion, position, tier: "platinum_plus"})
4. Parse resposta (JSON ou SSE text/event-stream)
```

### DSL de resposta OP.GG
```
LolGetChampionAnalysis(Data(
  [0] StarterItems(ids, names, winrate, pickrate),  // starter
  [1] StarterItems(...),                             // boots (1 item)
  [2] StarterItems(...),                             // core (2-3 items)
  [3] [...],                                         // fourth item options
  [4] [...],                                         // fifth item options
  [5] [...],                                         // sixth item options
  [6] [...],                                         // last item options
  [7] Runes(primaryTree, subTree, [rune ids]),
  [8] Skills(maxOrder, levelOrder)
))
```

### Build canônico gerado
```typescript
const canonical = [boots.ids[0], ...core.ids, fourth.ids[0], last.ids[0]].slice(0, 6)
// Resultado: [botas, item1, item2, item3, item_extra, item_final]
// Sem duplicatas — botas vêm do slot dedicado [1], core do slot [2]
```

### Nome do campeão para OP.GG
```typescript
champName.replace(/'/g,'').replace(/[\s.]+/g,'_').replace(/[^A-Z_0-9]/gi,'').toUpperCase()
// Ex: "Cho'Gath" → "CHOGATH", "Miss Fortune" → "MISS_FORTUNE"
```

### Mapeamento de posição
```typescript
// "bottom" no banco → "adc" no OP.GG
```

---

## Solução — DDragon allytips/enemytips (Quote)

```typescript
// DDragon endpoint adicionado ao fetch de dados do campeão:
const champData = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion/${champKey}.json`)

// Pool de quotes:
const tips = [...(champ.allytips ?? []), ...(champ.enemytips ?? [])]
const filtered = tips.filter(t => !t.toLowerCase().includes(pick.name.toLowerCase()))
selectedQuote = filtered[Math.floor(Math.random() * filtered.length)]

// Fallback: se DDragon falhar → pick.extra.quotes (como antes)
```

**Por que allytips/enemytips?**
- Conteúdo oficial Riot, sempre atualizado via DDragon
- Disponível para todos os campeões
- Filtro: remove dicas que mencionam o nome do campeão (evita spoiler na UI)

---

## fetchOpggBuild — função no cron

```typescript
async function fetchOpggBuild(
  champName: string,
  position: string,
  version: string,
  ddRunes: Rune[]
): Promise<{ itemIds: number[], runeIds: number[], skillOrder: string[] }>
```

Retorna:
- `itemIds`: build canônica (max 6 items, sem botas duplicadas)
- `runeIds`: IDs das runas (resolvidos por nome no DDragon runesReforged.json)
- `skillOrder`: `['Q','W','E','Q','Q','R',...]`

---

## Referências
- [[10 - Briefing Backend - Quadra Curated Groups]]
- OP.GG MCP: `https://mcp-api.op.gg/mcp`

---

## Fixes adicionais descobertos em produção (2026-03-25)

### Bug: OP.GG mudou formato do DSL
- **Antes:** `StarterItems(ids, names, ...)` — 9 partes no array
- **Depois:** `Boots(ids, names, ...)` — 6 partes no array
- **Fix:** Parser aceita ambos os formatos, detecta automaticamente pelo número de partes

### Bug: mapeamento de posição `middle → mid`
- LoL registry usa `middle`, OP.GG API espera `mid`
- Fix aplicado no cron

### Bug: Rune parsing
- Busca o primeiro array em `Runes(...)` — compatível com ambos os formatos

Todos deployados em 2026-03-25.

---

## Fix: BuildMode — hydration bug (2026-03-25)

### Problema
Após acertar Quest 1 (ex: Shaco), o ScoreSummary aparecia mostrando todas as 4 quests com `+0 x`. O usuário não conseguia continuar para Quest 2.

### Causa raiz
O `useEffect` de hydration tinha deps `[]` (executava antes do `useGameSession` carregar os guesses) e mapeava **todos** os guesses (corretos + errados) para o array `results`, fazendo `allDone = true` prematuramente.

### Fix aplicado (`BuildMode.tsx`)
```typescript
const hasHydrated = useRef(false)

useEffect(() => {
  if (hasHydrated.current || !isQuestMode || !guesses.length) return
  hasHydrated.current = true

  const questGuesses = guesses.filter(g => g.feedback?.[0]?.key === 'champion')
  if (questGuesses.length === 0) return

  // Apenas guesses CORRETOS avançam o questIndex
  let qi = 0
  const restored: Array<'correct' | 'wrong'> = []
  for (const g of questGuesses) {
    if (g.feedback?.[0]?.feedback === 'correct') {
      restored[qi] = 'correct'
      qi++
      if (qi >= quests.length) break
    }
  }

  setResults(restored)
  if (qi >= quests.length) {
    setAllDone(true)
    setQuestIndex(quests.length - 1)
  } else {
    setQuestIndex(qi)
  }
}, [guesses]) // depende de guesses para rodar após hydration
```

### Outros fixes de TypeScript (commit 40a522a)
- `tsconfig.json`: adicionado `"downlevelIteration": true` — resolve erros de `Set<string>` spread
- `session/guesses/route.ts`: cast `as unknown as { theme_id: number }` para evitar erro TS2352
- `ranking/page.tsx`: `raw_user_meta_data` → `user_metadata` (campo correto do Supabase Admin User)
- `resolvedState`: convertido de function declaration para const arrow dentro do componente

Deploy: commit `40a522a` em 2026-03-25 → Vercel auto-deploy via push para main.
