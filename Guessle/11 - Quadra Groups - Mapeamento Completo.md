# Quadra Groups — Mapeamento Completo

**Última atualização:** 2026-03-25
**Base:** 172 campeões LoL ativos no banco
**Capacidade atual:** ~200+ puzzles únicos (após adição de Bilgewater, Void, Targon)

---

## GRUPOS EXISTENTES (CURATED_GROUPS implementados)

### LORE — green (11 grupos)

| Grupo | Campeões no banco | C(n,4) combinações |
|-------|-------------------|---------------------|
| Campeões de Demacia | 10 | 210 |
| Campeões de Noxus | 12 | 495 |
| Campeões de Ionia | 14 | 1001 |
| Campeões de Freljord | 9 | 126 |
| Campeões de Zaun | 10 | 210 |
| Campeões de Shurima | 10 | 210 |
| Campeões das Ilhas das Sombras | 9 | 126 |
| Campeões de Piltover | 7 | 35 |
| Campeões de Bilgewater | 9 | 126 |
| Campeões do Void | 9 | 126 |
| Campeões de Targon | 8 | 70 |

### TYPE — yellow (4 grupos)

| Grupo | Campeões no banco | C(n,4) combinações |
|-------|-------------------|---------------------|
| Yordles | 13 | 715 |
| Invocam Pets/Minions | 9 | 126 |
| Se Transformam | 8 | 70 |
| Monstros/Criaturas | 7 | 35 |

### MECHANIC — blue (6 grupos)

| Grupo | Campeões no banco | C(n,4) combinações |
|-------|-------------------|---------------------|
| Têm Stealth | 10 | 210 |
| Não Usam Mana | 10 | 210 |
| Podem Reviver | 8 | 70 |
| Reset de Abate | 7 | 35 |
| Ultimate Global | 7 | 35 |
| Usam Energia (Energy) | 5 | 5 |

> **Removido:** `Copiam Habilidades` — mecânica muito diferente entre os campeões (Sylas rouba ULT, Viego rouba forma inteira, Neeko se transforma mas só usa AA, Zoe coleta Summoners). Geraria confusão no jogador.

### TRICK — purple (5 grupos) ⚠️ GARGALO

| Grupo | Campeões no banco | C(n,4) combinações |
|-------|-------------------|---------------------|
| Golens/Construtos | 7 | 35 |
| Dual Stance/Form | 6 | 15 |
| Roubam Stats | 5 | 5 |
| Têm Gancho (Hook) | 5 | 5 |
| Spell Shield | 4 | **1** |

> **ALERTA:** Spell Shield tem apenas 1 combinação possível (sempre Sivir, Morgana, Nocturne, Malzahar). Precisa de mais campeões ou ser desativado.

---

## NOVOS GRUPOS POTENCIAIS

Derivados dos dados reais do banco (atributos, extra, características de gameplay).

### LORE — Expansão de Regiões

Regiões com 4+ campeões no banco mas sem grupo curado:

| Grupo Proposto | Campeões no banco | Prioridade |
|----------------|-------------------|------------|
| Campeões de Bilgewater | Gangplank, Miss Fortune, Twisted Fate, Graves, Nautilus, Fizz, Illaoi, Pyke, Tahm Kench (9) | ALTA |
| Campeões do Void | Cho'Gath, Kog'Maw, Vel'Koz, Kha'Zix, Rek'Sai, Bel'Veth, Malzahar, Kassadin, Kai'Sa (9) | ALTA |
| Campeões de Targon | Pantheon, Diana, Leona, Taric, Soraka, Zoe, Aphelios (7) | ALTA |
| Campeões de Ixtal | Qiyana, Nidalee, Rengar, Malphite*, Zyra (5) | MEDIA |
| Campeões de Bandle City | Teemo, Lulu, Tristana, Rumble, Ziggs, Veigar, Corki, Heimerdinger, Poppy, Gnar, Kled, Yuumi (12) | MEDIA |

