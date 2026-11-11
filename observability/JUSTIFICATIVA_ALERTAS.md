# Justificativa Técnica Formal dos Alertas — Taxi.Rio

Este documento formaliza a seleção, fundamentação estatística e limiares operacionais das regras de alerta implementadas para a plataforma **Taxi.Rio**, disponíveis em [alerts.yml](./alerts.yml) (Prometheus nativo) e [alerts-prometheusrule.yaml](./alerts-prometheusrule.yaml) (CRD Kubernetes Prometheus Operator).

---

## 1. Visão Geral da Estratégia de Alertas

Seguindo as melhores práticas de **Site Reliability Engineering (SRE)** (Google SRE Book) e os princípios dos **Four Golden Signals** (Latência, Tráfego, Erros e Saturação), os alertas foram projetados com foco em sintomas reais percebidos pelos cidadãos e na sustentabilidade operacional, prevenindo a fadiga de alertas (_alert fatigue_).

Foram definidas duas regras críticas e complementares:

1. **Sintoma do Usuário (Frontend/API)**: Taxa relativa de erros HTTP 5xx.
2. **Saturação de Infraestrutura Assíncrona (Backend/Mensageria)**: Acúmulo de mensagens pendentes na fila do RabbitMQ.

---

## 2. Alerta 1: Taxa Elevada de Erros HTTP (`HighErrorRate`)

### 2.1. Definição da Regra

- **Métrica Alvo**: `http_requests_total`
- **Expressão PromQL**:
  ```promql
  (sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) > 0.05
  ```
- **Duração (`for`)**: `2m`
- **Severidade**: `critical`

### 2.2. Por que esta Métrica foi Escolhida?

- **Diferenciação Semântica (4xx vs. 5xx)**: Erros 4xx representam entradas inválidas, falhas de autenticação de passageiros ou tentativas não autorizadas de motoristas (problema na ponta do cliente). Em contraste, erros 5xx (Internal Server Error, Bad Gateway) representam diretamente indisponibilidade, exceções não tratadas no código ou perda de conexão da API com os bancos MySQL ou Redis.
- **Normalização por Volume (Taxa Relativa)**: Avaliar a proporção de erros em relação ao tráfego total evita falsos positivos durante a madrugada (quando poucas requisições com uma falha poderiam disparar um alerta absoluto) e garante sensibilidade em horários de pico (quando o volume absoluto de requisições é elevado).

### 2.3. Justificativa do Limiar (5% por 2 minutos)

- **Objetivo de Nível de Serviço (SLO)**: O Taxi.Rio almeja um Service Level Objective (SLO) de disponibilidade de 99.5% ou superior. Uma taxa de falha de 5% contínua representa uma violação grave e imediata do orçamento de erro (_error budget_).
- **Janela de 5 minutos com permanência de 2 minutos (`for: 2m`)**: Filtra oscilações transientes e temporárias de rede que se autorrecuperam rapidamente, garantindo que a equipe de plantão seja acionada somente diante de um incidente consistente e comprovado.

---

## 3. Alerta 2: Acúmulo de Fila RabbitMQ (`RabbitMQQueueBacklogHigh`)

### 3.1. Definição da Regra

- **Métrica Alvo**: `rabbitmq_queue_messages` na fila `taxirio.corridas.queue`
- **Expressão PromQL**:
  ```promql
  rabbitmq_queue_messages{queue="taxirio.corridas.queue"} > 100
  ```
- **Duração (`for`)**: `2m`
- **Severidade**: `warning`

### 3.2. Por que esta Métrica foi Escolhida?

- **Garantia de Desacoplamento e Eventual Consistency**: No Taxi.Rio, a API responde rapidamente ao passageiro e delega tarefas pesadas (atualização de cache em Redis e persistência de histórico de auditoria no MongoDB) de maneira assíncrona ao Worker via RabbitMQ.
- **Indicador Precoce de Degradação (Leading Indicator)**: O acúmulo na fila ocorre antes de qualquer falha catastrófica se manifestar na interface do passageiro. Acompanhar o backlog da fila permite diagnosticar gargalos no Worker antes que os passageiros notem lentidão na atualização do status da corrida.

### 3.3. Justificativa do Limiar (> 100 mensagens por 2 minutos)

- **Capacidade Operacional do Worker**: Cada réplica do Worker consome eventos com _prefetch_ de 10 mensagens e processamento em poucos milissegundos. Um acúmulo sustentado de mais de 100 mensagens por mais de 2 minutos comprova que a taxa de ingestão de eventos superou estruturalmente a capacidade de drenagem do pool de workers.
- **Ação Operacional Clara**: Este alerta serve como indicador direto para o escalonamento horizontal de réplicas do Worker (seja manualmente via `kubectl scale` ou automaticamente via **KEDA - Kubernetes Event-driven Autoscaling**).

---

## 4. Matriz de Severidade e Procedimentos Operacionais (Runbook)

| Alerta                     | Severidade   | Impacto no Usuário                                                                     | Ação Recomendada                                                                                                                |
| :------------------------- | :----------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `HighErrorRate`            | **Critical** | Passageiros incapazes de solicitar corridas; motoristas incapazes de aceitar chamados. | Inspecionar logs estruturados JSON da API (`taxi-rio-api`) filtrando por `level: ERROR` e checar saúde de MySQL e Redis.        |
| `RabbitMQQueueBacklogHigh` | **Warning**  | Atraso na visibilidade de status e atualização de auditoria.                           | Verificar CPU/Memória do Worker (`taxi-rio-worker`), checar latência de escrita no MongoDB e escalar réplicas de processamento. |
