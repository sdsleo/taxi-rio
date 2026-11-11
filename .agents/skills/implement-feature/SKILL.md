# Habilidade: Implementação de Funcionalidades (implement-feature)

Guia procedural para agentes desenvolverem novas funcionalidades no Taxi.Rio de ponta a ponta.

---

## Procedimento

1. **Definição de Contratos (`packages/shared/`)**:
   - Modele ou atualize interfaces, enums e tipos antes de implementar lógica de backend ou telas.
2. **Implementação de Serviços (`api/` ou `worker/`)**:
   - Se síncrono/HTTP, adicione módulos, controllers e services em `api/`.
   - Se assíncrono/background, adicione processadores e manipuladores em `worker/`.
3. **Integração de Interface (`ui/`)**:
   - Conecte a interface aos novos tipos e rotas com tratamento de erros e _loading_.
4. **Verificação Estática e Testes**:
   - Execute checagem estática de tipagem e linters.
   - Escreva testes unitários para a regra desenvolvida.
5. **Documentação e Registro**:
   - Atualize `DECISIONS.md` se houver nova decisão arquitetural.