*Malphite é de Ixtal tecnicamente, confirmar no banco.

> Obs: Bandle City = Yordles. Pode ser redundante com o grupo `type: Yordles`. Avaliar se faz sentido manter os dois ou escolher um.

---

### TYPE — Expansão de Espécies/Classes

Grupos derivados de `species` e características visuais:

| Grupo Proposto | Campeões prováveis | Prioridade |
|----------------|-------------------|------------|
| Humanos Aumentados | Viktor, Warwick, Urgot, Camille, Singed, Blitzcrank, Orianna (7) | ALTA |
| Wrath/Fantasmas | Karthus, Hecarim, Kalista, Thresh, Yorick, Senna, Viego (7) | ALTA |
| Demônios/Infernais | Evelynn, Tahm Kench, Fiddlesticks, Nocturne, Swain (5) | MEDIA |
| Têm Arma Viva | Aatrox, Kayle, Varus, Xayah, Jhin, Zoe, Aphelios (7) | ALTA |
| Aspectos Celestiais | Pantheon, Leona, Diana, Taric, Zoe, Kayle, Morgana (7) | MEDIA |
| Humanos Gelo (Iceborn) | Lissandra, Volibear, Trundle, Nunu, Braum (5) | BAIXA |
| Voidborn | Cho'Gath, Kog'Maw, Vel'Koz, Bel'Veth, Rek'Sai (5) | MEDIA |

---

### MECHANIC — Expansão de Mecânicas

Grupos baseados em mecânicas de gameplay:

| Grupo Proposto | Campeões prováveis | C(n,4) est. | Prioridade |
|----------------|-------------------|-------------|------------|
| Dash/Mobilidade Extrema | Ahri, Akali, Ezreal, Zed, Yone, Irelia, Riven, Zeri, Talon (9) | 126 | ALTA |
| Shields (escudo próprio) | Janna, Lulu, Thresh, Rakan, Malphite, Shen, Braum (7) | 35 | MEDIA |
| Lida com HP próprio | Vladimir, Mundo, Aatrox, Warwick, Sylas (5) | 5 | MEDIA |
| Invulnerabilidade | Tryndamere, Fizz, Kayle, Zhonya's... (mecânica, 4+) | - | BAIXA |
| Execução (mata low HP) | Pyke, Darius, Urgot, Chogath, Garen (5) | 5 | MEDIA |
| Slow/Freeze | Ashe, Lissandra, Nasus, Zilean, Anivia (5) | 5 | BAIXA |
| Ressuscitam Aliados | Zilean, Senna (passivo), Yorick, Kindred (4) | 1 | BAIXA |

---

### TRICK — Expansão de Categorias Específicas (PRIORIDADE MÁXIMA)

Trick é o tipo com menos grupos e menor diversidade. Precisa de pelo menos 3-4 novos grupos:

| Grupo Proposto | Campeões prováveis | C(n,4) est. | Prioridade |
|----------------|-------------------|-------------|------------|
| Controlam Múltiplos Corpos | Azir, Elise, Heimerdinger, Shaco, Maokai, Yorick (6) | 15 | CRITICA |
| Têm Passiva que Marca Inimigos | Thresh, Kalista, Pyke, Urgot (4) | 1 | BAIXA |
| Roubam/Copiam Forma | Sylas, Neeko, Viego, Zoe (4) | 1 | BAIXA |
| Viram Aliados / Summons | Kalista, Mordekaiser, Yorick, Senna, Kindred (5) | 5 | MEDIA |
| Têm Contador / Stack Infinito | Nasus, Veigar, Senna, Thresh, Cho'Gath, Kindred (6) | 15 | ALTA |
| Mudam de Lado (Viraram Vilão/Herói) | Viego, Sylas, Kayn, Aatrox, Morgana (5) | 5 | MEDIA |
| Primeiro Campeão do Universo Lore | Ashe, Ryze, Nasus, Sion (fundadores lore) | - | BAIXA |
| Nunca Morrem de Burst | Aatrox, Tryndamere, Sion, Zilean, Karthus (5) | 5 | MEDIA |
| Ult que Muda o Mapa | Twisted Fate, Gangplank, Nunu, Ziggs, Caitlyn (barrils/barreiras/etc) | - | BAIXA |
| Têm Clones | Shaco, LeBlanc, Neeko, Wukong (4) | 1 | BAIXA |

