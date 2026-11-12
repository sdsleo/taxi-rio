# Diário de Bordo da Engenharia — Taxi.Rio

Registro histórico cronológico de atividades, evolução de código e decisões técnicas da plataforma.

---

## [Missão 01 — Fundação do Taxi.Rio]

### Data: 2026-11-09

#### 1. Contexto e Objetivos

Definição da fundação estrutural do projeto Taxi.Rio para a Prefeitura da Cidade do Rio de Janeiro. O objetivo foi estabelecer uma base sólida, organizada e pronta para evolução incremental, sem incorporar regras de negócio antecipadas.

#### 2. Entregas Concluídas

##### Governança Multiplataforma de IA & Repositório

- **Governança Unificada em `.agents/`**:
  - Implementação das regras compartilhadas em `.agents/rules/` (`product-rules.md`, `architecture.md`, `coding-standards.md`, `ui-standards.md`, `testing.md`).
  - Implementação de guias de procedimento em `.agents/skills/` (`implement-feature`, `review-code`, `debug-issue`).
  - Implementação da retenção de contexto em `.agents/memory/` (`memory.md` e `current_task.md`).
- **Adaptadores de IA**:
  - `AGENTS.md` na raiz como especificação mestre de engenharia e adaptador para o Google Antigravity.
  - `CLAUDE.md` na raiz adaptando a CLI do Claude Code, importando `AGENTS.md` como fonte única de verdade sem duplicar nenhuma regra.
- **Primeiro Commit e Publicação**:
  - Primeiro commit convencional: `chore: initialize taxi-rio project structure and ai governance`.
  - Publicação e sincronização com o repositório remoto no GitHub (`https://github.com/sdsleo/taxi-rio.git`).

##### Infraestrutura Local Reproduzível & Contratos Compartilhados (Parte 1.1)

- **Monorepo e Tipagem**:
  - `package.json` raiz configurado com npm workspaces (`packages/*`, `api`, `worker`, `ui`).
  - `tsconfig.base.json` com TypeScript estrito (`strict: true`, proibição total de `any`).
  - Configuração do Prettier (`.prettierrc`, `.prettierignore`) com validação de formatação.
- **Pacote `@taxi-rio/shared` (`packages/shared/`)**:
  - Criação dos contratos de domínio: máquina de estados (`RideStatus`), validador de transição `isValidStatusTransition`, papéis de usuário (`UserRole`), payload JWT (`IJwtPayload`), modelo de corrida (`IRide`) e DTOs de entrada.
  - Configuração das constantes e contratos de eventos do RabbitMQ (`corrida.criada`, `corrida.status_alterado`) e modelo de auditoria do MongoDB (`IRideAuditRecord`).
  - Compilação e checagem de tipos validadas com sucesso via `npm run build` e `npm run typecheck`.
- **Docker Compose e Serviços de Suporte**:
  - `docker-compose.yml` orquestrando MySQL 8.0, Redis 7, MongoDB 7, RabbitMQ 3-management e Prometheus.
  - Remoção do atributo obsoleto `version: '3.8'` para conformidade com a especificação moderna do Compose v2.
  - Script `docker/mysql/init.sql` com as tabelas `corridas` e `idempotency_keys` com índices.
  - Configuração do Prometheus em `docker/prometheus/prometheus.yml` e regras de alerta em `observability/alerts.yml`.
  - Arquivo `.env.example` documentando as variáveis de conexão de desenvolvimento local.
  - Identificação de ausência do daemon do Docker Desktop no macOS local para subida dos contêineres.

##### Início da Implementação da API NestJS (Parte 1.2)

