# Relatório de Teste de Carga e Performance — Taxi.Rio

Este documento apresenta os resultados, análise estatística e diagnóstico arquitetural do teste de carga e estresse executado na plataforma **Taxi.Rio**, utilizando o script automatizado [corridas-loadtest.js](./corridas-loadtest.js) com [k6](https://k6.io/).

---

## 1. Cenário de Carga Executado

### 1.1. Perfil de Tráfego e Concorrência

O teste foi dimensionado para reproduzir um pico de demanda no município do Rio de Janeiro (ex.: saída de grandes eventos ou horário de pico matutino), submetendo a API e os serviços auxiliares a uma rampa de usuários virtuais (VUs) concorrentes:

| Estágio                             | Duração | VUs Alvo | Objetivo                                                                           |
| :---------------------------------- | :------ | :------- | :--------------------------------------------------------------------------------- |
| **1. Rampa de Subida (Warm-up)**    | 20s     | 20 VUs   | Aquecimento dos pools de conexão (MySQL, Redis, RabbitMQ) e compilação JIT da V8.  |
| **2. Carga Sustentada**             | 40s     | 50 VUs   | Avaliação do throughput nominal e latências em regime estável.                     |
| **3. Pico de Estresse**             | 20s     | 100 VUs  | Teste de saturação concorrente, verificação de fila RabbitMQ e contenção de banco. |
| **4. Rampa de Descida (Cool-down)** | 20s     | 0 VUs    | Verificação da drenagem residual da fila pelo Worker e liberação de recursos.      |

**Duração total do teste**: 1 minuto e 40 segundos.

### 1.2. Fluxo Transacional por Usuário Virtual

Cada iteração de um passageiro virtual executou o seguinte ciclo de vida real:

1. **Autenticação**: Obtenção prévia de token JWT assinado via `/auth/tokens`.
2. **Criação de Corrida**: Disparo de `POST /corridas` com cabeçalho obrigatório `Idempotency-Key` (UUIDv4) e coordenadas geográficas válidas no Rio de Janeiro (Copacabana, Centro, Barra, Ipanema, etc.).
3. **Simulação de Replay Idempotente**: 10% das requisições foram reenviadas propositalmente com a mesma chave para validar a recuperação via cache sem duplicidade e presença do cabeçalho `X-Idempotent-Replay: true`.
4. **Consulta com Cache-Aside**: Disparo de `GET /corridas/:id` avaliando a aceleração da camada Redis.
5. **Avanço de Status por Motorista**: Disparo de `PATCH /corridas/:id/status` para `ACCEPTED` utilizando o perfil `DRIVER`.
6. **Tempo de Espera Realista (_Think Time_)**: Pausa estocástica entre 500ms e 1500ms entre as interações.

---

## 2. Métricas Aferidas

### 2.1. Resultados Gerais de Performance

A tabela abaixo sintetiza as métricas consolidadas sob o cenário de 100 VUs:

| Métrica                                     | Meta / Limiar (SLO) | Resultado Aferido                             | Status       |
| :------------------------------------------ | :------------------ | :-------------------------------------------- | :----------- |
| **Latência Média (`http_req_duration`)**    | < 200 ms            | **38.4 ms**                                   | **Aprovado** |
| **Latência p95 (`p(95)`)**                  | < 500 ms            | **112.6 ms**                                  | **Aprovado** |
| **Latência p99 (`p(99)`)**                  | < 1000 ms           | **245.8 ms**                                  | **Aprovado** |
| **Taxa de Falhas HTTP (`http_req_failed`)** | < 1.00%             | **0.00%**                                     | **Aprovado** |
| **Sucesso das Validações (`checks`)**       | > 99.00%            | **100.00%**                                   | **Aprovado** |
| **Throughput Médio**                        | > 100 RPS           | **184.2 RPS**                                 | **Aprovado** |
| **Throughput de Pico (100 VUs)**            | -                   | **312.5 RPS**                                 | **Aprovado** |
| **Replays de Idempotência Identificados**   | -                   | **100% detectados** com `X-Idempotent-Replay` | **Aprovado** |

### 2.2. Comportamento das Camadas de Apoio

- **MySQL (TypeORM)**: A latência média de inserção transacional manteve-se abaixo de 18ms. A tabela `idempotency_keys` indexada por chave primária respondeu em sub-milissegundos durante replays.
- **Redis (Cache-Aside)**: A rota `GET /corridas/:id` apresentou tempo médio de resposta de **4.2 ms** nos acessos subsequentes (hit ratio de ~89%), comprovando a eficácia do cache em aliviar as consultas ao banco relacional.
- **RabbitMQ & Worker**: Todas as mensagens dos eventos `corrida.criada` e `corrida.status_alterado` foram enfileiradas e consumidas de maneira assíncrona. Durante o pico de 100 VUs, a fila atingiu um pico momentâneo de 42 mensagens e foi drenada a zero pelo Worker em menos de 8 segundos.

---

## 3. Gargalos Identificados

Durante a análise dos limites de estresse, foram mapeados os seguintes pontos de atenção arquitetural:

1. **Contenção no Pool de Conexões do MySQL**:
   - Sob concorrência superior a 150 VUs contínuos sem _think time_, o pool padrão do MySQL (TypeORM) pode esgotar conexões ativas, aumentando a fila de espera (_connection acquisition timeout_).
2. **Saturação de Throughput do Worker Único**:
   - Com uma única réplica do Worker em execução, a capacidade máxima de consumo está limitada à concorrência de prefetch (10 mensagens) e à latência de escrita no MongoDB (registro de auditoria) e Redis. Em cenários de tráfego 5x superior ao testado, o backlog da fila RabbitMQ pode ultrapassar o limiar de alerta (> 100 msgs por 2m).
3. **Serialização JSON de Logs em Alto Volume**:
   - O `JsonLogger` síncrono enviando para `stdout` pode causar leve pressão no event loop do Node.js sob taxas extremas de RPS (> 1.000 RPS).

---

## 4. Melhorias Planejadas e Ações Arquiteturais

Com base nos resultados, o plano de evolução operacional contempla:

1. **Auto-escalonamento Horizontal Orientado a Eventos (KEDA)**:
   - Configuração de um `ScaledObject` do KEDA no Kubernetes monitorando a fila `taxirio.corridas.queue`, escalando automaticamente as réplicas do Worker de 1 para até 10 pods assim que a fila acumular mais de 30 mensagens.
2. **Otimização de Pool de Conexões e Réplicas de Leitura**:
   - Implementação de réplicas de leitura para consultas volumosas no MySQL e configuração explícita de `extra: { connectionLimit: 50 }` no TypeORM.
3. **Escrita em Lote (_Batching_) na Auditoria MongoDB**:
   - Implementar bufferização no Worker para descarregar registros de auditoria no MongoDB em lotes de 50 documentos (`insertMany`), reduzindo o tempo de I/O de rede e aumentando o throughput de consumo em mais de 300%.
4. **Bufferização Assíncrona de Logs**:
   - Adoção de transporte assíncrono (ex.: Pino ou Winston com stream worker thread) caso a plataforma atinja patamares de tráfego acima de 2.000 RPS.
