import { Injectable } from '@nestjs/common';
import {
  context,
  propagation,
  Span,
  SpanStatusCode,
  ROOT_CONTEXT,
  Context,
} from '@opentelemetry/api';
import { getTracer } from './tracer';

@Injectable()
export class WorkerTracingService {
  private readonly tracer = getTracer('taxi-rio-worker');

  /**
   * Extrai o contexto W3C dos cabeçalhos da mensagem RabbitMQ
   */
  extractContext(headers?: Record<string, unknown>): Context {
    if (!headers) return ROOT_CONTEXT;

    const carrier: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        carrier[key.toLowerCase()] = value;
      }
    }

    return propagation.extract(ROOT_CONTEXT, carrier);
  }

  /**
   * Executa uma função vinculada a um span de rastreamento do worker
   */
  async withConsumerSpan<T>(
    name: string,
    parentContext: Context,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    return context.with(parentContext, async () => {
      return this.tracer.startActiveSpan(name, async (span: Span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (err: unknown) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.message : String(err),
          });
          span.recordException(err as Error);
          throw err;
        } finally {
          span.end();
        }
      });
    });
  }
}