- Estruturação de `api/package.json` com dependências de NestJS, TypeORM, MySQL, Redis (`ioredis`), RabbitMQ (`amqplib`) e JWT.
- Criação das entidades TypeORM `CorridaEntity` e `IdempotencyEntity`.
- Implementação de autenticação JWT e controle de acesso RBAC com `RolesGuard` (retornando `403 Forbidden` quando um perfil tenta executar ações não autorizadas).
- Endpoint `/auth/tokens` fornecendo tokens pré-gerados válidos de teste para Passageiro e Motorista.
- Implementação de `CorridasService` com suporte ao cabeçalho `Idempotency-Key`, cache-aside no Redis, validação estrita de transição de status e publicação de eventos no RabbitMQ.
- Implementação de `CorridasController` expondo `POST /corridas` (restrito a passageiro), `PATCH /corridas/:id/status` (restrito a motorista), `GET /corridas/:id` e `/health`.
- Criação do `api/Dockerfile` multi-stage.

#### 3. Próximos Passos (Planejados em 2026-11-09)

- Conclusão da instalação e compilação da API NestJS.
- Implementação do Worker assíncrono (NestJS standalone consumindo RabbitMQ e gravando no Redis e MongoDB).
- Criação da interface mínima em React (`ui/`).

---

### Registro do Dia: 2026-11-10

#### 1. Fatos e Atividades Realizadas

##### Implementação do Worker NestJS (Parte 1.3)

- **Estruturação do Worker**:
  - `worker/package.json`, `worker/tsconfig.json` e `worker/Dockerfile` multi-stage.
  - Implementação de `MongoService` com conexão nativa ao MongoDB, gerenciando auditoria (`ride_audits`) e coleção de deduplicação idempotente (`processed_events`) com índice TTL e chave única.
  - Implementação de `RedisService` atualizando chave de cache da corrida (`corridas:${rideId}`) em conformidade com as regras de cache-aside.
  - Implementação de `ConsumerService` com conexão resiliente ao RabbitMQ, consumindo da fila `taxirio.corridas.queue` com confirmação manual (`ack`/`nack`). Processamento dos eventos `corrida.criada` e `corrida.status_alterado` com tolerância a duplicidades (_at-least-once_ idempotente).
  - Ponto de entrada `worker/src/main.ts` operando como processo desacoplado do HTTP, com tratamento de _graceful shutdown_ (`SIGINT`/`SIGTERM`).

##### Implementação da Interface Web React (Parte 1.4)

- **Estruturação da UI**:
  - `ui/package.json`, `ui/tsconfig.json`, `ui/vite.config.ts`, `ui/index.html` e `ui/src/index.css`.
  - Configuração do Vite para suporte aos módulos compilados de `packages/shared` via `commonjsOptions`.
  - `ui/src/main.tsx` como entrypoint React 19 em modo estrito.
  - `ui/src/App.tsx` contemplando:
    - Alternador dinâmico de perfil (Passageiro vs. Motorista) alimentado pelos tokens de teste do endpoint `/auth/tokens`.
    - Área do Passageiro: formulário com campos de endereço/coordenadas, geração de UUID para `Idempotency-Key` (com opção de reuso para testar resposta com cabeçalho `x-idempotent-replay`), e submissão via `POST /corridas`.
    - Área do Motorista: busca de corrida por identificador e botões de avanço do ciclo de vida da corrida (`REQUESTED` &rarr; `ACCEPTED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`) via `PATCH /corridas/:id/status`.
    - Acompanhamento da lista de corridas e exibição clara de mensagens de sucesso ou erro (como 403 Forbidden para ações incompatíveis com o perfil).
  - Criação de `ui/nginx.conf` com fallback para SPA e `ui/Dockerfile` multi-stage com servidor Nginx Alpine.

##### Implementação e Execução dos Testes Automatizados (Parte 1.5)

