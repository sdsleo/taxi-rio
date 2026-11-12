# Taxi.Rio — Plataforma de Mobilidade Urbana

Plataforma de mobilidade urbana da Prefeitura da Cidade do Rio de Janeiro para solicitação, acompanhamento e auditoria de corridas em tempo real.

O projeto é estruturado como um monorepo modular em TypeScript rigoroso (`strict: true`), com persistência poliglota (MySQL, Redis e MongoDB), mensageria assíncrona (RabbitMQ com DLQ), observabilidade completa (Logs estruturados JSON, Métricas Prometheus e Tracing OpenTelemetry com Jaeger) e orquestração em Kubernetes com autoscaling elástico (KEDA).

---

## 1. Arquitetura da Plataforma

```
                        ┌────────────────────────────────────────┐
                        │         Interface Web (React)          │
                        │    Passageiro / Motorista (Porta 5173) │
                        └──────────────────┬─────────────────────┘
                                           │ HTTP / JWT
                                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        API REST (NestJS - Porta 3000)                  │
│  - Autenticação JWT & RBAC (RolesGuard)                                │
│  - Idempotência transacional (Idempotency-Key + MySQL)                 │
│  - Cache-Aside (Redis)                                                 │
│  - Tracing W3C & Métricas Prometheus (/metrics)                        │
└──────────────┬───────────────────┬──────────────────────┬──────────────┘
               │                   │                      │
       Escrita Transacional    Cache-Aside          Publicação AMQP
               │                   │                      │
               ▼                   ▼                      ▼
        ┌─────────────┐     ┌─────────────┐       ┌───────────────┐
        │    MySQL    │     │    Redis    │       │   RabbitMQ    │
        │   (Corridas │     │  (Cache de  │       │(Topic Exchange│
        │ & IdempKey) │     │  Corridas)  │       │     + DLQ)    │
        └─────────────┘     └──────▲──────┘       └───────┬───────┘
                                   │                      │ Consumo Manual
                                   │ Invalidação / Warmup │ (At-least-once)
                                   │                      ▼
                        ┌──────────┴──────────────────────────────┐
                        │       Worker Assíncrono (NestJS)        │
                        │  - Deduplicação idempotente no MongoDB  │
                        │  - Trilha de Auditoria (append-only)    │
                        │  - Atualização pró-ativa de Cache       │
                        │  - Métricas e Probes (Porta 3001)       │
                        └──────────────────┬──────────────────────┘
                                           │
                                  Gravação de Auditoria
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │   MongoDB   │
                                    │  (Auditoria │
                                    │ e Deduplic) │
                                    └─────────────┘
```

---

## 2. Mapa do Repositório

```text
taxi-rio/
├── api/                            # API REST HTTP (NestJS 11, TypeORM, MySQL, Redis, RabbitMQ)
├── worker/                         # Worker assíncrono em background (NestJS 11, RabbitMQ, MongoDB)
├── ui/                             # Interface Web React 19 + Vite + TypeScript
├── packages/
│   └── shared/                     # Contratos de domínio, Enums, DTOs e AsyncLocalStorage
├── observability/                  # Regras de Alerta Prometheus (alerts.yml e PrometheusRule)
├── k8s/                            # Manifestos declarativos Kubernetes e KEDA ScaledObject
├── loadtest/                       # Teste de carga k6 e relatório de performance
├── docker-compose.yml              # Orquestrador local de infraestrutura e serviços
├── DEFAULT.md                      # Checklist mestre de entrega (Partes 1, 2 e 3)
├── DECISIONS.md                    # Registro formal de decisões arquiteturais (ADRs 01 a 09)
├── LIMITES.md                      # Limites de escopo, débitos conscientes e riscos abertos
├── DIARIO.md                       # Diário contínuo de engenharia e fatos reais
├── AGENTS.md                       # Especificação mestre de governança para agentes de IA
└── .agents/                        # Regras compartilhadas, skills e retenção de contexto
```

