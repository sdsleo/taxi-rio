import { Injectable } from '@nestjs/common';
import {
  trace,
  context,
  propagation,
  Span,
  SpanStatusCode,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
import { getTracer } from './tracer';

@Injectable()
export class TracingService {
  private readonly tracer = getTracer('taxi-rio-api');

  /**
   * Obtém o trace_id do span ativo, ou gera identificador seguro
   */
  getCurrentTraceId(): string | null {
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      const spanCtx = activeSpan.spanContext();
      if (spanCtx.traceId) {
        return spanCtx.traceId;
      }
    }
    return null;
  }

  /**
   * Executa uma operação síncrona ou assíncrona dentro de um novo span filho
   */
  async withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
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
  }

  /**
   * Injeta os cabeçalhos W3C TraceContext (traceparent) no objeto carreador (ex: headers de mensagem)
   */
  injectContext(carrier: Record<string, string>): Record<string, string> {
    propagation.inject(context.active(), carrier);
    return carrier;
  }

  /**
   * Extrai o contexto W3C TraceContext a partir de um carrier
   */
  extractContext(carrier: Record<string, string>) {
    return propagation.extract(ROOT_CONTEXT, carrier);
  }
}