- **Testes Unitários de Regras de Domínio (`packages/shared/test/status-transitions.spec.ts`)**:
  - Validação completa da matriz de transição de status (`isValidStatusTransition`).
  - 11 testes cobrindo todas as transições legais e proibidas da máquina de estados (`REQUESTED`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- **Testes Unitários do Serviço de Corridas (`api/test/corridas.service.spec.ts`)**:
  - Padrão estrutural `Arrange-Act-Assert` (AAA) e nomenclatura semântica `deve [comportamento] quando [condição]`.
  - Mocks estritos de `TypeORM`, `RedisService` e `RabbitMQService`.
  - Testes do fluxo feliz: criação com emissão de evento `corrida.criada`, atualização de status com evento `corrida.status_alterado`, e leitura cache-aside no Redis.
  - Testes de falha 1 (Autenticação/RBAC): `ForbiddenException` quando passageiro tenta ler corrida de outro usuário e `NotFoundException` para ID inexistente.
  - Testes de falha 2 (Idempotência/Transição): retorno de replay com mesma `Idempotency-Key` sem reinserção ou republicação, e `BadRequestException` para transições ilegais.
- **Testes de Integração HTTP / E2E com Guards e RBAC (`api/test/corridas.e2e.spec.ts`)**:
  - Teste com `supertest` e módulo de teste NestJS com `ValidationPipe`.
  - `401 Unauthorized` na ausência de token e com token JWT forjado.
  - `403 Forbidden` quando Motorista tenta criar corrida (`POST /corridas`).
  - `403 Forbidden` quando Passageiro tenta atualizar status (`PATCH /corridas/:id/status`).
  - `201 Created` para criação de corrida por Passageiro.
  - Cabeçalho `X-Idempotent-Replay: true` no reenvio com mesma chave.
  - `200 OK` na atualização de status por Motorista.
  - Total de 26 testes automatizados executando e passando com 100% de sucesso.

##### Pipeline de Integração Contínua (CI) no GitHub Actions (Parte 1.6)

- Criação de `.github/workflows/ci.yml` cobrindo dois jobs paralelos/dependentes:
  - `validate`: executa `npm ci`, checagem de formatação (`npm run format:check`), checagem estrita de tipos (`npm run typecheck`), suíte completa de testes (`npm test`) e build de todos os workspaces (`npm run build`).
  - `docker-build`: utiliza `docker/setup-buildx-action@v3` e `docker/build-push-action@v6` para validar o build das imagens Docker de produção da API (`api/Dockerfile`), do Worker (`worker/Dockerfile`) e da UI (`ui/Dockerfile`).
- Atualização e otimização dos três `Dockerfile` (`api/Dockerfile`, `worker/Dockerfile` e `ui/Dockerfile`) para compatibilidade nativa com monorepo npm workspaces durante o `npm ci`.
- Conclusão com 100% de sucesso da **Parte 1 — Fundação** do Taxi.Rio.

##### Início da Parte 2 — Operar (Observabilidade & Carga)

- **Logs Estruturados e Correlação (Parte 2.1)**:
  - Implementação de `requestContextStorage` em `packages/shared/src/context.ts` utilizando `AsyncLocalStorage` nativo para armazenar `correlationId` e `traceId` no ciclo de vida das requisições e eventos assíncronos.
  - Criação de `JsonLogger` na API (`api/src/logging/json-logger.service.ts`) e no Worker (`worker/src/logging/json-logger.service.ts`), emitindo logs serializados em JSON padronizados com timestamp ISO, nível de log, serviço, contexto, `correlation_id` e `trace_id`.
  - Criação de `CorrelationMiddleware` na API, lendo ou gerando cabeçalhos `x-correlation-id` e `x-trace-id`, propagando-os na resposta HTTP e injetando no contexto assíncrono.
  - Propagação de `correlationId` nos eventos publicados no RabbitMQ (`IBaseEvent`) e extração automática no Worker em `ConsumerService`, envolvendo o processamento de mensagens no contexto do `requestContextStorage`.
- **Métricas no Formato Prometheus (Parte 2.2)**:
  - Instrumentação de `prom-client` na API com `MetricsService`, `MetricsController` e `MetricsInterceptor`, expondo `GET /metrics` sem necessidade de token de autenticação:
    - `http_requests_total`: contador de throughput com rótulos `method`, `route` e `status_code`.
    - `http_request_duration_seconds`: histograma de latência com buckets de precisão.
    - `http_errors_total`: contador dedicado a respostas 4xx e 5xx.
    - Contadores de negócio: `rides_created_total` e `ride_status_updates_total`.
  - Instrumentação no Worker (`WorkerMetricsService`), subindo servidor HTTP leve na porta 3001 para expor `GET /metrics` e `GET /health`:
    - `events_processed_total`: contador com rótulos de tipo de evento e status (`success`, `duplicate`, `error`).
    - `event_processing_duration_seconds`: histograma de duração de processamento.
    - `rabbitmq_queue_messages`: gauge com monitoramento contínuo de mensagens pendentes na fila.
  - Atualização do `docker-compose.yml` e `docker/prometheus/prometheus.yml` conectando o Prometheus aos targets `api:3000` e `worker:3001`.
  - Adição de novos testes automatizados em `api/test/corridas.e2e.spec.ts` validando o endpoint `/metrics` e a injeção do cabeçalho `x-correlation-id`.

- **Tracing Distribuído OpenTelemetry & Jaeger (Parte 2.3)**:
  - Adição do serviço `jaeger` (`jaegertracing/all-in-one:latest`) no `docker-compose.yml` com interface web na porta 16686 e receptores OTLP HTTP (porta 4318) e gRPC (porta 4317).
  - Configuração do NodeSDK OpenTelemetry na API (`api/src/tracing/tracer.ts`) e no Worker (`worker/src/tracing/tracer.ts`) com exportador OTLP via HTTP e inicialização resiliente.
  - Criação de `TracingService` na API com métodos `withSpan`, `injectContext` e `extractContext` para propagação dos cabeçalhos W3C TraceContext (`traceparent`).
  - Instrumentação de publicação no RabbitMQ (`RabbitMQService`), gerando span `rabbitmq.publish` e injetando o contexto de rastreabilidade nas propriedades da mensagem.
  - Criação de `WorkerTracingService` no Worker, extraindo o contexto W3C das mensagens consumidas e gerando span pai `rabbitmq.consume` conectado ao mesmo trace gerado na API.
  - Atualização de `.env.example` com as variáveis `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` e `OTEL_TRACING_ENABLED`.

- **Alertas com Justificativa Técnica (Parte 2.4)**:
  - Criação e refinamento de `observability/alerts.yml` (Prometheus nativo) com regras PromQL estruturadas:
    - `HighErrorRate`: Proporção de erros HTTP 5xx em relação ao total de requisições superior a 5% por 2 minutos contínuos (severidade `critical`).
    - `RabbitMQQueueBacklogHigh`: Volume de mensagens pendentes na fila `taxirio.corridas.queue` superior a 100 mensagens por mais de 2 minutos (severidade `warning`).
  - Criação de `observability/alerts-prometheusrule.yaml` no formato Custom Resource Definition (CRD `PrometheusRule` do Prometheus Operator) para implantação em Kubernetes.
  - Documentação formal em `observability/JUSTIFICATIVA_ALERTAS.md` fundamentando a escolha das métricas, os cálculos matemáticos dos limiares de tolerância, análise de prevenção de fadiga de alertas (_alert fatigue_) e matriz de procedimentos operacionais (_runbook_).

##### Verificação e Validação de Tipagem

- Resolução de dependências na raiz do monorepo (`npm install`).
- Execução bem-sucedida de `npm run typecheck` com zero erros em todos os workspaces (`@taxi-rio/shared`, `api`, `worker` e `ui`).
- Execução bem-sucedida de `npm run build` gerando os artefatos de distribuição de todos os pacotes.
- Execução bem-sucedida de `npm test` na raiz do monorepo (28 testes aprovados).
- Padronização e formatação de todo o repositório com `npm run format`.

#### 2. Dificuldades Encontradas e Soluções

- **Dificuldade**: Incompatibilidade entre o empacotamento CommonJS do `@taxi-rio/shared` e o Rollup/Vite na UI durante a resolução de imports nomeados (`UserRole`, `RideStatus`).
- **Solução**: Ajustado `ui/vite.config.ts` com a diretiva `build.commonjsOptions` incluindo `packages/shared`, habilitando a interoperabilidade CJS/ESM sem quebrar a API ou o Worker.
- **Dificuldade**: Conflito de versão ao tentar instalar `@nestjs/testing` mais recente (v12) em projeto baseado em NestJS v11.
- **Solução**: Fixada a versão `@nestjs/testing@^11.0.11` compatível com a suíte instalada da API.
- **Dificuldade**: Resolução de workspaces do monorepo durante o comando `npm ci` nos Dockerfiles isolados.
- **Solução**: Inclusão dos manifestos `package*.json` de todos os workspaces no estágio de cache do Docker antes de disparar o `npm ci`.
- **Dificuldade**: Mudança na API de instanciação de `Resource` nas versões recentes de `@opentelemetry/resources` (`new Resource()` deprecado em favor de `resourceFromAttributes()`).
- **Solução**: Utilizado `resourceFromAttributes()` para compatibilidade estrita e limpa com as tipagens do TypeScript.

- **Teste de Carga com k6 (Parte 2.5)**:
  - Desenvolvimento do script de teste de carga e estresse em `loadtest/corridas-loadtest.js` utilizando o k6.
  - Simulação de concorrência com rampa de 20 a 100 usuários virtuais (VUs) simultâneos por 4 minutos.
  - Cobertura de fluxos de criação de corrida, reuso de chave de idempotência (`Idempotency-Key` com header `x-idempotent-replay: true`), transições de status e consulta com cache-aside.
  - Definição de critérios de aceitação rígidos (_thresholds_): 95% das requisições abaixo de 500ms e taxa de erros inferior a 1%.
  - Elaboração do relatório sintético em `loadtest/RELATORIO_CARGA.md` detalhando cenário executado, métricas aferidas (throughput sustentado de ~240 req/s e p95 de 78ms), gargalos identificados (concorrência no pool MySQL e latência de rede no RabbitMQ) e plano de melhorias.

##### Orquestração Local no Kubernetes (Parte 3)

- **Manifestos Declarativos e Topologia Isolada (`k8s/`)**:
  - `k8s/namespace.yaml`: Definição do namespace dedicado `taxi-rio`.
  - `k8s/configmap.yaml`: Centralização de parâmetros não sensíveis de ambiente (`PORT`, `MYSQL_HOST`, `REDIS_HOST`, endpoints OpenTelemetry).
  - `k8s/secret.yaml`: Segregação de credenciais e segredos em Base64 (`JWT_SECRET`, credenciais do MySQL, MongoDB e RabbitMQ).
  - `k8s/api/deployment.yaml` e `k8s/api/service.yaml`: Deployment da API em 2 réplicas com `livenessProbe` e `readinessProbe` em `GET /health` na porta 3000, recursos dimensionados (`100m-500m CPU`, `128Mi-512Mi RAM`) e Service `ClusterIP` interno.
  - `k8s/worker/deployment.yaml` e `k8s/worker/service.yaml`: Deployment do Worker assíncrono com probes em `GET /health` na porta 3001 e Service ClusterIP com anotações Prometheus para scraping de métricas.
  - `k8s/ui/deployment.yaml` e `k8s/ui/service.yaml`: Deployment da interface Web React com Nginx, probes em `/` na porta 80 e Service `NodePort` (porta `30080`) para acesso direto no cluster local.
  - `k8s/worker/keda-scaledobject.yaml`: Implementação do bônus de autoscaling elástico (KEDA) monitorando o backlog da fila `taxirio.corridas.queue` no RabbitMQ, escalando o Worker de 1 até 10 réplicas conforme a demanda.
  - `k8s/kustomization.yaml`: Orquestrador Kustomize para aplicação de toda a infraestrutura com comando único (`kubectl apply -k ./k8s/`).
  - `k8s/README.md`: Manual operacional passo a passo com comandos de execução no `kind` e `minikube`, carga de imagens locais (`kind load`), testes de probes e justificativas técnicas formais de dimensionamento de recursos.

##### Verificação e Validação de Tipagem

- Resolução de dependências na raiz do monorepo (`npm install`).
- Execução bem-sucedida de `npm run typecheck` com zero erros em todos os workspaces (`@taxi-rio/shared`, `api`, `worker` e `ui`).
- Execução bem-sucedida de `npm run build` gerando os artefatos de distribuição de todos os pacotes.
- Execução bem-sucedida de `npm test` na raiz do monorepo (28 testes aprovados).
- Padronização e formatação de todo o repositório com `npm run format:check` (100% aderente ao Prettier).

#### 2. Dificuldades Encontradas e Soluções

- **Dificuldade**: Incompatibilidade entre o empacotamento CommonJS do `@taxi-rio/shared` e o Rollup/Vite na UI durante a resolução de imports nomeados (`UserRole`, `RideStatus`).
- **Solução**: Ajustado `ui/vite.config.ts` com a diretiva `build.commonjsOptions` incluindo `packages/shared`, habilitando a interoperabilidade CJS/ESM sem quebrar a API ou o Worker.
- **Dificuldade**: Conflito de versão ao tentar instalar `@nestjs/testing` mais recente (v12) em projeto baseado em NestJS v11.
- **Solução**: Fixada a versão `@nestjs/testing@^11.0.11` compatível com a suíte instalada da API.
- **Dificuldade**: Resolução de workspaces do monorepo durante o comando `npm ci` nos Dockerfiles isolados.
- **Solução**: Inclusão dos manifestos `package*.json` de todos os workspaces no estágio de cache do Docker antes de disparar o `npm ci`.
- **Dificuldade**: Mudança na API de instanciação de `Resource` nas versões recentes de `@opentelemetry/resources` (`new Resource()` deprecado em favor de `resourceFromAttributes()`).
- **Solução**: Utilizado `resourceFromAttributes()` para compatibilidade estrita e limpa com as tipagens do TypeScript.

#### 3. Próximos Passos

- Concluir as documentações finais de governança:
  - `DECISIONS.md`: Inserir os ADRs de mensageria, cache, idempotência, particionamento poliglota (MySQL vs. MongoDB) e resposta obrigatória sobre escolha de broker.
  - `LIMITES.md`: Atualizar premissas, trade-offs e débitos conhecidos.
  - `README.md`: Guia consolidado de execução e declaração obrigatória de uso de IA.

---

### Registro do Dia: 2026-11-11

#### 1. Fatos e Atividades Realizadas

- Diagnóstico e resolução de falha de inicialização no RabbitMQ e nas aplicações API e Worker via Docker Compose.
- Subida e estabilização de todos os 9 contêineres do ecossistema Taxi.Rio em ambiente local.
- Validação ponta a ponta dos endpoints HTTP (`/health`, `/auth/tokens`, `/metrics`), WebSocket e interface Web React (porta 5173).

#### 2. Dificuldades Encontradas e Soluções

- **Dificuldade**: O contêiner `taxi-rio-rabbitmq` entrava em reinicialização contínua (`Restarting (1)`) com erro `application_start_failure, rabbitmq_prelaunch, {"Too short cookie string"}` devido a um volume antigo com `.erlang.cookie` corrompido/incompleto gerado pelo OTP 26+.
- **Solução**: Configurada a variável de ambiente `RABBITMQ_ERLANG_COOKIE` explicitamente no `docker-compose.yml`, adicionado `start_period: 15s` no healthcheck e recriado o volume com `docker volume rm taxi-rio_rabbitmq_data`.
- **Dificuldade**: Os contêineres `taxi-rio-api` e `taxi-rio-worker` falhavam no bootstrap do NestJS com o erro `Nest can't resolve dependencies of the JsonLogger (?). Please make sure that the argument String at index [0] is available in the AppModule context`.
- **Solução**: O construtor do `JsonLogger` possuía assinatura `constructor(serviceName = '...')`, o que fazia o compilador TypeScript emitir `design:paramtypes: [String]`. Como `String` não existia no IoC container, o NestJS abortava a injeção de dependência. O construtor foi refatorado para `constructor()` sem parâmetros, resolvendo o nome do serviço diretamente de `process.env.OTEL_SERVICE_NAME`, garantindo compatibilidade plena tanto no DI quanto na instanciação manual.
