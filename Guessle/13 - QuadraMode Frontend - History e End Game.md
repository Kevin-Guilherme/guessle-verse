# QuadraMode Frontend — Histórico e Revelação Final

**Arquivo:** `apps/web/components/modes/QuadraMode.tsx`
**Última atualização:** 2026-03-25

---

## Problema anterior

- Grupos resolvidos apareciam em div separado **acima** do grid de tiles
- Ao fim do jogo (won/lost), **não mostrava** todas as 4 categorias

---

## Comportamento correto implementado

### Durante o jogo (won=false, lost=false)
1. Grid de tiles (cartas selecionáveis)
2. Botão "Validar" / contador
3. **Histórico de grupos resolvidos** (abaixo do botão, em ordem de solução)

### Fim de jogo (won=true OU lost=true)
- Grid e botão desaparecem
- Exibe **todas as 4 categorias** com campeões
- won → título "Categorias"
- lost → título "Resultado"

---

## Código relevante

```tsx
{/* Solved groups history — shown below grid during gameplay */}
{!won && !lost && solvedGroups.length > 0 && (
  <div className="space-y-2 pt-1">
    {solvedGroups.map(g => (
      <div key={g.category} className={`rounded-xl border px-4 py-3 ${COLOR_MAP[g.color] ?? 'bg-surface border-white/10'}`}>
        <p className={`text-xs font-display font-bold uppercase tracking-widest mb-1 ${COLOR_TEXT[g.color] ?? 'text-white'}`}>
          {g.category}
        </p>
        <p className="text-[11px] text-white/80 font-sans">{g.champions.join(' · ')}</p>
      </div>
    ))}
  </div>
)}

{/* End-game: reveal all categories */}
{(won || lost) && (
  <div className="space-y-2 pt-1">
    <p className="text-center text-xs font-display font-bold uppercase tracking-widest text-white/40 pb-1">
      {won ? 'Categorias' : 'Resultado'}
    </p>
    {groups.map(g => (
      <div key={g.category} className={`rounded-xl border px-4 py-3 ${COLOR_MAP[g.color] ?? 'bg-surface border-white/10'}`}>
        <p className={`text-xs font-display font-bold uppercase tracking-widest mb-1 ${COLOR_TEXT[g.color] ?? 'text-white'}`}>
          {g.category}
        </p>
        <p className="text-[11px] text-white/80 font-sans">{g.champions.join(' · ')}</p>
      </div>
    ))}
  </div>
)}
```

**Fonte dos dados no end-game:** `challenge.attributes.groups` (não `solvedGroups` local)
→ Garante que todas as 4 categorias aparecem mesmo se o jogador perdeu com apenas 1-2 resolvidas.

---

## Referências
- [[09 - Quadra Mode - Design Melhorado]]
- [[10 - Briefing Backend - Quadra Curated Groups]]
