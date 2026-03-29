# Briefing Backend — Quadra: Curated Groups

**Arquivo:** `supabase/functions/cron-daily-challenges/index.ts`
**Função:** `fetchQuadraKill`
**Última atualização:** 2026-03-25

---

## Estado atual — IMPLEMENTADO

### CURATED_GROUPS (final, 2026-03-25)

```typescript
const CURATED_GROUPS = [
  // LORE (11 grupos)
  { type: 'lore', category: 'Campeões de Demacia',    color: 'green',  champions: ['Garen','Lux','Jarvan IV','Fiora','Poppy','Xin Zhao','Galio','Quinn','Sylas','Sona'] },
  { type: 'lore', category: 'Campeões de Noxus',      color: 'green',  champions: ['Darius','Draven','Katarina','Swain','Talon','Vladimir','Kled','Sion','Annie','Samira','Rell','Mordekaiser'] },
  { type: 'lore', category: 'Campeões de Freljord',   color: 'green',  champions: ['Ashe','Tryndamere','Anivia','Sejuani','Braum','Lissandra','Volibear','Udyr','Trundle'] },
  { type: 'lore', category: 'Campeões de Ionia',      color: 'green',  champions: ['Yasuo','Yone','Irelia','Karma','Kennen','Lee Sin','Master Yi','Shen','Wukong','Zed','Akali','Ahri','Jhin','Kayn'] },
  { type: 'lore', category: 'Campeões de Zaun',       color: 'green',  champions: ['Jinx','Vi','Ekko','Blitzcrank','Zeri','Singed','Twitch','Warwick','Janna','Urgot'] },
  { type: 'lore', category: 'Campeões de Piltover',   color: 'green',  champions: ['Caitlyn','Jayce','Viktor','Heimerdinger','Camille','Ezreal','Orianna'] },
  { type: 'lore', category: 'Ilhas das Sombras',      color: 'green',  champions: ['Thresh','Hecarim','Karthus','Kalista','Viego','Gwen','Senna','Maokai','Yorick'] },
  { type: 'lore', category: 'Campeões de Shurima',    color: 'green',  champions: ['Azir','Nasus','Renekton','Sivir','Taliyah','Amumu','Rammus','Xerath','Zilean','Akshan'] },
  { type: 'lore', category: 'Campeões de Bilgewater', color: 'green',  champions: ['Gangplank','Miss Fortune','Twisted Fate','Graves','Nautilus','Fizz','Illaoi','Pyke','Tahm Kench'] },
  { type: 'lore', category: 'Campeões do Void',       color: 'green',  champions: ["Cho'Gath","Kog'Maw","Vel'Koz","Kha'Zix","Rek'Sai","Bel'Veth",'Malzahar','Kassadin',"Kai'Sa"] },
  { type: 'lore', category: 'Campeões de Targon',     color: 'green',  champions: ['Pantheon','Diana','Leona','Taric','Soraka','Zoe','Aphelios','Aurelion Sol'] },

  // TYPE (3 grupos — "Monstros/Criaturas" removido por falta de pool)
  { type: 'type', category: 'Yordles',                color: 'yellow', champions: ['Teemo','Lulu','Tristana','Kennen','Corki','Rumble','Ziggs','Heimerdinger','Veigar','Kled','Poppy','Gnar','Yuumi'] },
  { type: 'type', category: 'Invocam Pets',           color: 'yellow', champions: ['Annie','Yorick','Malzahar','Zyra','Heimerdinger','Shaco','Elise','Mordekaiser','Azir'] },
  { type: 'type', category: 'Se Transformam',         color: 'yellow', champions: ['Nidalee','Jayce','Elise','Gnar','Kayn','Shyvana'] },

  // MECHANIC (6 grupos)
  { type: 'mechanic', category: 'Podem Reviver',      color: 'blue',   champions: ['Anivia','Sion','Zac','Zilean'] },
  { type: 'mechanic', category: 'Reset de Abate',     color: 'blue',   champions: ['Katarina','Akali','Master Yi','Pyke','Viego','Aurora',"Bel'Veth"] },
  { type: 'mechanic', category: 'Ultimate Global',    color: 'blue',   champions: ['Shen','Twisted Fate','Soraka','Gangplank','Karthus','Senna','Ashe','Jinx','Ezreal','Briar','Draven','Ziggs'] },
  { type: 'mechanic', category: 'Têm Stealth',        color: 'blue',   champions: ['Twitch','Evelynn','Shaco','Akali','Rengar',"Kha'Zix",'Talon','Wukong','Teemo','Neeko'] },
  { type: 'mechanic', category: 'Não Usam Mana',      color: 'blue',   champions: ['Garen','Katarina','Riven','Zed','Aatrox','Tryndamere','Renekton','Shyvana','Gwen','Samira'] },
  { type: 'mechanic', category: 'Usam Energia',       color: 'blue',   champions: ['Zed','Shen','Akali','Kennen','Lee Sin'] },

  // TRICK (4 grupos)
  { type: 'trick', category: 'Golens/Construtos',     color: 'purple', champions: ['Malphite','Blitzcrank','Orianna','Galio','Nautilus','Maokai','Zac'] },
  { type: 'trick', category: 'Têm Gancho (Hook)',     color: 'purple', champions: ['Blitzcrank','Thresh','Nautilus','Pyke','Leona'] },
  { type: 'trick', category: 'Spell Shield',          color: 'purple', champions: ['Sivir','Morgana','Nocturne','Malzahar'] },
  { type: 'trick', category: 'Stacks Permanentes',    color: 'purple', champions: ["Cho'Gath",'Nasus','Senna','Thresh','Veigar'] },
]
```

