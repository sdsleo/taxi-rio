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
   - *Risco*: Dessincronização inevitável ao longo do desenvolvimento à medida que as regras forem atualizadas.
2. **Utilizar Apenas `CLAUDE.md` ou Apenas `AGENTS.md`**:
   - *Limitação*: O Antigravity prioriza nativamente `AGENTS.md` e a pasta `.agents/`, enquanto o Claude Code consome prioritariamente `CLAUDE.md` por padrão de sua CLI. Ignorar uma convenção exigiria configuração manual a cada sessão.

### Consequências
- Antigravity e Claude Code leem e executam exatamente as mesmas regras e procedimentos.
- Zero duplicação de regras e esforço de manutenção centralizado.
