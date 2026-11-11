import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as http from 'http';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class WorkerMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerMetricsService.name);
  private readonly registry: Registry;
  private server?: http.Server;

  public readonly eventsProcessedTotal: Counter<string>;
  public readonly eventProcessingDurationSeconds: Histogram<string>;
  public readonly rabbitmqQueueMessages: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    this.registry.setDefaultLabels({
      service: 'taxi-rio-worker',
    });

    // 1. Contador de eventos processados
    this.eventsProcessedTotal = new Counter({
      name: 'events_processed_total',
      help: 'Total de eventos consumidos e processados pelo worker',
      labelNames: ['event_type', 'status'],
      registers: [this.registry],
    });

    // 2. Latência de processamento de eventos
    this.eventProcessingDurationSeconds = new Histogram({
      name: 'event_processing_duration_seconds',
      help: 'Duração do processamento de eventos em segundos',
      labelNames: ['event_type'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    // 3. Tamanho da fila no RabbitMQ
    this.rabbitmqQueueMessages = new Gauge({
      name: 'rabbitmq_queue_messages',
      help: 'Quantidade aproximada de mensagens pendentes na fila do RabbitMQ',
      labelNames: ['queue'],
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Coleta métricas de runtime Node.js
    collectDefaultMetrics({ register: this.registry, prefix: 'nodejs_' });

    // Inicia servidor HTTP nativo para expor /metrics na porta 3001
    const port = process.env.WORKER_METRICS_PORT
      ? parseInt(process.env.WORKER_METRICS_PORT, 10)
      : process.env.METRICS_PORT
        ? parseInt(process.env.METRICS_PORT, 10)
        : 3001;

    this.server = http.createServer(async (req, res) => {
      if (req.url === '/metrics' && req.method === 'GET') {
        try {
          const metrics = await this.registry.metrics();
          res.writeHead(200, { 'Content-Type': this.registry.contentType });
          res.end(metrics);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(err instanceof Error ? err.message : 'Internal Server Error');
        }
        return;
      }

      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'taxi-rio-worker' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    this.server.listen(port, () => {
      this.logger.log(`Worker Metrics & Health server ouvindo na porta ${port}`);
    });
  }

  onModuleDestroy(): void {
    if (this.server) {
      this.server.close();
    }
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
