import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDurationSeconds: Histogram<string>;
  public readonly httpErrorsTotal: Counter<string>;
  public readonly ridesCreatedTotal: Counter<string>;
  public readonly rideStatusUpdatesTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // Injeta prefixo e labels padrão
    this.registry.setDefaultLabels({
      service: 'taxi-rio-api',
    });

    // 1. Throughput de requisições HTTP
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total de requisições HTTP recebidas pela API',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // 2. Histograma de latência HTTP
    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duração e latência das requisições HTTP em segundos',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // 3. Taxa de erros HTTP (4xx e 5xx)
    this.httpErrorsTotal = new Counter({
      name: 'http_errors_total',
      help: 'Total de requisições HTTP com resposta de erro (4xx e 5xx)',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // 4. Métricas de Domínio do Taxi.Rio
    this.ridesCreatedTotal = new Counter({
      name: 'rides_created_total',
      help: 'Total de corridas solicitadas com sucesso',
      registers: [this.registry],
    });

    this.rideStatusUpdatesTotal = new Counter({
      name: 'ride_status_updates_total',
      help: 'Total de alterações de status de corridas',
      labelNames: ['status'],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Coleta métricas de processo e runtime (memória, CPU, event loop)
    collectDefaultMetrics({ register: this.registry, prefix: 'nodejs_' });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
