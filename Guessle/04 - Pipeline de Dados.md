# Pipeline de Dados

## Edge Functions

| Function | Schedule | Responsabilidade |
|----------|----------|-----------------|
| `cron-daily-challenges` | 0 10 * * * UTC | Sorteia desafio diario para cada tema+modo |
| `refresh-catalog` | 0 3 * * 0 UTC | Scrape wikis, atualiza tabela characters |
| `generate-code-puzzle` | Chamado pelo cron | Gera puzzle JS/TS/Python via Groq LLM |

---

## cron-daily-challenges

- Itera sobre todos os universos e modos
- Cada combinacao tem try/catch isolado (falha de um nao bloqueia outros)
- Anti-repeticao: busca names dos ultimos 60 dias, exclui da pool
- Para code modes: chama `generate-code-puzzle` via `supabase.functions.invoke()`
- Resultado: array de `{ theme, mode, status: 'ok' | 'skipped' | 'error' }`

---

## refresh-catalog (Wiki Scraper)

Scrape de 8 universos via Fandom wikis.

**Estrategia de extracao:**
1. Format 1: Fandom portable-infobox (`[data-source]`)
2. Format 2: MediaWiki `table.infobox` (Naruto wiki)

**Campos scraped por universo:**

| Universo | Campos |
|----------|--------|
| Naruto | especie, vila, cla, kekkei_genkai, afiliacao, rank |
| One Piece | afiliacao, fruta_do_diabo, recompensa, haki, raca, ilha_natal |
| Jujutsu | tecnica_maldita, grau, afiliacao, genero |
| Smash | universe, weight_class, tier, first_appearance, fighter_type |
| Zelda | race, games, gender, affiliation |
| Mario | species, first_appearance, affiliation |
| GoW | realm, affiliation, weapon, gender |
| MH | type, element, weakness, size, threat_level |

**Bugs corrigidos no scraper:**
- Multi-value cells: extrai `<a>` individualmente e une com `, ` (evita "Uzumaki Clan Senju Clan")
- Imagens: loop pula SVGs, pega primeiro .png/.jpg/.webp
- Referrer: `no-referrer` para CDN da Fandom (evita 404)

**BUG CRITICO ABERTO — One Piece female characters:**
- O scraper so busca categoria 'Male Characters'
- Nami, Robin, Boa Hancock, Perona etc. = zero no banco
- "separate pass" para Female Characters NUNCA foi implementado

---

## Naruto — Status Detalhado

**Problema central:** paginacao — apenas 50 personagens por chamada de cron.
Para cobrir ~600+ personagens precisa de 12+ chamadas manuais com `cmcontinue`.

**Fix aplicado:**
- Filtro `appears_in`: se nao contem "Manga" ou "Anime" -> `active: false`
- Resultado esperado: ~1196 ativos (de 1365 totais)
- Re-scrape em progresso com `extractInfobox` corrigido

**Fixes de imagens:**
- Pula SVGs no loop de imagens
- `no-referrer` em todos os `<img>` e layout.tsx

---

## generate-code-puzzle

- Usa Groq `llama-3.3-70b`
- Output validado como JSON: `{ code, answer, explanation, difficulty }`
- `content_hash` = SHA-256 de `attributes->>'code'`
- Verificado contra existing hashes antes do insert
- Constraint `unique(theme_id, mode, content_hash)` como seguranca final
