# Regras de Domínio e Produto — Taxi.Rio

Este documento define os conceitos, entidades e regras fundamentais do domínio de corridas do Taxi.Rio.

---

## 1. Visão Geral

O Taxi.Rio é uma plataforma pública de mobilidade urbana da Prefeitura do Rio de Janeiro cujo objetivo é fornecer um serviço confiável, transparente e acessível para passageiros e taxistas parceiros.

---

## 2. Entidades Principais

- **Passageiro (`Rider`)**: Usuário que solicita a viagem.
- **Motorista (`Driver`)**: Taxista credenciado apto a aceitar e executar viagens.
- **Corrida (`Ride`)**: A representação da viagem, governada por uma máquina de estados estrita.
- **Estimativa (`Estimate`)**: Cálculo de valor e rota baseado em tarifas oficiais do município.

---

## 3. Estados da Corrida

1. `REQUESTED`: Corrida solicitada pelo passageiro, aguardando aceite de um motorista.
2. `ACCEPTED`: Motorista vinculado à corrida e a caminho do ponto de embarque.
3. `IN_PROGRESS`: Passageiro embarcado e viagem em deslocamento.
4. `COMPLETED`: Viagem finalizada no destino.
5. `CANCELLED`: Viagem cancelada antes de sua conclusão por passageiro, motorista ou sistema.

---

## 4. Diretrizes Fundamentais

- **Transições Unidirecionais**: Transições de estado devem respeitar rigorosamente a ordem lógica de negócio.
- **Desacoplamento Assíncrono**: Cálculos intensivos, conciliações e notificações não devem onerar a latência das requisições síncronas de clientes.
