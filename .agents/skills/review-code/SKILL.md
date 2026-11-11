# Habilidade: Revisão de Código (review-code)

Checklist e critérios para avaliação sistemática de código no Taxi.Rio.

---

## Critérios de Avaliação

1. **Rigor de Tipagem**:
   - Há uso indevido de `any` ou supressão de erros com `@ts-ignore`?
   - Acesso a propriedades opcionais está seguro contra `null` e `undefined`?
2. **Fronteiras e Desacoplamento**:
   - `api/` e `ui/` estão isoladas, usando apenas `packages/shared/`?
   - O worker permanece desacoplado de portas HTTP públicas?
3. **Robustez e Falhas**:
   - Todas as chamadas assíncronas contam com tratamento de erros adequado?
   - Mensagens de erro são informativas e livres de dados confidenciais?
4. **Padrão de Mensagens**:
   - Commits seguem o formato de _Conventional Commits_?
