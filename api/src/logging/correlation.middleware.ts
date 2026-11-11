import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { trace, context } from '@opentelemetry/api';
import { requestContextStorage } from '@taxi-rio/shared';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawCorrelationId = req.headers['x-correlation-id'];
    const correlationId =
      typeof rawCorrelationId === 'string' && rawCorrelationId.trim()
        ? rawCorrelationId.trim()
        : uuidv4();

    // Obtém o traceId do span OpenTelemetry ou do cabeçalho
    const activeSpan = trace.getSpan(context.active());
    const otelTraceId = activeSpan?.spanContext().traceId;

    const rawTraceId = req.headers['x-trace-id'];
    const traceId =
      otelTraceId ||
      (typeof rawTraceId === 'string' && rawTraceId.trim() ? rawTraceId.trim() : uuidv4());

    // Injeta cabeçalhos na resposta para rastreabilidade do cliente
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('x-trace-id', traceId);

    // Armazena no AsyncLocalStorage para o ciclo de vida desta requisição
    requestContextStorage.run(
      {
        correlationId,
        traceId,
      },
      () => {
        next();
      },
    );
  }
}
