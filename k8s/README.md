# Orquestração Kubernetes — Taxi.Rio

Este diretório contém os manifestos declarativos do **Kubernetes** para implantação e operação da plataforma de mobilidade urbana **Taxi.Rio** em clusters locais (`kind`, `k3d` ou `minikube`) e em ambientes gerenciados de nuvem.

---

## 1. Visão Geral da Topologia no Kubernetes

Todos os componentes são implantados dentro do namespace dedicado `taxi-rio`, garantindo isolamento de recursos, governança de acesso e segurança:

| Componente | Tipo de Recurso            | Réplicas     | Portas           | Probes                | Dimensionamento (Req / Lim)             |
| :--------- | :------------------------- | :----------- | :--------------- | :-------------------- | :-------------------------------------- |
| **API**    | `Deployment` + `ClusterIP` | 2            | `3000/TCP`       | `GET /health` (:3000) | `100m - 500m CPU` / `128Mi - 512Mi RAM` |
| **Worker** | `Deployment` + `ClusterIP` | 1..10 (KEDA) | `3001/TCP`       | `GET /health` (:3001) | `100m - 500m CPU` / `128Mi - 512Mi RAM` |
| **UI Web** | `Deployment` + `NodePort`  | 2            | `80/TCP` (30080) | `GET /` (:80)         | `20m - 100m CPU` / `32Mi - 128Mi RAM`   |

---

## 2. Estrutura de Arquivos

```text
k8s/
├── namespace.yaml                  # Namespace taxi-rio
├── configmap.yaml                  # Variáveis de ambiente não sensíveis
├── secret.yaml                     # Credenciais e segredos em Base64
├── kustomization.yaml              # Orquestrador Kustomize declarativo
├── README.md                       # Este manual operacional
├── api/
│   ├── deployment.yaml             # Deployment da API NestJS (2 réplicas)
│   └── service.yaml                # Service ClusterIP interno
├── worker/
│   ├── deployment.yaml             # Deployment do Worker assíncrono
│   ├── service.yaml                # Service para métricas/healthcheck
│   └── keda-scaledobject.yaml      # Autoscaler elástico orientado a fila AMQP
└── ui/
    ├── deployment.yaml             # Deployment da UI Web React + Nginx
    └── service.yaml                # Service NodePort (porta 30080)
```

---

## 3. Passo a Passo de Execução Local

### 3.1. Pré-requisitos

- **Docker** instalando e em execução.
- **kubectl** configurado.
- **kind** (ou **minikube**) instalado.

### 3.2. Criando o Cluster Local com `kind`

Crie um cluster local mapeando a porta `30080` para expor o NodePort da interface Web:

```bash
cat <<EOF | kind create cluster --name taxirio-cluster --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30080
    hostPort: 30080
    protocol: TCP
EOF
```

### 3.3. Construção e Carga das Imagens Docker

Gere as imagens a partir da raiz do monorepo e carregue-as diretamente nos nós do `kind`:

```bash
# 1. Build das imagens
docker build -t taxi-rio-api:latest -f ./api/Dockerfile .
docker build -t taxi-rio-worker:latest -f ./worker/Dockerfile .
docker build -t taxi-rio-ui:latest -f ./ui/Dockerfile .

# 2. Injeção direta das imagens no cluster kind (sem necessidade de registry remoto)
kind load docker-image taxi-rio-api:latest --name taxirio-cluster
kind load docker-image taxi-rio-worker:latest --name taxirio-cluster
kind load docker-image taxi-rio-ui:latest --name taxirio-cluster
```

### 3.4. Aplicação Declarativa dos Manifestos

Aplique todos os recursos de uma única vez utilizando o Kustomize nativo do `kubectl`:

```bash
kubectl apply -k ./k8s/
```

### 3.5. Verificação da Implantação

Acompanhe a inicialização dos recursos até que todos os Pods estejam no estado `Running` e `Ready`:

```bash
# Listar Pods
kubectl get pods -n taxi-rio -o wide

# Listar Services e Portas
kubectl get svc -n taxi-rio

# Acompanhar logs em tempo real
kubectl logs -f deployment/taxi-rio-api -n taxi-rio
kubectl logs -f deployment/taxi-rio-worker -n taxi-rio
```

### 3.6. Acessando a Aplicação

- **Interface Web (Passageiro / Motorista)**: `http://localhost:30080`
- **API REST (via port-forward para testes locais)**:
  ```bash
  kubectl port-forward svc/api 3000:3000 -n taxi-rio
  ```
  Acesse: `http://localhost:3000/health` e `http://localhost:3000/metrics`
- **Worker (Métricas & Health)**:
  ```bash
  kubectl port-forward svc/worker 3001:3001 -n taxi-rio
  ```
  Acesse: `http://localhost:3001/health` e `http://localhost:3001/metrics`

---

## 4. Justificativa Técnica: Probes & Ciclo de Vida

Tanto na API quanto no Worker e na UI, configuramos pares de `readinessProbe` e `livenessProbe` estritamente alinhados ao comportamento do runtime Node.js/NestJS e Nginx:

### 4.1. API (`api/deployment.yaml`)

- **Readiness Probe (`GET /health`)**:
  - `initialDelaySeconds: 10`, `periodSeconds: 5`, `timeoutSeconds: 2`, `failureThreshold: 2`.
  - _Justificativa_: Garante que o tráfego HTTP só seja roteado após a inicialização dos módulos do NestJS, compilação de rotas e estabelecimento do pool com MySQL, Redis e RabbitMQ.
