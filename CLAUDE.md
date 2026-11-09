# Instruções para Claude Code — Taxi.Rio

Este arquivo adapta a governança do repositório para a CLI do **Claude Code**, garantindo alinhamento total com as diretrizes do projeto sem duplicar regras.

---

## 1. Fonte Única de Verdade (Importante)

Todas as diretrizes de engenharia, arquitetura, padrões TypeScript e ciclo de vida do projeto estão centralizadas em:
👉 **[`AGENTS.md`](./AGENTS.md)**

O Claude Code **DEVE** tratar o arquivo [`AGENTS.md`](./AGENTS.md) e o diretório [`.agents/`](./.agents/) como sua fonte autoritativa de verdade. Nunca adote convenções concorrentes ou regras paralelas.

---

## 2. Ciclo Operacional Obrigatório no Claude Code

1. **Início da Intervenção**:
   - Leia imediatamente `.agents/memory/current_task.md` para entender a tarefa ativa.
   - Leia `.agents/memory/memory.md` para resgatar o contexto consolidado.
   - Leia as regras aplicáveis ao escopo em `.agents/rules/` antes de planejar ou gerar código.
   - Respeite estritamente os limites em [`LIMITES.md`](./LIMITES.md).
2. **Durante a Execução**:
   - Utilize as ferramentas de leitura e edição cirurgicamente.
   - Se houver necessidade de nova decisão arquitetural estruturante, registre-a em [`DECISIONS.md`](./DECISIONS.md).
   - Registre ocorrências e bloqueios reais em [`DIARIO.md`](./DIARIO.md) (nunca invente decisões ou experiências).
3. **Fim da Intervenção**:
   - Revise todos os arquivos de governança para verificar se necessitam de atualização.
   - Atualize `.agents/memory/current_task.md` refletindo o progresso real.
   - Atualize `.agents/memory/memory.md` apenas se houver premissas ou aprendizados consolidados (evite informações triviais ou detalhes temporários).
   - Apresente os arquivos alterados ao usuário antes de encerrar.

---

## 3. Diretrizes Específicas da CLI Claude Code

- **Idioma Obrigatório**: Todas as respostas, mensagens de commit e documentações devem ser em português do Brasil (`pt-BR`).
- **Respostas Concisas**: Responda de forma direta e objetiva, priorizando código tipado e links para os arquivos relevantes.
- **Comandos de Terminal**: Ao rodar comandos via Bash tool, execute exclusivamente comandos seguros e previstos no escopo da tarefa atual (nunca instale dependências sem justificativa e alinhamento prévio).
