# Diário de Bordo da Engenharia — Taxi.Rio

Registro histórico cronológico de atividades, evolução de código e decisões técnicas da plataforma.

---

## [Missão 01 — Fundação do Taxi.Rio]

### Data: 2026-11-09

#### 1. Contexto e Objetivos
Definição da fundação estrutural do projeto Taxi.Rio para a Prefeitura da Cidade do Rio de Janeiro. O objetivo foi estabelecer uma base sólida, organizada e pronta para evolução incremental, sem incorporar regras de negócio antecipadas.

#### 2. Entregas Concluídas
- **Estrutura de Pastas e Governança**:
  - Implementação do diretório `.agents/` com suas subestruturas:
    - `.agents/rules/`: Regras de produto, arquitetura, código TypeScript, UI e testes.
    - `.agents/skills/`: Guias procedimentais para implementação de features, revisão de código e depuração.
    - `.agents/memory/`: Memória persistente e checklist da tarefa ativa.
  - Implementação do arquivo mestre `AGENTS.md` na raiz do projeto.
- **Governança Multiplataforma de IA (Antigravity & Claude Code)**:
  - Criação do adaptador `CLAUDE.md` na raiz, importando `AGENTS.md` como fonte única de verdade sem duplicar regras de produto ou arquitetura.
  - Alinhamento do protocolo operacional: leitura de regras e memória no início da tarefa, e revisão de atualizações sem inclusão de dados triviais ao fim da tarefa.
  - Registro formal da ADR 04 em `DECISIONS.md`.
- **Estruturação de Módulos e Serviços**:
  - Diretórios dedicados para os serviços: `api/`, `worker/`, `ui/`, `packages/`.
  - Diretórios para infraestrutura e confiabilidade: `observability/`, `k8s/`, `loadtest/`.
- **Documentação Fundacional**:
  - `README.md`: Visão arquitetural, mapa de diretórios e guias.
  - `DECISIONS.md`: Decisões técnicas com alternativas consideradas.
  - `DIARIO.md`: Este diário de bordo.
  - `LIMITES.md`: Limites explícitos de escopo e premissas.

#### 3. Próximos Passos
- Configuração do monorepo e gerenciador de dependências, tipos compartilhados e aplicações mínimas executáveis.