---

## Decisões importantes desta sessão (2026-03-25)

### Ultimate Global — auditoria completa
- **Removidos:** Nocturne (range, não verdadeiramente global), Pantheon (também range-based)
- **Adicionados:** Senna, Ashe, Jinx, Ezreal, Briar, Draven, Ziggs (7 novos)
- **Critério:** ULT que se move pelo mapa inteiro (ex: TF teleport, Shen shield, Soraka heal, Karthus dano global)

### Stacks Permanentes — conflito com Senna
- Senna estava em Stacks Permanentes mas NÃO estava em Ultimate Global
- Isso criava conflito silencioso: Senna poderia aparecer como tile de "Stacks" num puzzle onde "Ultimate Global" também fosse escolhido
- **Fix:** Senna adicionada ao Ultimate Global. Veigar adicionado a Stacks como spare.

### Copiam Habilidades — REMOVIDO
- Mecânica muito diferente entre os campeões: Sylas rouba ULT, Viego rouba forma inteira, Neeko só usa AA, Zoe coleta Summoners
- Causaria confusão no jogador

---

## Algoritmo fetchQuadraKill — fluxo completo

```
Step 1: Filtrar CURATED_GROUPS por campeões ativos no banco
Step 2: Pick 1 grupo por type [lore, type, mechanic, trick]
        → Embaralhar candidatos, escolher o primeiro com 4+ disponíveis
        → Blacklist total: todos os membros do grupo escolhido vão pra usedNames
Step 3: Fallback DIMS se grupos < 4
Step 4.5: Cross-validation pós-geração (ver abaixo)
Step 4: Montar tiles (embaralhado)
Step 5: INSERT daily_challenges
```

### Step 4.5 — Cross-validation pós-geração (NOVO 2026-03-25)

Após gerar os 4 grupos, varre cada tile para verificar se aparece na lista curated de outro grupo escolhido. Se sim, tenta substituir por um membro do mesmo grupo que não crie conflito.

```typescript
// Pseudocódigo
for each group in groups:
  for each champion in group.champions:
    if champion ∈ otherChosenGroup.curatedMembers:
      replacement = groupMembers.find(n => !allTiles.has(n) && !inAnyOtherGroup(n))
      if replacement: group.champions[i] = replacement
```

**Casos onde não substitui:** se não houver replacement limpo disponível, mantém o campeão (raro — log de conflito abaixo).

---

## Gargalos conhecidos (não alterar por enquanto)

| Grupo | C(n,4) | Problema |
|-------|--------|---------|
| Spell Shield | 1 | Sempre Sivir/Morgana/Nocturne/Malzahar |
| Têm Gancho | 5 | Pool muito pequeno |
| Usam Energia | 5 | Pool muito pequeno |
| Podem Reviver | 1 | Apenas 4 membros |

---

## Referências
- [[09 - Quadra Mode - Design Melhorado]]
- [[11 - Quadra Groups - Mapeamento Completo]]
