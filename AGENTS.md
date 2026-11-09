# Taxi.Rio — Governança Unificada para Agentes de IA

Este repositório abriga a plataforma de mobilidade **Taxi.Rio** para a Prefeitura da Cidade do Rio de Janeiro.

Este arquivo é a especificação mestre de governança para agentes de IA (**Antigravity**, **Claude Code** e assistentes compatíveis), garantindo uma **única fonte de verdade** para arquitetura, regras de engenharia e estado do projeto.

---

## 1. Princípios de Engenharia Inegociáveis

1. **TypeScript Rigoroso**: Tipagem estrita ponta a ponta (`strict: true`). O uso de `any` é terminantemente proibido.
2. **Arquitetura Modular**:
   - `api/`: API REST HTTP (NestJS) voltada para comandos e consultas de usuários/passageiros.
   - `worker/`: Runtime dedicado ao processamento assíncrono (NestJS) para tarefas não bloqueantes.
   - `ui/`: Interface Web em React + Vite + TypeScript.
   - `packages/`: Pacotes reutilizáveis e agnósticos a frameworks (e.g. `packages/shared`).
   - `observability/`: Configurações de métricas, logs e tracing.
   - `k8s/`: Manifestos para orquestração em Kubernetes.
   - `loadtest/`: Testes de carga e estresse com k6.
3. **Simplicidade e Pragmatismo**: Evite abstrações prematuras. Resolva o problema especificado sem introduzir complexidade ou dependências desnecessárias.
4. **Fonte Única de Verdade**: Toda regra, padrão ou instrução técnica reside em `.agents/rules/` e `.agents/skills/`. Não crie regras paralelas ou contraditórias.

---

## 2. Protocolo Obrigatório de Ciclo de Vida da Tarefa

Todo agente (Antigravity ou Claude Code) **DEVE** seguir rigorosamente este ciclo em qualquer intervenção:

### 2.1. Início da Tarefa (Obrigatório)
1. Inspecione [`.agents/memory/current_task.md`](./.agents/memory/current_task.md) para identificar o escopo e o status ativo.
2. Inspecione [`.agents/memory/memory.md`](./.agents/memory/memory.md) para absorver o contexto consolidado e restrições acumuladas.
3. Leia as regras pertinentes ao escopo da tarefa em `.agents/rules/`:
   - [Product Rules](./.agents/rules/product-rules.md) para regras de negócio e limites de domínio.
   - [Architecture](./.agents/rules/architecture.md) para limites de serviços e comunicação.
   - [Coding Standards](./.agents/rules/coding-standards.md) para TypeScript, estilo e boas práticas.
   - [UI Standards](./.agents/rules/ui-standards.md) para frontend e acessibilidade.
   - [Testing](./.agents/rules/testing.md) para estratégia de testes automatizados.
4. Verifique as fronteiras da etapa atual em [`LIMITES.md`](./LIMITES.md). **Não invente requisitos não solicitados e não implemente regras de negócio antes da etapa correspondente.**

### 2.2. Durante a Execução
1. Consulte os manuais em `.agents/skills/` para o procedimento adequado:
   - [`implement-feature`](./.agents/skills/implement-feature/SKILL.md)
   - [`review-code`](./.agents/skills/review-code/SKILL.md)
   - [`debug-issue`](./.agents/skills/debug-issue/SKILL.md)
2. Não esconda erros de compilação, tipagem ou testes.
3. Se tomar uma nova decisão técnica ou arquitetural estruturante, registre-a formalmente em [`DECISIONS.md`](./DECISIONS.md) (ADR).
4. Registre ocorrências reais, bloqueios e fatos do desenvolvimento em [`DIARIO.md`](./DIARIO.md). **Não invente decisões, experiências ou fatos.**

### 2.3. Fim da Tarefa (Obrigatório)
1. Realize uma revisão das atualizações necessárias em todos os arquivos de governança afetados.
2. Atualize o progresso real no checklist de [`.agents/memory/current_task.md`](./.agents/memory/current_task.md).
3. Se houver aprendizado persistente ou nova premissa consolidada, registre em [`.agents/memory/memory.md`](./.agents/memory/memory.md). **Atenção: Não atualize a memória com informações triviais, logs de depuração temporários ou detalhes operacionais descartáveis.**
4. Apresente ao usuário os arquivos alterados e o resumo objetivo das ações realizadas.

---

## 3. Mapa do Ecossistema `.agents/`

```text
.agents/
├── rules/                             # Regras compartilhadas por todos os agentes
│   ├── product-rules.md               # Regras de negócio e visão de domínio
│   ├── architecture.md                # Fronteiras arquiteturais e comunicação
│   ├── coding-standards.md            # Padrões TypeScript rigorosos e commits
│   ├── ui-standards.md                # Padrões visuais, acessibilidade e UX
│   └── testing.md                     # Estratégia da pirâmide de testes
├── skills/                            # Procedimentos reutilizáveis e operacionais
│   ├── implement-feature/SKILL.md     # Fluxo estruturado de novas funcionalidades
│   ├── review-code/SKILL.md           # Procedimento e checklist de revisão de código
│   └── debug-issue/SKILL.md           # Metodologia de isolamento e diagnóstico
└── memory/                            # Estado e retenção de contexto
    ├── memory.md                      # Contexto consolidado e restrições permanentes
    └── current_task.md                # Estado e checklist em tempo real da tarefa atual
```