---

## 3. Guia de Execução Rápida Reproduzível

### 3.1. Pré-requisitos

- **Node.js**: v20+ e **npm**: v10+
- **Docker** e **Docker Compose** instalados e em execução.

### 3.2. Instalação e Validação do Código

Execute a partir da raiz do monorepo:

```bash
# 1. Instalar dependências de todos os workspaces
npm ci

# 2. Validar tipagem TypeScript estrita em todos os pacotes (zero erros permitidos)
npm run typecheck

# 3. Executar suíte de testes automatizados (28 testes unitários e e2e)
npm test

# 4. Verificar padronização de formatação Prettier
npm run format:check
```

### 3.3. Subindo o Ambiente Completo via Docker Compose

Inicie toda a topologia de banco de dados, mensageria, observabilidade e aplicações:

```bash
docker compose up -d --build
```

Acompanhe a inicialização dos serviços até que todos estejam saudáveis (`healthy`):

```bash
docker compose ps
```

---

## 4. Roteiro de Validação e Testes dos Endpoints

### 4.1. Obtenção de Tokens JWT de Demonstração

A API possui um endpoint utilitário que fornece tokens assinados com RBAC para testes:

```bash
curl -s http://localhost:3000/auth/tokens | jq
```

Guarde os tokens retornados para o **Passageiro** (`passenger_token`) e **Motorista** (`driver_token`).

### 4.2. Solicitação de Corrida com Idempotência (Passageiro)

```bash
PASSENGER_TOKEN="<SEU_PASSENGER_TOKEN>"
IDEMPOTENCY_KEY="a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"

curl -s -i -X POST http://localhost:3000/corridas \
  -H "Authorization: Bearer $PASSENGER_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "address": "Copacabana, Rio de Janeiro", "latitude": -22.9698, "longitude": -43.1868 },
    "destination": { "address": "Centro, Rio de Janeiro", "latitude": -22.9068, "longitude": -43.1729 }
  }'
```

_Verificação_: O status HTTP será `201 Created`. Repetindo a mesma requisição com a mesma chave, a API responde `201 Created` contendo o cabeçalho `X-Idempotent-Replay: true`.

### 4.3. Consulta de Corrida com Cache-Aside (Redis)

Substitua `:id` pelo identificador retornado:

```bash
curl -s -i http://localhost:3000/corridas/<ID_DA_CORRIDA> \
  -H "Authorization: Bearer $PASSENGER_TOKEN"
```

_Verificação_: A primeira requisição consulta o MySQL e popula o Redis. As leituras subsequentes retornam diretamente do cache em <3ms.

### 4.4. Transição de Estado da Corrida (Motorista)

O motorista avança o ciclo de vida da corrida respeitando a máquina de estados:

```bash
DRIVER_TOKEN="<SEU_DRIVER_TOKEN>"

# Aceitar a corrida (REQUESTED -> ACCEPTED)
curl -s -i -X PATCH http://localhost:3000/corridas/<ID_DA_CORRIDA>/status \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "ACCEPTED" }'
```

_Verificação_: O evento `corrida.status_alterado` é publicado no RabbitMQ, consumido pelo Worker, registrado em auditoria no MongoDB e o cache do Redis é atualizado automaticamente.

### 4.5. Monitoramento, Métricas e Tracing

- **Interface Web**: `http://localhost:5173`
- **Métricas da API (Prometheus)**: `http://localhost:3000/metrics`
- **Métricas do Worker (Prometheus)**: `http://localhost:3001/metrics`
- **Healthcheck da API**: `http://localhost:3000/health`
- **Healthcheck do Worker**: `http://localhost:3001/health`
- **Prometheus UI & Alertas**: `http://localhost:9090/alerts`
- **Jaeger UI (Tracing Distribuído)**: `http://localhost:16686`
- **RabbitMQ Management**: `http://localhost:15672` (login: `guest` / senha: `guest`)

