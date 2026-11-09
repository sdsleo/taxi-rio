# Taxi.Rio — Sistema Simplificado de Corridas

Plataforma de mobilidade urbana da Prefeitura da Cidade do Rio de Janeiro.

---

## 1. Visão Geral

O projeto adota uma arquitetura modular em monorepo com separação clara de responsabilidades:

- **`api/`**: Serviço REST HTTP construído em NestJS para atender solicitações de clientes, passageiros e motoristas.
- **`worker/`**: Runtime de processamento assíncrono em segundo plano (NestJS) voltado a tarefas não bloqueantes.
- **`ui/`**: Interface web de usuário desenvolvida com React, Vite e TypeScript.
- **`packages/`**: Pacotes compartilhados contendo tipos de domínio e contratos agnósticos a frameworks.
- **`observability/`**: Configurações de telemetria, logs estruturados e métricas operacionais.
- **`k8s/`**: Manifestos para orquestração em contêineres e deploy em clusters Kubernetes.
- **`loadtest/`**: Cenários de testes de performance e carga com k6.
- **`.agents/`**: Regras, habilidades procedimentais e memória de suporte para agentes de IA colaborativos.
- **`AGENTS.md` & `CLAUDE.md`**: Adaptadores unificados de governança para Antigravity e Claude Code.

---

## 2. Mapa de Diretórios e Arquivos

```text
taxi-rio/
│
├── .agents/
│   ├── rules/
│   │   ├── product-rules.md
│   │   ├── architecture.md
│   │   ├── coding-standards.md
│   │   ├── ui-standards.md
│   │   └── testing.md
│   │
│   ├── skills/
│   │   ├── implement-feature/
│   │   │   └── SKILL.md
│   │   ├── review-code/
│   │   │   └── SKILL.md
│   │   └── debug-issue/
│   │       └── SKILL.md
│   │
│   └── memory/
│       ├── memory.md
│       └── current_task.md
│
├── AGENTS.md
├── CLAUDE.md
├── api/
├── worker/
├── ui/
├── packages/
├── observability/
├── k8s/
├── loadtest/
│
├── DECISIONS.md
├── DIARIO.md
├── LIMITES.md
└── README.md
```

---

## 3. Governança e Decisões Técnicas

Para detalhes das decisões estruturais e alternativas consideradas, veja [`DECISIONS.md`](./DECISIONS.md).  
Para verificar as restrições, premissas e débitos técnicos conscientes, consulte [`LIMITES.md`](./LIMITES.md).  
Para o registro do processo de engenharia, consulte [`DIARIO.md`](./DIARIO.md).