---

## RESUMO DE CAPACIDADE

### Estado implementado (2026-03-25)
- lore: 11 grupos | type: 4 grupos | mechanic: 6 grupos | trick: 5 grupos
- Gargalo: TRICK — Spell Shield (C=1), Têm Gancho (C=5)
- Puzzles distintos estimados: ~200+

---

## IMPLEMENTADO (2026-03-25)

### Mudanças no CURATED_GROUPS
- **Adicionado LORE:** Bilgewater (9 campeões), Void (9), Targon (8)
- **Removido MECHANIC:** `Copiam Habilidades` — mecânica muito diferente entre campeões: Sylas rouba ULT, Viego rouba forma inteira + reseta ULT, Neeko se transforma mas só usa AA, Zoe coleta Summoners. Causaria confusão ao jogador.

### Mudanças no algoritmo (fetchQuadraKill)
1. **Blacklist total do grupo:** quando um grupo é selecionado, TODOS os seus campeões são bloqueados (não só os 4 escolhidos). Evita que o mesmo campeão apareça em duas categorias no mesmo puzzle.
2. **Anti-repetição 7 dias:** categorias usadas nos últimos 7 dias são excluídas da seleção. Se não houver candidatos sem repetição recente, usa qualquer categoria disponível como fallback.

### Gargalos pendentes (não alterar por enquanto)
- `Spell Shield` → C=1 (sempre Sivir, Morgana, Nocturne, Malzahar)
- `Têm Gancho (Hook)` → C=4 (Leona removida — E é dash/root, não puxa o inimigo)
- `Usam Energia` → C=5

---

## IMPLEMENTADO (2026-03-26)

### Revisão pós-rework de campeões
- **Mordekaiser removido de `Invocam Pets`** — pós-rework 2019 o R (Realm of Death) é duelo 1v1, não invoca mais o fantasma do inimigo. Continua em `Campeões de Noxus`.
- **Yorick mantido em `Invocam Pets`** — ainda invoca Maiden of the Mist + Mist Walkers pós-rework.
- **Leona removida de `Têm Gancho (Hook)`** — E (Zenith Blade) é dash até o inimigo + root, não puxa o inimigo até o caster.
- **Pantheon adicionado e depois removido de `Ultimate Global`** — R tem range limit (não é verdadeiramente global).

### Categoria renomeada
- `Golens/Construtos` → `Golens`

### Ultimate Global — purga de semi-globais
Critério: Global = projétil/efeito percorre o mapa inteiro independente de posição.

**Removidos (semi-globais):**
- **Twisted Fate** — R tem range limit (~5500 unidades)
- **Pantheon** — R precisa de range para ativar (ex: do mid precisa subir ao caranguejo para pegar o top)
- **Briar** — R recebeu nerf, deixou de ser global
- **Ziggs** — R tem grande alcance mas não cobre o mapa inteiro

**Lista final (9 campeões):** Shen, Soraka, Gangplank, Karthus, Senna, Ashe, Jinx, Ezreal, Draven

> Critério de referência: Ashe R = Jinx R = projétil que viaja até acertar, percorre o mapa inteiro → ambas são globais.

---

## REFERÊNCIAS

- [[09 - Quadra Mode - Design Melhorado]] — design original e algoritmo
- [[10 - Briefing Backend - Quadra Curated Groups]] — código implementado no cron
- Champdle.com — referência original de design