---

## 5. Orquestração no Kubernetes e Testes de Carga

- **Kubernetes Local (`kind` / `minikube`)**: Instruções completas, manifestos declarativos, probes, sizing de CPU/RAM e autoscaling elástico com KEDA documentados em [`k8s/README.md`](./k8s/README.md).
- **Teste de Carga e Concorrência (k6)**: Script de simulação sob concorrência e relatório completo de throughput e latência p95 disponíveis em [`loadtest/RELATORIO_CARGA.md`](./loadtest/RELATORIO_CARGA.md).

---

## 6. Declaração de Uso de IA (Seção Obrigatória)

Em conformidade com as diretrizes de governança ética e engenharia do projeto, esta seção documenta a atuação dos assistentes de inteligência artificial durante o ciclo de vida do projeto:

### 6.1. Ferramentas Utilizadas e Papéis Desempenhados

- **Google Antigravity**: Utilizado como agente autônomo primário para implementação de código, análise estrutural, configuração de observabilidade OpenTelemetry, orquestração Kubernetes e garantia contínua de tipagem e integridade.
- **Anthropic Claude Code**: Utilizado em conjunto sob governança unificada (`AGENTS.md` e `CLAUDE.md`) consumindo as regras centralizadas em `.agents/rules/`.

### 6.2. Atividades Executadas pelos Agentes

1. Geração de scaffolding estruturado e contratos compartilhados em `@taxi-rio/shared`.
2. Implementação dos serviços NestJS (`api` e `worker`) e componentes React na `ui`.
3. Elaboração de scripts de teste automatizado (Jest unitários e E2E) e cenários de carga com k6.
4. Elaboração de manifestos de infraestrutura (Docker Compose, Kubernetes declarativo, KEDA ScaledObject, Prometheus Alerts).

### 6.3. Exemplos Reais de Sugestões de IA Rejeitadas ou Corrigidas

Durante o desenvolvimento, intervenções humanas e revisões técnicas rigorosas vetaram ou ajustaram sugestões automáticas dos modelos para preservar a integridade da arquitetura:

1. **Rejeição de Idempotência Exclusiva em Memória / Redis**:
   - _Sugestão inicial da IA_: Criar um interceptor de idempotência puramente baseado em Redis com chave temporária expirando em minutos.
   - _Motivo da rejeição_: Em caso de reinicialização dos nós de cache, as chaves de requisições em trânsito seriam perdidas, permitindo a criação de corridas duplicadas sob retentativa.
   - _Correção aplicada_: Implementada a persistência relacional transacional da chave de idempotência na tabela `idempotency_keys` do MySQL para a API (com resposta de replay `X-Idempotent-Replay`) e deduplicação documental no MongoDB para o Worker.
2. **Correção de Conflito de Versões do `@nestjs/testing`**:
   - _Sugestão inicial da IA_: Executar `npm install -D @nestjs/testing` no workspace da API, o qual instalou a versão v12 mais recente.
   - _Problema gerado_: Conflito severo de árvore de dependências (`npm error ERESOLVE`) com o core `@nestjs/common@^11.0.11` já adotado no monorepo.
   - _Correção aplicada_: Fixada explicitamente a dependência em `@nestjs/testing@^11.0.11`, restabelecendo a compilação limpa.
3. **Substituição da API Deprecada de `Resource` no OpenTelemetry**:
   - _Sugestão inicial da IA_: Instanciar o serviço de métricas/tracing com `new Resource({ [ATTR_SERVICE_NAME]: serviceName })`.
   - _Problema gerado_: Erro de compilação no TypeScript em modo estrito (`TS2693: 'Resource' only refers to a type, but is being used as a value here`) devido à evolução da biblioteca `@opentelemetry/resources`.
   - _Correção aplicada_: Substituição pela factory moderna recomendada `resourceFromAttributes(...)`.
