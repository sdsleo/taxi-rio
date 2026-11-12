# Registro de Decisões de Arquitetura (ADRs) — Taxi.Rio

Este documento documenta as decisões arquiteturais fundamentais, contextos, alternativas consideradas e suas justificativas.

---

## ADR 01: Estrutura Modular em Monorepo

### Contexto

O sistema Taxi.Rio engloba múltiplos serviços complementares (`api`, `worker`, `ui`, `packages`), com necessidades integradas de testes de carga, orquestração Kubernetes e observabilidade.

### Decisão

Organizar o repositório como um monorepo com estrutura explícita e modular, mantendo separação estrita de camadas e diretórios dedicados a cada componente.

### Alternativas Consideradas

- **Repositórios Múltiplos (Polyrepo)**: Dificultaria a governança conjunta, versionamento de contratos compartilhados em `packages/` e integração de infraestrutura.
- **Ferramental Pesado de Monorepo (Nx / Turborepo)**: Descartado neste estágio inicial para evitar dependências e abstrações prematuras.

### Consequências

- Código organizado por responsabilidade.
- Facilidade de compartilhamento de tipos e contratos sem atrito operacional.

---

## ADR 02: Separação de Runtimes entre API e Worker

### Contexto

Requisições síncronas de passageiros exigem baixa latência e previsibilidade, enquanto processamentos em lote e tarefas assíncronas podem demandar ciclos prolongados de CPU e I/O.

### Decisão

Segregar o atendimento REST (`api/`) e o processamento de background (`worker/`) em processos e diretórios independentes.

### Alternativas Consideradas

- **Processo Único**: Unir HTTP e processamento assíncrono em uma única instância acarretaria risco de degradação da API durante picos de carga de background jobs.

### Consequências

- Cada serviço pode ser escalado de forma independente em ambientes de produção e contêineres (`k8s/`).

---

## ADR 03: Governança Formalizada de Agentes de IA (`.agents/` e `AGENTS.md`)

### Contexto

O desenvolvimento assistido por agentes autônomos requer consistência, respeito a padrões de codificação e rastreabilidade de tarefas.

### Decisão

Criar uma estrutura de governança padronizada com `.agents/` (contendo `rules/`, `skills/` e `memory/`) e `AGENTS.md` como guia mestre.

### Consequências

- Alinhamento de engenharia entre humanos e modelos de IA.
- Padronização no cumprimento de regras de código, UX e arquitetura.

---

## ADR 04: Governança Multiplataforma de IA com Fonte Única de Verdade (Antigravity & Claude Code)

### Contexto

O projeto é mantido utilizando diferentes assistentes de IA e ferramentas de linha de comando (Google Antigravity e Anthropic Claude Code). A manutenção de arquivos de regras redundantes ou descolados gera divergência comportamental, alucinações de escopo e inconsistência de padrões.

### Decisão

Estabelecer o diretório `.agents/rules/` e o arquivo `AGENTS.md` na raiz como a **única fonte de verdade**. O arquivo `CLAUDE.md` atua como um adaptador enxuto específico para a ferramenta Claude Code, importando e referenciando explicitamente `AGENTS.md` sem duplicar nenhuma regra de arquitetura ou engenharia.

### Alternativas Consideradas

1. **Regras Duplicadas em `CLAUDE.md` e `AGENTS.md`**:
   - _Risco_: Dessincronização inevitável ao longo do desenvolvimento à medida que as regras forem atualizadas.
2. **Utilizar Apenas `CLAUDE.md` ou Apenas `AGENTS.md`**:
   - _Limitação_: O Antigravity prioriza nativamente `AGENTS.md` e a pasta `.agents/`, enquanto o Claude Code consome prioritariamente `CLAUDE.md` por padrão de sua CLI. Ignorar uma convenção exigiria configuração manual a cada sessão.

### Consequências

- Antigravity e Claude Code leem e executam exatamente as mesmas regras e procedimentos.
- Zero duplicação de regras e esforço de manutenção centralizado.

---

## ADR 05: Topologia RabbitMQ e Tratamento de Falhas (Topic Exchange e Dead Letter Queue)

### Contexto

A plataforma Taxi.Rio requer comunicação assíncrona desacoplada entre a API síncrona e os processos em background de auditoria e cache. Falhas intermitentes de processamento de eventos não podem bloquear o fluxo principal de corridas nem causar perda silenciosa de dados.

### Decisão

Adotar uma topologia baseada em:

