# Limites de Escopo, Premissas e Débitos Técnicos — Taxi.Rio

Este documento explicita as fronteiras técnicas consolidadas da plataforma **Taxi.Rio**, detalhando o escopo entregue, as exclusões conscientes, melhorias planejadas com mais tempo e os riscos operacionais mapeados.

---

## 1. Escopo Efetivamente Entregue

A plataforma foi entregue contemplando as três grandes etapas fundamentais:

- **Parte 1 (Fundação)**: Monorepo TypeScript estrito, contratos unificados em `@taxi-rio/shared`, API NestJS (MySQL + Redis + RabbitMQ + JWT/RBAC + Idempotência), Worker assíncrono (RabbitMQ + Redis + MongoDB + deduplicação de eventos), interface Web React (Passageiro vs. Motorista), suíte de testes com Jest e pipeline de CI GitHub Actions.
- **Parte 2 (Operar)**: Logs estruturados JSON com `correlation_id` e `trace_id` propagados, métricas Prometheus em `/metrics` (API e Worker), tracing distribuído OpenTelemetry com Jaeger, regras de alerta nativas e CRD (`PrometheusRule`) com justificativa formal, e teste de carga k6 com relatório de performance.
- **Parte 3 (Kubernetes)**: Manifestos declarativos em `k8s/` (namespace `taxi-rio`, ConfigMap, Secret em Base64, Deployments com 2 réplicas da API, 1 réplica do Worker e 2 da UI, probes de ciclo de vida coerentes, dimensionamento de CPU/RAM, Kustomize e autoscaler elástico KEDA orientado ao backlog da fila RabbitMQ).

---

## 2. O que NÃO foi Implementado (Exclusões Conscientes de Escopo)

Para garantir foco e profundidade nas diretrizes essenciais de arquitetura, resiliência e observabilidade, as seguintes funcionalidades de negócio avançadas foram deliberadamente mantidas fora do escopo:

1. **Tarifação Dinâmica e Tarifas Regulatórias da Prefeitura**:
   - Não foram implementados cálculos de bandeira 1 vs. bandeira 2, adicionais de bagagem, pedágios da Linha Amarela/Vermelha ou multiplicadores dinâmicos de alta demanda.
2. **Algoritmo Geoespacial de Matching de Proximidade (Geohash / H3 / PostGIS)**:
   - A atribuição da corrida segue um modelo pragmático de aceitação manual pelo motorista via interface web/REST (`PATCH /corridas/:id/status`), sem um motor de busca geoespacial de motoristas num raio de proximidade (e.g., PostGIS `ST_DWithin` ou Uber H3).
3. **Gateway de Pagamento Real (Pix / Cartão de Crédito / Integração Bancária)**:
   - O fluxo foca na integridade do ciclo de vida da corrida e na idempotência contra cobrança duplicada, sem comunicação direta com PSPs externos (como Cielo, Stone ou Banco Central).
4. **Comunicação mTLS entre Pods (Service Mesh)**:
   - O tráfego dentro do cluster Kubernetes opera em rede interna limpa (sem Istio ou Linkerd para mTLS mútuo pod-a-pod).

---

## 3. O que Seria Feito com Mais Tempo

Caso houvesse tempo adicional de desenvolvimento, as seguintes evoluções de engenharia seriam priorizadas:

1. **Circuit Breaker e Bulkhead na API**:
   - Implementação de disjuntores de circuito (usando `@nestjs/terminus` e bibliotecas como `opossum`) nas chamadas para Redis e RabbitMQ. Se o broker ficar temporariamente indisponível, a API entraria em modo degradado (_graceful degradation_) em vez de esgotar o pool de conexões do Node.js.
2. **Rate Limiting Dinâmico Distribuído**:
   - Aplicação de algoritmo _Sliding Window Counter_ no Redis com o pacote `@nestjs/throttler` para proteção contra ataques de negação de serviço (DDoS) ou scraping agressivo de passageiros.
3. **Ingress Controller com Cert-Manager**:
   - Manifestos de `Ingress` (NGINX Ingress Controller ou Traefik) com terminação automática de certificados TLS/SSL via Let's Encrypt para os domínios `api.taxirio.rio.gov.br` e `app.taxirio.rio.gov.br`.
4. **Particionamento de Tabelas Históricas no MySQL**:
   - Particionamento por faixa de data (`RANGE COLUMNS (created_at)`) na tabela `corridas` para acelerar queries analíticas e viabilizar expurgo automatizado de dados com mais de 5 anos (LGPD).
5. **Engenharia de Caos (Chaos Engineering)**:
   - Testes com **Chaos Mesh** ou **LitmusChaos** para simular partição de rede entre Worker e RabbitMQ, lentidão induzida no MySQL e terminação abrupta de Pods sob carga máxima.

---

## 4. Riscos Abertos Mapeados

| Risco Mapeado                                            | Impacto | Probabilidade | Mitigação Implementada / Recomendada                                                                                                                                                                                                                     |
| :------------------------------------------------------- | :------ | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Esgotamento do Pool de Conexões do MySQL**             | Alto    | Média         | **Mitigação**: O pool do TypeORM está fixado em 10 conexões por Pod. Com 2 réplicas da API, consome 20 conexões. Em escalonamento para 10 réplicas, recomendada a adoção de um connection pooler intermediário (como **ProxySQL** ou **AWS RDS Proxy**). |
| **Latência de Inicialização no Scale-Up do KEDA**        | Médio   | Média         | **Mitigação**: O bootstrap do Node.js leva ~2.5s. O KEDA escala a partir de 20 mensagens em fila, permitindo tempo hábil antes que a fila atinja o limiar de alerta crítico (100 msgs).                                                                  |
| **Inconsistência de Cache sob Queda Repentina do Redis** | Baixo   | Baixa         | **Mitigação**: Como o padrão adotado é **Cache-Aside**, qualquer falha no Redis resulta em fallback automático e transparente para o MySQL, preservando a disponibilidade do serviço.                                                                    |
| **Exposição de Segredos em Clusters Locais**             | Médio   | Baixa         | **Mitigação**: O arquivo `k8s/secret.yaml` contém apenas credenciais de desenvolvimento devidamente documentadas. Em ambientes de homologação/produção, é mandatório o uso de **External Secrets Operator** ou **SealedSecrets**.                        |
