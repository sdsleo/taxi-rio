import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    // Ignora métricas na própria rota /metrics para não distorcer os dados
    if (req.path === '/metrics') {
      return next.handle();
    }

    const startTime = process.hrtime();
    const method = req.method;
    // Normaliza rota sem query parameters
    const route = req.route?.path || req.baseUrl || req.path || 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(method, route, res.statusCode, startTime);
        },
        error: (error: { status?: number; statusCode?: number }) => {
          const statusCode = error.status || error.statusCode || 500;
          this.recordMetrics(method, route, statusCode, startTime);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startTime: [number, number],
  ): void {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const statusCodeStr = String(statusCode);

    // Incrementa contadores e histograma
    this.metricsService.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCodeStr,
    });

    this.metricsService.httpRequestDurationSeconds.observe(
      {
        method,
        route,
        status_code: statusCodeStr,
      },
      durationSeconds,
    );

    if (statusCode >= 400) {
      this.metricsService.httpErrorsTotal.inc({
        method,
        route,
        status_code: statusCodeStr,
      });
    }
  }
}
