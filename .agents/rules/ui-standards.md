# Padrões de Interface e Frontend — Taxi.Rio

Este documento define os princípios de usabilidade, componentes e qualidade para a aplicação `ui/`.

---

## 1. Princípios de Experiência do Usuário (UX)

- **Transparência de Estado**: Operações assíncronas devem evidenciar estados de carregamento (_loading_), sucesso e erro amigável ao cidadão.
- **Resiliência a Falhas de Rede**: Tratar falhas de conectividade ou indisponibilidade da API sem colapsar a interface.
- **Clareza e Simplicidade**: Layout limpo, direto e voltado à utilidade pública do serviço.

---

## 2. Padrões de Componentização

- **Componentes Funcionais**: Uso de React funcional com TypeScript rigoroso.
- **Tipagem de Props**: Toda propriedade de componente deve ser tipada formalmente por `interface` ou `type`.
- **Desacoplamento de Infraestrutura**: Componentes de interface não devem realizar chamadas diretas de infraestrutura; utilize _services_ ou _custom hooks_.

---

## 3. Acessibilidade (a11y)

- Utilização obrigatória de elementos HTML semânticos.
- Atributos `aria-label` e contraste de cores adequado em componentes interativos.