1. **Topic Exchange** (`taxirio.events`): Permite roteamento flexível baseado em chaves semânticas estruturadas (`corrida.criada`, `corrida.status_alterado`, `corrida.*`).
2. **Fila Principal Durável** (`taxirio.corridas.queue`): Fila persistente com confirmação manual de leitura (`noAck: false`), garantindo entrega no modelo _at-least-once_.
3. **Dead Letter Exchange (DLX)** (`taxirio.events.dlx`) e **Dead Letter Queue (DLQ)** (`taxirio.corridas.dlq`): Mensagens rejeitadas após falha irrecuperável ou estouro de tentativas são roteadas automaticamente via `x-dead-letter-exchange` sem reencadeamento infinito que causaria travamento do consumidor (_poison pill_).

### Alternativas Consideradas

- **Direct Exchange**: Muito rígida; impediria que futuros consumidores assinassem tópicos correlacionados (como analytics, notificações push) sem refatoração do produtor.
- **Fanout Exchange**: Inviável para segregação de tipos de eventos, enviando mensagens desnecessárias para todos os canais.
- **Rejeição Simples com requeue (`nack(requeue: true)`)**: Geraria loop infinito e consumo abusivo de CPU/memória caso o payload estivesse malformado.

### Consequências

- Alta resiliência operacional e retenção segura de falhas na DLQ para inspeção manual.
- Roteamento extensível para novos serviços sem impacto na API principal.

---

## ADR 06: Estratégia de Cache com Padrão Cache-Aside no Redis

### Contexto

Consultas frequentes ao estado da corrida (`GET /corridas/:id`) por passageiros e motoristas geram carga repetitiva sobre o banco de dados relacional. É necessário garantir baixa latência (<10ms) de leitura mantendo consistência eventual rigorosa.

### Decisão

Implementar o padrão **Cache-Aside** (Lazy Loading com invalidação orientada a eventos):

1. **Leitura**: A API verifica o Redis sob a chave `corridas:${rideId}`. Em caso de _cache hit_, retorna o objeto desserializado imediatamente com latência inferior a 3ms. Em caso de _cache miss_, busca no MySQL, armazena no Redis com TTL balanceado de 300 segundos (5 minutos) e retorna ao cliente.
2. **Escrita/Atualização**: Na API, a escrita ocorre prioritariamente no MySQL e a chave do Redis é invalidada explicitamente. Concomitantemente, o Worker assíncrono escuta os eventos de alteração de status e atualiza a chave no Redis de forma pró-ativa, aquecendo o cache (_cache warm-up_).

### Alternativas Consideradas

- **Write-Through / Write-Behind**: Adicionaria complexidade desnecessária e dependência síncrona forte entre a API e o Redis durante a escrita da corrida, além de risco de inconsistência caso o Redis falhasse no meio da transação do banco.
- **Refresh-Ahead**: Complexidade prematura sem ganho significativo de latência para o volume previsto.

### Consequências

- Redução drástica (>85%) de consultas diretas de leitura ao MySQL sob concorrência.
- TTL de 300s evita acúmulo de dados órfãos e previne _stale cache_ prolongado.

---

## ADR 07: Estratégia de Idempotência em Duas Camadas (API e Worker)

### Contexto

Em redes móveis instáveis, passageiros e motoristas frequentemente reenviam requisições HTTP devido a timeouts aparentes do cliente. Da mesma forma, no RabbitMQ o modelo de entrega é _at-least-once_, o que pode provocar republicação de mensagens já consumidas.

### Decisão

Adotar uma estratégia de idempotência distribuída em duas camadas complementares:

1. **Camada 1 — HTTP API (Transacional no MySQL)**:
   - Requisições `POST /corridas` exigem o cabeçalho `Idempotency-Key` (UUIDv4).
   - A tabela `idempotency_keys` registra a tupla `(key, user_id, request_hash, response_body, status_code)` protegida por chave primária única.
   - Em caso de reenvio com mesmo payload, a API responde imediatamente com o payload original armazenado, código HTTP 201 e o cabeçalho `X-Idempotent-Replay: true`, evitando a criação duplicada de corridas.
   - Reenvios com mesmo identificador mas payload modificado são rejeitados com erro 422 Unprocessable Entity.
