# Status por Universo

## Legenda
- Dados completos
- Parcial — faltam personagens ou campos
- Em andamento — scrape/fix em progresso
- Bug critico aberto

---

## LoL — Status: Corrigido

**Fixes aplicados (10):**

| # | Problema | Fix |
|---|---------|-----|
| 1 | Detective sem itens (Yunara nova) | Filtrar campeao se buildItems.length === 0 |
| 2 | Historico sumia ao voltar | useGameSession: attempts > 0 \|\| completedAt |
| 3 | AbilityMode setState no render | Movido para useEffect |
| 4 | Botao PASSIVE estourava container | SLOT_LABEL map -> PASS, text-xs |
| 5 | Slot sempre retornava errado | Normalize 'P' -> 'Passive' em route.ts + cron |
| 6 | Slot errado ficava na tela | triedSlots Set + slotFailed quando todos tentados |
| 7 | Imagem habilidade muito facil | grayscale(1) + rotacao fixa por challenge.id % 4 |
| 8 | Quadra: sobreposicao positions | Substituido por range_type (Melee/Ranged) |
| 9 | Splash: skin nao aparecia | /api/skins: param ?include= force-inclui skin do desafio |
| 10 | Splash: chromas nas opcoes | Filtro !/\bChroma\b/i.test(name) no cron |

**Estado:** Todos os modos funcionais.

---

## Naruto — Status: Em andamento

**Problemas corrigidos:**
- Imagens: SVG skip, no-referrer para CDN Fandom
- Multi-value fields concatenados sem virgula
- Filtro appears_in (Manga/Anime)
- NARUTO_CLASSIC_COLS fixas com fallback 'None'
- Quotes: fallback para blockquote + regex ampliado
- Modo Eye: exige image_url valida (nao SVG)
- Modo Jutsu: extrai jutsu do cellbox, busca imagem/video

**Ainda em andamento:**
- Re-scrape completo com cmcontinue (48 chunks) — EM PROGRESSO EM BACKGROUND
- Personagens inativos filtrados no SearchInput (active=eq.true)
- loading="eager" em SearchInput e GuessRow (overflow-hidden confundia lazy)

**Risco:** Modo classic pode ter campos faltando em personagens antigos ate o re-scrape completar.

---

## One Piece — Status: BUG CRITICO

**BUG CRITICO:** Personagens femininas = 0 no banco
- Nami, Robin, Boa Hancock, Perona, Vivi, Nefertari, etc. — ausentes
- Causa: scraper busca apenas categoria 'Male Characters'
- "female pass" nunca implementado no refresh-catalog

**Impacto:** Pool drasticamente reduzida, desafios podem repetir ou ser enviusados.

---

## Jujutsu Kaisen — Status: Nao auditado

Dados inseridos via scraper, mas sem auditoria de qualidade.
Necessita verificar: campos completos, imagens validas, quotes existentes.

---

## Pokemon — Status: Estavel

Fonte: PokeAPI (oficial, estruturada).
Baixo risco de problemas de dados.

---

## Smash Bros — Status: Nao auditado

Campos especificos (universe, weight_class, tier, fighter_type) precisam de verificacao.

---

## Zelda, Mario, GoW, MH — Status: Nao auditados

Dados via wiki scraper. Qualidade desconhecida.
Necessitam auditoria pos-scrape.

---

## Gamedle — Status: Depende do IGDB

Pool fixa de 150 jogos em `gamedle_pool`. Imagens buscadas do IGDB no cron.
Risco: mudancas na API IGDB ou tokens expirados.

---

## JSdle / TSdle / Pythondle — Status: Estavel

Puzzles gerados pelo Groq LLM. Content_hash previne repeticao.
Risco: qualidade dos puzzles gerados (validacao apenas de formato JSON).
