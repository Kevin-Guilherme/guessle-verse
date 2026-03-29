# Quadra Mode — Design Melhorado

## Problema Atual

O `fetchQuadraKill` usa apenas 4 dimensões fixas de atributo do banco:
- `regions` → "Campeões de Noxus"
- `species` → "Humanos"
- `resource` → "Usam Mana"
- `range_type` → "Tipo: Ranged"

**Resultado:** categorias previsíveis, pouco criativas, sempre do mesmo tipo.

## Como o Champdle faz

Screenshot analisado (2026-03-25):
- NOXUS CHAMPIONS (lore/região — fácil, verde)
- RESET CHAMPIONS (mecânica de gameplay — médio, amarelo)
- REVIVE CHAMPIONS (mecânica de gameplay — difícil, azul)
- GOLEM (tipo/aparência — mais difícil, roxo)

**Insight chave:** cada puzzle tem TIPOS DE CATEGORIA DIFERENTES no mesmo desafio.
Não é só "4 grupos de região" — é uma mistura de lore + mecânica + tipo.

---

## Design da Solução

### Arquitetura: CURATED_GROUPS com type diversity

Cada grupo curado tem um `type` para garantir variedade no mesmo puzzle:
- `lore` → baseado em região/facção (mais óbvio, verde)
- `type` → baseado em espécie/classe visual (médio, amarelo)
- `mechanic` → baseado em mecânica de gameplay (difícil, azul)
- `trick` → categoria específica/contraintuitiva (mais difícil, roxo)

**Algoritmo:**
1. Separa grupos por type bucket
2. Sorteia 1 de cada bucket (garantindo diversidade)
3. Resolve conflitos de campeões duplicados entre grupos
4. Se não conseguir 4 de curated, fallback para dimensões de atributo

---

## CURATED_GROUPS — Lista Completa

### LORE (type: 'lore', color: 'green')

```typescript
{ type: 'lore', category: 'Campeões de Demacia',    color: 'green', champions: ['Garen','Lux','Jarvan IV','Fiora','Poppy','Xin Zhao','Galio','Quinn','Sylas','Sona'] },
{ type: 'lore', category: 'Campeões de Noxus',      color: 'green', champions: ['Darius','Draven','Katarina','Swain','Talon','Vladimir','Kled','Sion','Annie','Samira','Rell','Mordekaiser','Cassiopeia'] },
{ type: 'lore', category: 'Campeões de Freljord',   color: 'green', champions: ['Ashe','Tryndamere','Anivia','Sejuani','Braum','Lissandra','Volibear','Udyr','Trundle','Nunu & Willump'] },
{ type: 'lore', category: 'Campeões de Ionia',      color: 'green', champions: ['Yasuo','Yone','Irelia','Karma','Kennen','Lee Sin','Master Yi','Shen','Wukong','Zed','Akali','Ahri','Jhin','Kayn','Lillia'] },
{ type: 'lore', category: 'Campeões de Zaun',       color: 'green', champions: ['Jinx','Vi','Ekko','Blitzcrank','Orianna','Zeri','Singed','Twitch','Warwick','Renata Glasc','Janna','Urgot'] },
{ type: 'lore', category: 'Campeões de Piltover',   color: 'green', champions: ['Caitlyn','Jayce','Viktor','Heimerdinger','Camille','Ezreal','Seraphine'] },
{ type: 'lore', category: 'Campeões das Ilhas das Sombras', color: 'green', champions: ['Thresh','Hecarim','Karthus','Kalista','Mordekaiser','Viego','Gwen','Senna','Maokai','Yorick'] },
{ type: 'lore', category: 'Campeões de Shurima',    color: 'green', champions: ['Azir','Nasus','Renekton','Sivir','Taliyah','Amumu','Rammus','Xerath','Zilean','Akshan','Naafiri'] },
```

### TYPE (type: 'type', color: 'yellow')

```typescript
{ type: 'type', category: 'Yordles',              color: 'yellow', champions: ['Teemo','Lulu','Tristana','Kennen','Corki','Rumble','Ziggs','Heimerdinger','Veigar','Kled','Poppy','Gnar','Yuumi'] },
{ type: 'type', category: 'Invocam Pets/Minions', color: 'yellow', champions: ['Annie','Yorick','Malzahar','Zyra','Heimerdinger','Shaco','Elise','Mordekaiser','Azir'] },
{ type: 'type', category: 'Se Transformam',       color: 'yellow', champions: ['Nidalee','Jayce','Elise','Gnar','Kayn','Swain','Shyvana','Udyr','Nasus'] },
{ type: 'type', category: 'Têm Arma Viva',        color: 'yellow', champions: ['Aatrox','Kayle','Varus','Xayah','Jhin','Zoe','Aphelios'] },
{ type: 'type', category: 'Humanos Aumentados',   color: 'yellow', champions: ['Viktor','Warwick','Urgot','Camille','Singed','Blitzcrank','Orianna'] },
{ type: 'type', category: 'Monstros/Criaturas',   color: 'yellow', champions: ["Cho'Gath","Kog'Maw",'Vel\'Koz','Zac','Bel\'Veth','Rek\'Sai','Naafiri'] },
```

