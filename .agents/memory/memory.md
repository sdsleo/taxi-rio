# Memória Permanente de Agentes — Taxi.Rio

Registro persistente de aprendizados, decisões estruturais e diretrizes consolidadas de governança.

---

## 1. Restrições Gerais e Inegociáveis
- **Governança Multiplataforma**: Antigravity e Claude Code compartilham estritamente a mesma fonte de verdade em `.agents/` e `AGENTS.md`. Nenhuma regra deve ser duplicada.
- **Linguagem**: TypeScript com modo estrito ponta a ponta (`strict: true`, proibição de `any`).
- **Arquitetura**: Monorepo modular (`api`, `worker`, `ui`, `packages`, `observability`, `k8s`, `loadtest`).
- **Comunicação entre Serviços**: Isolamento total entre `api/` e `ui/`; reutilização de tipos exclusivamente através de `packages/shared/`.
- **Rigor Documental**: Toda decisão arquitetural é documentada em `DECISIONS.md`. Ocorrências reais e bloqueios são registrados em `DIARIO.md`. Nunca inventar experiências ou fatos.

---

## 2. Decisões Históricas Consolidadas
- **Adaptadores de IA**: `AGENTS.md` na raiz atua como adaptador principal para Antigravity; `CLAUDE.md` na raiz atua como adaptador para Claude Code apontando para `AGENTS.md`.
- **Processos Independentes**: A API HTTP (NestJS) e o Worker assíncrono (NestJS) operam em tempos de execução distintos para evitar acoplamento de ciclo de vida e degradação mútua de recursos.
