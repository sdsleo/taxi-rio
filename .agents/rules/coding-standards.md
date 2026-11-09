# Padrões de Código e TypeScript — Taxi.Rio

Este guia define as convenções de implementação, qualidade e estilo de código para o Taxi.Rio.

---

## 1. Padrões de TypeScript
- **Compilação Estrita**: Obrigatório `strict: true`. O uso de `@ts-ignore` ou `@ts-nocheck` é proibido sem justificativa crítica formalmente documentada.
- **Proibição de `any`**: O tipo `any` não deve ser utilizado. Utilize `unknown` acompanhado de validação de tipos (*type guards* ou asserções) para dados de entrada imprevisíveis.
- **Tipagem Explícita**: Funções públicas, rotas de API e contratos de dados compartilhados devem declarar tipos de retorno e de argumentos explicitamente.
- **Imutabilidade**: Utilize a diretiva `readonly` para propriedades imutáveis de contratos e objetos de domínio.

---

## 2. Nomenclatura e Convenções
- **Arquivos**: `kebab-case.ts` ou `kebab-case.tsx`.
- **Classes, Interfaces e Tipos**: `PascalCase`.
- **Funções e Variáveis**: `camelCase`.
- **Enums**: Nome do enum em `PascalCase` e membros em `UPPER_SNAKE_CASE`.

---

## 3. Gestão de Erros
- Não silencie exceções com blocos `catch` vazios.
- Trate ou propague erros com mensagens e códigos compreensíveis.
- Não exponha stack traces ou dados sensíveis em respostas públicas de API.

---

## 4. Commits Convencionais
- `feat`: nova funcionalidade
- `fix`: correção de defeito
- `docs`: alterações em documentação
- `chore`: manutenção, infraestrutura e build
- `refactor`: refatoração sem alteração de comportamento
- `test`: testes automatizados
- `ci`: fluxos de integração contínua
