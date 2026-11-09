# Limites de Escopo, Premissas e Débitos Técnicos — Taxi.Rio

Este documento explicita as fronteiras técnicas desta etapa, os limites do escopo e as premissas adotadas.

---

## 1. Limites do Escopo Atual

### O que NÃO foi implementado
- **Lógica de Negócio**: Não há regras de tarifação dinâmica, atribuição de motoristas ou cálculo geográfico nesta fase de fundação.
- **Banco de Dados e ORM**: Nenhuma camada de persistência relacional ou NoSQL foi introduzida prematuramente.
- **Mecanismos de Fila / Mensageria**: Não há broker externo configurado para permitir foco exclusivo na fundação da estrutura.
- **Autenticação e Sessão**: Não há tokens de autenticação (JWT) ou autorização implementados.

---

## 2. Premissas Técnicas

- **Monorepo Limpo e Modular**: A estrutura do projeto deve permitir a evolução de cada serviço sem acoplamento indevido.
- **Governança Estrita**: Agentes de IA e desenvolvedores devem cumprir os padrões consolidados no diretório `.agents/`.
- **Evolução Incremental**: Nenhuma etapa deve ser queimada ou antecipada antes da validação da etapa anterior.

---

## 3. Débitos Técnicos Conscientes

1. **Serviços sem Runtime Configurado**:
   - Os diretórios `api/`, `worker/`, `ui/` e `packages/` encontram-se atualmente na estrutura de pastas base, sem scripts de runtime pesados ou dependências instaladas.
   - *Resolução*: Serão configurados nas etapas subsequentes com seus respectivos gerenciadores e pacotes mínimos.
2. **Infraestrutura Declarativa em Fase Inicial**:
   - Os diretórios `observability/`, `k8s/` e `loadtest/` estão posicionados como base estrutural para receberem os manifestos e testes em suas respectivas etapas.