- **Liveness Probe (`GET /health`)**:
  - `initialDelaySeconds: 15`, `periodSeconds: 10`, `timeoutSeconds: 3`, `failureThreshold: 3`.
  - _Justificativa_: Se o Event Loop travar ou a aplicação entrar em deadlock de conexões por 3 checagens consecutivas (30 segundos), o Kubernetes reinicia o Pod automaticamente para restabelecer a saúde do serviço.

### 4.2. Worker (`worker/deployment.yaml`)

- **Readiness Probe (`GET /health`)**:
  - `initialDelaySeconds: 10`, `periodSeconds: 5`.
  - _Justificativa_: O servidor HTTP nativo na porta 3001 só retorna status saudável quando as conexões com o RabbitMQ, Redis e MongoDB estão ativas e os canais de consumo estão prontos.
- **Liveness Probe (`GET /health`)**:
  - `initialDelaySeconds: 15`, `periodSeconds: 10`.
  - _Justificativa_: Detecta situações em que o processo do Node.js perdeu heartbeat de I/O assíncrono ou ficou irresponsivo.

### 4.3. UI Nginx (`ui/deployment.yaml`)

- **Readiness e Liveness (`GET /`)**:
  - `initialDelaySeconds: 3` a `5`.
  - _Justificativa_: Como o Nginx é um binário C de inicialização imediata (<200ms), probes rápidas garantem tráfego limpo instantaneamente.

---

## 5. Justificativa Técnica: Dimensionamento de Recursos (`requests` / `limits`)

Os limites foram dimensionados com base nos dados reais coletados durante a execução do **teste de carga k6** ([`loadtest/RELATORIO_CARGA.md`](../loadtest/RELATORIO_CARGA.md)):

### 5.1. API NestJS

- **CPU**: `requests: 100m` | `limits: 500m`
  - _Justificativa_: O Node.js roda em single-thread para processamento JavaScript. Em repouso, consome ~15-25m de CPU. Sob concorrência de 100 VUs, o consumo eleva-se para ~250m-350m de CPU. O teto de 500m (meio core) garante folga sem provocar throttling agressivo pelo CFS (_Completely Fair Scheduler_).
- **Memória**: `requests: 128Mi` | `limits: 512Mi`
  - _Justificativa_: O heap base do NestJS com TypeORM aloca ~70-90MB após o bootstrap. O limite de 512Mi fornece margem de 4x contra picos de tráfego e previne terminação por _OOMKilled_ (_Out-Of-Memory_), respeitando a cota padrão do coletor de lixo da V8.

### 5.2. Worker Assíncrono

- **CPU**: `requests: 100m` | `limits: 500m`
  - _Justificativa_: Processamento de lotes AMQP, decodificação JSON e inserções no MongoDB exigem pulsos de CPU. O valor de 100m garante agendamento sem starvation, permitindo expansão até 500m durante rajadas de mensagens.
- **Memória**: `requests: 128Mi` | `limits: 512Mi`
  - _Justificativa_: Evita exaustão de memória durante bufferização de mensagens em fila no cliente AMQP.

### 5.3. UI (Nginx)

- **CPU**: `requests: 20m` | `limits: 100m`
- **Memória**: `requests: 32Mi` | `limits: 128Mi`
  - _Justificativa_: Nginx servindo arquivos estáticos (HTML/JS/CSS) e operando como reverse-proxy reverso tem pegada extremamente enxuta (<10MB em repouso).

---

## 6. Autoscaling Orientado a Eventos com KEDA (Bônus 3.4)

O manifesto [`worker/keda-scaledobject.yaml`](./worker/keda-scaledobject.yaml) implementa escalonamento automático baseado no tamanho da fila RabbitMQ, superando as limitações do HPA padrão do Kubernetes (que escala apenas por CPU/RAM):

### 6.1. Como Instalar o KEDA no Cluster

```bash
# Adicionar repositório Helm do KEDA
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

# Instalar KEDA no namespace keda
helm install keda kedacore/keda --namespace keda --create-namespace
```

### 6.2. Regra de Escalonamento do ScaledObject

```yaml
triggers:
  - type: rabbitmq
    metadata:
      protocol: amqp
      queueName: taxirio.corridas.queue
      mode: QueueLength
      value: '20' # A cada 20 mensagens represadas na fila, KEDA solicita mais 1 pod
```

- **Mínimo de Réplicas**: 1 (mantém consumo contínuo sem cold start).
- **Máximo de Réplicas**: 10 (impede sobrecarga nos bancos de dados downstream).
- **Cooldown**: 60 segundos com estabilização para evitar flapping (_scale-down_ prematuro).

---

## 7. Configuração e Segurança

1. **Separação de Responsabilidade**:
   - [`configmap.yaml`](./configmap.yaml) armazena variáveis não sensíveis de configuração e parâmetros de observabilidade.
   - [`secret.yaml`](./secret.yaml) encapsula chaves criptográficas (`JWT_SECRET`) e credenciais de bancos de dados.
2. **Evolução para Produção**:
   - Os valores em `secret.yaml` são codificados em Base64 para fins de demonstração e execução local.
   - Para ambientes de produção, recomenda-se a substituição por operadores de segredos como **HashiCorp Vault**, **AWS Secrets Manager via External Secrets Operator (ESO)** ou **Bitnami SealedSecrets**.