### MECHANIC (type: 'mechanic', color: 'blue')

```typescript
{ type: 'mechanic', category: 'Podem Reviver',        color: 'blue', champions: ['Karthus',"Kog'Maw",'Anivia','Zilean','Sion','Tryndamere','Zac','Yorick'] },
{ type: 'mechanic', category: 'Reset de Abate',        color: 'blue', champions: ['Katarina','Akali','Master Yi','Pyke','Viego','Aurora',"Bel'Veth"] },
{ type: 'mechanic', category: 'Ultimate Global',       color: 'blue', champions: ['Shen','Twisted Fate','Nocturne','Pantheon','Soraka','Gangplank','Karthus'] },
{ type: 'mechanic', category: 'Têm Stealth',           color: 'blue', champions: ['Twitch','Evelynn','Shaco','Akali','Rengar',"Kha'Zix",'Talon','Wukong','Teemo','Neeko'] },
{ type: 'mechanic', category: 'Não Usam Mana',         color: 'blue', champions: ['Garen','Katarina','Riven','Zed','Aatrox','Tryndamere','Renekton','Shyvana','Gwen','Samira'] },
{ type: 'mechanic', category: 'Usam Energia (Energy)', color: 'blue', champions: ['Zed','Shen','Akali','Kennen','Lee Sin'] },
{ type: 'mechanic', category: 'Copiam Habilidades',    color: 'blue', champions: ['Sylas','Zoe','Viego','Neeko'] },
```

### TRICK (type: 'trick', color: 'purple')

```typescript
{ type: 'trick', category: 'Golens/Construtos',    color: 'purple', champions: ['Malphite','Blitzcrank','Orianna','Galio','Nautilus','Maokai','Zac'] },
{ type: 'trick', category: 'Têm Gancho (Hook)',    color: 'purple', champions: ['Blitzcrank','Thresh','Nautilus','Pyke','Leona'] },
{ type: 'trick', category: 'Dual/Stance Mode',     color: 'purple', champions: ['Jayce','Nidalee','Elise','Gnar','Kayn','Aphelios'] },
{ type: 'trick', category: 'Recurso Alternativo',  color: 'purple', champions: ['Renekton','Shyvana','Rumble','Jayce','Elise','Zac','Gnar'] },
{ type: 'trick', category: 'Viram Aliados',        color: 'purple', champions: ['Kalista','Senna','Mordekaiser','Kindred','Yorick'] },
{ type: 'trick', category: 'Escudo Spell Shield',  color: 'purple', champions: ['Sivir','Morgana','Nocturne','Malzahar'] },
{ type: 'trick', category: 'Roubam Stats',         color: 'purple', champions: ['Viego','Cho\'Gath','Nasus','Kindred','Senna','Thresh'] },
```

---

## Algoritmo no Cron (pseudocódigo)

```typescript
function fetchQuadraKill(themeId, today) {
  const champs = await fetchAllActiveChampions(themeId)

  // 1. Separa curated por type
  const buckets = { lore: [], type: [], mechanic: [], trick: [] }
  for (const group of CURATED_GROUPS) {
    // Filtra apenas campeões que existem no banco
    const valid = group.champions.filter(n => champs.find(c => c.name === n))
    if (valid.length >= 4) buckets[group.type].push({ ...group, champions: valid })
  }

  // 2. Sorteia 1 de cada bucket
  const usedNames = new Set()
  const groups = []
  for (const [, pool] of Object.entries(buckets)) {
    const shuffled = pool.sort(() => Math.random() - 0.5)
    for (const candidate of shuffled) {
      // Filtra campeões já usados em outros grupos
      const available = candidate.champions.filter(n => !usedNames.has(n))
      if (available.length >= 4) {
        const chosen = available.sort(() => Math.random() - 0.5).slice(0, 4)
        chosen.forEach(n => usedNames.add(n))
        groups.push({ ...candidate, champions: chosen })
        break
      }
    }
  }

  // 3. Fallback para atributos se < 4 grupos
  if (groups.length < 4) {
    // ... lógica atual de DIMS ...
  }

  if (groups.length < 4) return 'skipped: could not build 4 groups'

  // 4. Monta tiles e insere
  const tiles = buildTiles(groups, champs)
  await insertChallenge(themeId, today, groups, tiles)
}
```

---

## Regras de Qualidade

1. Nunca repetir um campeão em dois grupos do mesmo puzzle
2. Todo grupo precisa de exatamente 4 campeões no puzzle
3. A lista de campeões em CURATED_GROUPS deve existir no banco (validar no cron)
4. Grupos `trick` com < 5 campeões válidos podem ser pulados se causarem conflito
5. Anti-repeticao de 60 dias já existe (por `name = Quadra {date}`)

---

## Briefing para o Backend

Ver: [[10 - Briefing Backend - Quadra Curated Groups]]
