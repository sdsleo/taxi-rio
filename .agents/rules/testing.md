# Estratégia de Testes — Taxi.Rio

Este documento define os padrões para validação automatizada de código e confiabilidade do ecossistema.

---

## 1. Pirâmide de Testes

1. **Testes Unitários**:
   - Validação de cálculos tarifários, regras de domínio e transições de estado da corrida.
   - Rápidos, determinísticos e sem dependências de rede ou banco de dados.
2. **Testes de Integração**:
   - Validação de endpoints da API (NestJS e controllers) e ciclo de vida do worker.
3. **Testes de Carga e Concorrência (k6)**:
   - Localizados em `loadtest/`.
   - Medição de latência (p95 e p99), taxa de erro sob carga e estabilidade.

---

## 2. Boas Práticas
- Nomenclatura descritiva de cenários no padrão: `deve [comportamento esperado] quando [condição]`.
- Padrão estrutural `Arrange-Act-Assert` (AAA).
