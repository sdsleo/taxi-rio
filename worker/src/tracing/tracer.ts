import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, Tracer } from '@opentelemetry/api';

const isTracingEnabled = process.env.OTEL_TRACING_ENABLED !== 'false';
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
const serviceName = process.env.OTEL_SERVICE_NAME || 'taxi-rio-worker';

let sdk: NodeSDK | null = null;

if (isTracingEnabled) {
  const exporter = new OTLPTraceExporter({
    url: endpoint,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    traceExporter: exporter,
  });

  try {
    sdk.start();
  } catch (err) {
    // Falha silenciosa para não quebrar inicialização se Jaeger estiver indisponível
    // eslint-disable-next-line no-console
    console.warn(`[OpenTelemetry] Não foi possível iniciar exportador OTLP no Worker: ${err}`);
  }

  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .catch((err) => console.error('[OpenTelemetry Worker] Erro ao encerrar SDK:', err));
  });
}

export const getTracer = (name = 'taxi-rio-worker'): Tracer => {
  return trace.getTracer(name);
};

export default sdk;
