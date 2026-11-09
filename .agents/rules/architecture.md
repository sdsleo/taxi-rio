# Diretrizes de Arquitetura — Taxi.Rio

Este documento documenta os limites, as responsabilidades e a topologia dos módulos do monorepo.

---

## 1. Topologia do Sistema

```text
┌─────────────────┐
│       UI        │ (React + Vite + TypeScript)
└────────┬────────┘
         │ HTTP / REST
         ▼
┌─────────────────┐      Mensageria / Eventos      ┌─────────────────┐
│       API       │ ─────────────────────────────▶ │     WORKER      │
│    (NestJS)     │                                │    (NestJS)     │
└────────┬────────┘                                └────────┬────────┘
         │                                                  │
         └────────────────────┐        ┌────────────────────┘
                              ▼        ▼
                      ┌────────────────────────┐
                      │    PACKAGES/SHARED     │
                      │  (Tipos e Contratos)   │
                      └────────────────────────┘
```

---

## 2. Responsabilidades por Componente

- **`api/`**: Camada síncrona HTTP REST. Gerencia entrada de dados, validação de payload, autenticação e despacho de comandos.
- **`worker/`**: Runtime de execução em segundo plano (background). Processa tarefas assíncronas, reconciliação de estados e processamento não bloqueante.
- **`ui/`**: Camada de apresentação visual para o usuário, consumindo a API através de contratos tipados.
- **`packages/shared/`**: Biblioteca de tipos de domínio, enums e DTOs comuns. Neutra e agnóstica de frameworks (sem acoplamento com NestJS ou React).
- **`observability/`**: Configurações de telemetria, métricas Prometheus e logs estruturados.
- **`k8s/`**: Manifestos declarativos para orquestração de contêineres.
- **`loadtest/`**: Scripts de estresse e performance utilizando k6.

---

## 3. Regras de Isolamento
1. A `ui/` e a `api/` nunca compartilham dependências internas diretamente; o compartilhamento de código ocorre exclusivamente via `packages/shared/`.
2. O `worker/` não expõe portas HTTP de atendimento a clientes.
3. Não introduza ferramentas complexas de orquestração de monorepo prematuramente.