2. **Camada 2 — Worker Assíncrono (Deduplicação no MongoDB)**:
   - A coleção `processed_events` armazena o `event_id` como índice único.
   - Ao receber uma mensagem AMQP, o Worker tenta inserir o registro de processamento antes de executar a mutação. Se ocorrer colisão de chave primária (`MongoServerError: E11000`), a mensagem é identificada como duplicada, ignorada sem reprocessamento e confirmada com `ack`.
   - Um índice TTL de 7 dias expira eventos processados antigos automaticamente.

### Alternativas Consideradas

- **Idempotência Apenas em Memória / Redis**: Descartada pois uma reinicialização de Pods levaria à perda das chaves de idempotência ativas, violando a integridade financeira/operacional.
- **Idempotência Exclusiva no Banco sem Replay Header**: Impediria o cliente de diferenciar execuções inéditas de replays seguros.

### Consequências

- Imunidade ponta a ponta contra cobranças duplicadas, corridas fantasmas e corrupção de dados por instabilidade de rede.

---

## ADR 08: Persistência Poliglota — Segregação entre MySQL e MongoDB

### Contexto

A plataforma Taxi.Rio possui dois tipos fundamentais de dados com características de acesso e integridade diametralmente opostas:

1. O ciclo de vida da corrida (`corridas`) exige consistência imediata, transações ACID, integridade referencial rígida e validação atômica de estados.
2. O registro de trilha de auditoria (`ride_audits`) e eventos processados é estritamente _append-only_, possui schema dinâmico extensível e demanda altíssima vazão de escrita sem contenção de locks de linha.

### Decisão

Adotar arquitetura de persistência poliglota especializada:

- **MySQL 8.0**: Banco de dados relacional de registro (_System of Record_) para entidades transacionais (`corridas` e `idempotency_keys`). Utiliza índices B-Tree compostos para consultas por passageiro, motorista e status.
- **MongoDB 7**: Armazenamento documental analítico e de auditoria para registros históricos de eventos consumidos pelo Worker. Permite anexar snapshots completos de contexto sem overhead de migração de schema DDL.

### Alternativas Consideradas

- **MySQL para Tudo (Monolito Relacional)**: A criação contínua de milhões de registros de auditoria e traces em tabelas relacionais provocaria inchaço de índices (_index bloat_), lock contention e necessidade de particionamento complexo de tabelas.
- **MongoDB para Tudo**: Descartado pois operações concorrentes de atualização de status com validações estritas de estado beneficiam-se da garantia ACID e isolamento transacional relacional.

### Consequências

- Separação limpa de responsabilidades com modelo otimizado para o perfil de cada carga de trabalho.
- Escalonamento horizontal simplificado da camada de auditoria sem impactar as operações centrais de passageiros e motoristas.

---

## ADR 09: Observabilidade Padronizada e Escalonamento Elástico com KEDA

### Contexto

Diagnosticar falhas em ambiente distribuído requer correlação inequívoca entre requisições HTTP, spans de tracing e eventos assíncronos. Além disso, picos repentinos de corridas represadas no RabbitMQ exigem adaptação dinâmica da capacidade de processamento dos Workers.

### Decisão

1. **Rastreabilidade Distribuída**: Adotar **OpenTelemetry (OTel)** como padrão aberto de instrumentação. Propagar `traceparent` (W3C TraceContext) nos cabeçalhos AMQP, vinculando spans da API diretamente ao span do Worker visualizáveis no Jaeger.
2. **Logs Estruturados**: Implementação de `JsonLogger` injetando `correlation_id` e `trace_id` propagados via `AsyncLocalStorage`.
3. **Escalonamento Orientado a Eventos (KEDA)**: Utilizar o operador KEDA no Kubernetes monitorando o backlog da fila `taxirio.corridas.queue`, escalando os Pods do Worker de 1 até 10 instâncias com base no volume de mensagens pendentes (limiar de 20 mensagens por réplica).

### Consequências

- Rastreabilidade ponta a ponta sem silos de observabilidade.
- Auto-recuperação elástica sob picos de tráfego sem desperdício de recursos computacionais ociosos.

---

## Pergunta Obrigatória: Escolha de Broker de Mensageria do Zero

> **"Se você fosse desenvolver esse sistema do zero, sem tecnologias definidas, manteria o RabbitMQ ou optaria por outro broker? Justifique."**

### Parecer Técnico Estruturado

Se o projeto da plataforma Taxi.Rio estivesse sendo projetado a partir de uma folha em branco, sem tecnologias pré-fixadas, a decisão técnica dependeria do escopo de maturidade e da escala pretendida:

