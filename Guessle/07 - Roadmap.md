# Roadmap — Proximas Tarefas

## Sprint Atual — Naruto + One Piece

### Alta Prioridade

- [ ] Finalizar re-scrape Naruto com cmcontinue (48 chunks)
- [ ] Implementar female pass no scraper do One Piece
- [ ] Re-executar scrape de One Piece com personagens femininos
- [ ] Auditar campos classicos Naruto pos-scrape (especie, vila, cla, rank)
- [ ] Validar modos jutsu e eye com dados reais do scrape

### Media Prioridade

- [ ] Auditar qualidade de dados: Jujutsu, Zelda, Mario, GoW, MH
- [ ] Verificar e corrigir paginacao automatica do cron (loop cmcontinue)
- [ ] Verificar rotacao de token IGDB para Gamedle
- [ ] Testar todos os 44 modos de jogo ponta a ponta

### Baixa Prioridade

- [ ] Error boundaries por modo de jogo
- [ ] Empty states especificos por modo
- [ ] Auditoria de responsividade mobile
- [ ] Verificar implementacao de Share Result
- [ ] Verificar paginacao do Ranking (50/pagina)

---

## Proximo Sprint — Novos Universos

Candidatos para expansao:
- Dragon Ball
- Fairy Tail
- Hunter x Hunter
- Attack on Titan

---

## Debitos Tecnicos

- [ ] Tipagem forte no ModeComponentProps (atualmente `challenge: any`)
- [ ] Testes unitarios para computeFeedback
- [ ] Testes de integracao para /api/guess
- [ ] Monitoramento de erros do cron (alertas quando falha)
- [ ] Documentacao de onboarding para novos colaboradores
