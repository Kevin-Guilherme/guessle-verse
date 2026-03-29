# Workflow — Orquestração Claude + Maestri + Obsidian

**Criado:** 2026-03-25

---

## Regra principal

**Claude Code (sessão principal) = orquestrador.** Não implementa diretamente.

Delegação via Maestri:
- `Guessle backend` → cron, supabase functions, edge functions, DB
- `Guessle Front` → Next.js, components, hooks, store
- `Revisor` → code review, validação, auditoria
- `Testes` → testes automatizados, validação de comportamento

---

## Obsidian = Cérebro do Projeto

Toda decisão, mudança, contexto deve estar documentado aqui antes ou logo após a implementação.

**Por quê:** Os agentes do Maestri têm contexto zero entre sessões. O vault é o que permite briefings precisos.

**Estrutura de notas:**
- `00 - Index.md` — mapa geral
- `01-08` — arquitetura, gaps, roadmap, decisões técnicas
- `09-13` — modos específicos (Quadra, Build, Quote)
- Criar novos arquivos para cada feature/bug significativo

---

## Fluxo correto

```
1. Usuário traz tarefa
2. Claude lê vault para contexto
3. Claude formula briefing completo para o agente
4. maestri ask "Guessle backend" "briefing..."
5. Agente implementa
6. Claude valida via Revisor se necessário
7. Claude atualiza vault com as mudanças
```

---

## mem library

- Disponível para auxiliar memória entre Claude e agentes
- Usar para informações cross-session que não cabem bem em nota Obsidian
- Reload via: `obsidian plugin:reload id=mem`

---

## Anti-patterns (não fazer)

- ❌ Claude editar arquivos diretamente sem passar por agente
- ❌ Implementar sem atualizar o vault
- ❌ Dar briefings incompletos sem contexto do vault
- ❌ Esquecer de documentar decisões de design