#### 1. Decisão para o Cenário da Plataforma Taxi.Rio Atual: **Manter o RabbitMQ**

Para o escopo central de mobilidade urbana municipal do Taxi.Rio (gerenciamento de ciclo de vida de corridas, fila transacional de atribuição e processamento de tarefas em background com confirmações pontuais), o **RabbitMQ se mantém como a escolha técnica mais pragmática e eficiente**:

1. **Semântica de Fila Avançada e Roteamento Flexível**:
   - O modelo de AMQP 0-9-1 com _Topic Exchanges_ e _Bindings_ permite rotear mensagens finamente baseando-se em tópicos sem acoplar os produtores aos consumidores.
   - Possui suporte nativo maduro para **Dead Letter Exchanges (DLX)**, **TTL por mensagem/fila** e **Priority Queues**, essenciais para tratar falhas transacionais e corridas prioritárias (e.g. emergências, frotas especiais da prefeitura).
2. **Confirmação Individual e Descarte Dinâmico**:
   - Cada mensagem é confirmada (`ack`) ou rejeitada (`nack`) individualmente por item. O broker gerencia a entrega a quem está pronto para processar (_competing consumers_), entregando balanceamento automático de carga entre múltiplos pods do Worker.
3. **Baixa Complexidade Operacional e Leveza**:
   - O RabbitMQ consome fração mínima de memória e CPU comparado a ecossistemas baseados em JVM ou clusters de coordenação distribuída (como Zookeeper/KRaft).
   - Integração nativa imediata com o ecossistema Kubernetes via **KEDA (Kubernetes Event-driven Autoscaling)**, permitindo autoscaling preciso baseado diretamente na contagem de mensagens em fila (`QueueLength`).

---

#### 2. Quando Optaríamos por Outro Broker? (Análise Crítica Comparativa)

Caso os requisitos da plataforma de mobilidade fossem expandidos para suportar os seguintes cenários, a escolha migraria conforme abaixo:

| Broker Alternativo          | Quando Seria a Escolha Superior                                                                                                                                                      | Vantagens em Relação ao RabbitMQ                                                                                                                                                                              | Desvantagens / Trade-offs                                                                                                                                                                                               |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Apache Kafka / Redpanda** | **Telemetria de Geolocalização Contínua em Tempo Real**: Milhares de táxis enviando coordenadas GPS a cada 1-2 segundos para rastreamento de mapa, geofencing e analytics preditivo. | **Log de eventos imutável distribuído** com altíssima taxa de ingestão (milhões de eventos/segundo), replay histórico de streams (`offset rewind`) e particionamento ordenado por chave de veículo/motorista. | Não possui filas no sentido tradicional: complexidade massiva para implementar DLQ por item, ausência de roteamento dinâmico tipo _Topic Exchange_, rebalanceamento de partições pesado e alto custo de infraestrutura. |
| **Redis Streams**           | **Microserviço Hiper-Enxuto / Pouca Infraestrutura**: Se a infraestrutura precisasse ser minimalista ao extremo e o Redis já estivesse presente como cache.                          | Zero dependência adicional; latência de microssegundos em memória; grupos de consumidores nativos.                                                                                                            | Persistência secundária com risco de perda em reinicializações sob alta vazão; recursos avançados de DLQ e retentativas exigem implementação manual na aplicação.                                                       |
| **AWS SQS + SNS**           | **Arquitetura 100% Serverless em Nuvem Pública**: Operação totalmente delegada ao provedor de nuvem, sem gestão de clusters.                                                         | Sem manutenção de infraestrutura, escalabilidade virtualmente ilimitada e integração nativa com AWS Lambda e ECS.                                                                                             | _Vendor lock-in_, latência ligeiramente superior ao AMQP local, custos variáveis que explodem sob alto throughput sustentado, e impossibilidade de execução local idêntica sem LocalStack.                              |

### Conclusão Definitiva

Para orquestração de **tarefas transacionais, ciclo de vida de corridas, consistência em background e facilidade de integração local/Kubernetes**, a manutenção do **RabbitMQ é a decisão mais sólida, coesa e proporcional**.

Caso a plataforma evolua para incorporar a camada de **rastreamento contínuo de coordenadas de telemetria da frota municipal**, a arquitetura recomendada seria **híbrida**: **Apache Kafka / Redpanda** para o pipeline de dados de telemetria de alta frequência (streaming), e **RabbitMQ** preservado para a mensageria de negócio e transações de corrida.
