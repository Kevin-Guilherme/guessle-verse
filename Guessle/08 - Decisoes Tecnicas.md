# Decisoes Tecnicas (ADRs)

## ADR-001: Guess validation server-side

**Decisao:** Todo calculo de feedback em `/api/guess` (server-side).
**Motivo:** Evitar manipulacao client-side (usuario poderia inspecionar resposta e marcar como correto).
**Consequencia:** Latencia por request a cada guess, mas seguranca garantida.

---

## ADR-002: daily_challenges armazena snapshot completo

**Decisao:** Cron grava snapshot completo de attributes/extra em `daily_challenges`.
**Motivo:** Evita join com `characters` em todo request de jogo. Se personagem for editado, desafio do dia nao muda.
**Consequencia:** Redundancia de dados, mas leitura de jogo e O(1) sem joins.

---

## ADR-003: Sessions inseridas com completed_at = null

**Decisao:** INSERT sempre com `completed_at = null`; UPDATE apenas ao concluir.
**Motivo:** Trigger de ranking dispara em `UPDATE OF completed_at`. Garantia de que o ranking so e atualizado uma vez por sessao concluida.
**Consequencia:** Codigo de session deve respeitar essa invariante.

---

## ADR-004: Unauthenticated users podem jogar

**Decisao:** Usuarios nao autenticados podem jogar, mas estado fica em memoria (Zustand).
**Motivo:** Reducao de fricao para novos usuarios. Nao precisam criar conta para experimentar.
**Consequencia:** Progresso perdido ao fechar o browser. Ranknig nao atualizado.

---

## ADR-005: Mode Registry com dynamic imports

**Decisao:** `registry.ts` mapeia slug -> `() => import(componente)`.
**Motivo:** Code splitting automatico; cada modo carrega apenas quando necessario.
**Consequencia:** Adicionar modo = 1 arquivo + 1 entrada no registry. Zero mudancas no core.

---

## ADR-006: Streak por tema, nao por modo

**Decisao:** Streak conta qualquer vitoria em qualquer modo do mesmo universo no dia.
**Motivo:** Incentivar exploracao de modos diferentes sem penalizar quem nao joga todos os modos.
**Consequencia:** Trigger de ranking agrega por `theme_id`, nao por `theme_id + mode`.

---

## ADR-007: Anti-repeticao 60 dias

**Decisao:** Janela de 60 dias por `theme_id + mode`.
**Motivo:** Evitar repeticao de desafios; 60 dias e suficiente para a maioria dos universos.
**Risco:** Universos com poucos personagens (< 60 desafios por modo) podem ter problemas. Mitigado pelo `skipped` status no cron.

---

## ADR-008: Wiki scraper no cron semanal

**Decisao:** `refresh-catalog` roda toda domingo.
**Motivo:** Novos personagens de wikis nao precisam de sincronizacao diaria.
**Risco:** Paginacao limitada (50/run) e insuficiente para universos grandes como Naruto.
**Pendente:** Implementar paginacao automatica com cmcontinue loop.
