# Tarefa Atual (Current Task)

- **Identificador**: Missão 03 — Kubernetes / Orquestração Local & Consolidação de Governança
- **Status**: Concluída (100% dos requisitos de código, infraestrutura e governança atendidos)
- **Objetivo**: Implementação e validação completa das Partes 1, 2 e 3 do DEFAULT.md, contemplando Fundação Monorepo, Observabilidade/Carga, Orquestração Kubernetes com KEDA e Governança/ADRs.

---

## Checklist da Tarefa (Parte 3 — Kubernetes)

- [x] **3.1. Manifestos de Deploy**:
  - [x] `k8s/namespace.yaml` para o namespace `taxi-rio`.
  - [x] `k8s/configmap.yaml` e `k8s/secret.yaml` com separação de configurações e segredos.
  - [x] Deployments e Services para API (`k8s/api/`), Worker (`k8s/worker/`) e UI (`k8s/ui/`).
- [x] **3.2. Probes & Recursos**:
  - [x] `livenessProbe` e `readinessProbe` coerentes (API em `/health` 3000, Worker em `/health` 3001, UI em `/` 80).
  - [x] `requests` e `limits` de CPU/Memória calibrados para cada componente.
- [x] **3.3. Configuração e Segurança**:
  - [x] Parametrização completa sem expor senhas em texto puro.
- [x] **3.4. Bônus (KEDA Scaler)**:
  - [x] `k8s/worker/keda-scaledobject.yaml` escalando o Worker baseado no backlog da fila `taxirio.corridas.queue`.
- [x] **3.5. Documentação Operacional**:
  - [x] `k8s/README.md` com instruções completas para execução no `kind` ou `minikube` e justificativa técnica de dimensionamento.
