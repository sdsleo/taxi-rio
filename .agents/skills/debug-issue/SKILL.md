# Habilidade: Diagnóstico e Correção de Falhas (debug-issue)

Metodologia estruturada para isolamento e resolução de anomalias no Taxi.Rio.

---

## Procedimento de Depuração

1. **Reprodução Determinística**:
   - Mapeie o cenário exato, parâmetros de entrada e ambiente que disparam a anomalia.
2. **Análise de Logs e Telemetria**:
   - Verifique logs de aplicação no `api` ou `worker`, códigos de resposta HTTP e tempos de resposta.
3. **Isolamento de Causa Raiz**:
   - Isole se a falha reside em discrepância de contrato (`packages/shared`), lógica interna de serviço ou conectividade.
4. **Aplicação de Correção Mínima**:
   - Implemente o reparo mais enxuto e seguro, evitando refatorações oportunistas fora do escopo do bug.
5. **Prevenção de Regressão**:
   - Adicione teste automatizado que reproduza o cenário problemático para blindar futuras alterações.
