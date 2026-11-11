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
- **Persistência Poliglota Especializada**: MySQL 8.0 para dados transacionais ACID (`corridas` e `idempotency_keys`); Redis 7 para padrão _cache-aside_ de leitura em baixa latência (<3ms); MongoDB 7 para trilha de auditoria _append-only_ e deduplicação idempotente de eventos com índice TTL.
- **Idempotência Distribuída em Duas Camadas**: Camada 1 na API respondendo com cabeçalho `X-Idempotent-Replay: true` em caso de reenvio com mesma chave; Camada 2 no Worker com índice único por `event_id` no MongoDB garantindo semântica _at-least-once_ segura.
- **Observabilidade Padronizada**: Spans OpenTelemetry conectados entre API e Worker via propagação W3C TraceContext (`traceparent`) no RabbitMQ; logs estruturados em JSON correlacionados por `correlation_id` e `trace_id` via `AsyncLocalStorage`.
- **Autoscaling Elástico de Background (KEDA)**: No Kubernetes, o Worker é escalado via `ScaledObject` monitorando diretamente o comprimento da fila RabbitMQ (`taxirio.corridas.queue`), evitando gargalos sob picos de demanda.
