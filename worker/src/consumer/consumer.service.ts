import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import {
  RABBITMQ_EXCHANGE,
  RIDE_EVENTS_QUEUE,
  RIDE_CREATED_ROUTING_KEY,
  RIDE_STATUS_UPDATED_ROUTING_KEY,
  IRideCreatedEvent,
  IRideStatusUpdatedEvent,
  UserRole,
  IRideAuditRecord,
  requestContextStorage,
} from '@taxi-rio/shared';
import { RedisService } from '../redis/redis.service';
import { MongoService } from '../mongo/mongo.service';
import { WorkerMetricsService } from '../metrics/metrics.service';
import { WorkerTracingService } from '../tracing/tracing.service';

@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConsuming = false;
  private queueMonitorInterval?: NodeJS.Timeout;

  get isRunning(): boolean {
    return this.isConsuming;
  }

  constructor(
    private readonly redisService: RedisService,
    private readonly mongoService: MongoService,
    private readonly metricsService: WorkerMetricsService,
    private readonly tracingService: WorkerTracingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.startConsumer();
  }

  private async startConsumer(): Promise<void> {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Configurar prefetch (limite de concorrência por worker)
      await this.channel.prefetch(10);

      // Assegurar topologia
      await this.channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(RIDE_EVENTS_QUEUE, { durable: true });

      await this.channel.bindQueue(RIDE_EVENTS_QUEUE, RABBITMQ_EXCHANGE, RIDE_CREATED_ROUTING_KEY);
      await this.channel.bindQueue(
        RIDE_EVENTS_QUEUE,
        RABBITMQ_EXCHANGE,
        RIDE_STATUS_UPDATED_ROUTING_KEY,
      );

      this.isConsuming = true;
      this.logger.log(`Worker conectado ao RabbitMQ e ouvindo a fila [${RIDE_EVENTS_QUEUE}]`);

      await this.channel.consume(
        RIDE_EVENTS_QUEUE,
        async (msg) => {
          if (!msg) return;
          await this.handleMessage(msg);
        },
        { noAck: false }, // Confirmação manual obrigatória
      );

      // Monitoramento do tamanho da fila a cada 10 segundos
      this.queueMonitorInterval = setInterval(async () => {
        try {
          if (this.channel) {
            const queueInfo = await this.channel.checkQueue(RIDE_EVENTS_QUEUE);
            this.metricsService.rabbitmqQueueMessages.set(
              { queue: RIDE_EVENTS_QUEUE },
              queueInfo.messageCount,
            );
          }
        } catch {
          // Ignora erro periódico de verificação de fila
        }
      }, 10000);

      this.connection.on('error', (err) => {
        this.isConsuming = false;
        this.logger.debug(`Aviso de conexão RabbitMQ no Worker: ${err.message}`);
      });

      this.connection.on('close', () => {
        this.isConsuming = false;
        this.logger.warn('Conexão do Worker com o RabbitMQ fechada.');
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `RabbitMQ não acessível para consumo no momento (${errorMsg}). O Worker tentará reconectar quando solicitado.`,
      );
    }
  }

  /**
   * Processador de mensagem com rastreabilidade, métricas e tolerância a duplicatas (at-least-once)
   */
  private async handleMessage(msg: amqp.ConsumeMessage): Promise<void> {
    if (!this.channel) return;

    const routingKey = msg.fields.routingKey;
    const rawContent = msg.content.toString();
    const startTime = process.hrtime();

    let eventCorrelationId = 'unknown_correlation';
    try {
      const parsedEvent = JSON.parse(rawContent) as {
        eventId?: string;
        eventType?: string;
        correlationId?: string;
        timestamp?: string;
        payload?: unknown;
      };
      if (parsedEvent.correlationId) {
        eventCorrelationId = parsedEvent.correlationId;
      }
    } catch {
      // Ignora erro inicial de parse aqui, será tratado no try interno
    }

    const parentContext = this.tracingService.extractContext(
      msg.properties?.headers as Record<string, unknown> | undefined,
    );

    await this.tracingService.withConsumerSpan(
      `rabbitmq.consume:${routingKey}`,
      parentContext,
      async (span) => {
        span.setAttribute('messaging.system', 'rabbitmq');
        span.setAttribute('messaging.destination', RIDE_EVENTS_QUEUE);
        span.setAttribute('messaging.routing_key', routingKey);
        span.setAttribute('correlation_id', eventCorrelationId);

        // Executa todo o processamento contextualizado com o correlation_id propagado
        await requestContextStorage.run(
          {
            correlationId: eventCorrelationId,
            traceId: span.spanContext().traceId,
          },
          async () => {
            try {
              const event = JSON.parse(rawContent) as {
                eventId: string;
                eventType: string;
                correlationId?: string;
                timestamp: string;
                payload: unknown;
              };

              const eventId = event.eventId;

              this.logger.log(
                `Processando mensagem recebida: routingKey=[${routingKey}], eventId=[${eventId}], correlationId=[${eventCorrelationId}]`,
              );

              // 1. Verificação de idempotência (at-least-once message deduplication)
              const alreadyProcessed = await this.mongoService.isEventProcessed(eventId);
              if (alreadyProcessed) {
                this.logger.warn(
                  `Mensagem duplicada detectada (eventId: ${eventId}). Confirmando sem reprocessar.`,
                );
                span.setAttribute('ride.duplicate', true);
                this.metricsService.eventsProcessedTotal.inc({
                  event_type: routingKey,
                  status: 'duplicate',
                });
                this.channel?.ack(msg);
                return;
              }

              // 2. Roteamento por tipo de evento
              if (routingKey === RIDE_CREATED_ROUTING_KEY) {
                await this.handleRideCreated(event as unknown as IRideCreatedEvent);
              } else if (routingKey === RIDE_STATUS_UPDATED_ROUTING_KEY) {
                await this.handleRideStatusUpdated(event as unknown as IRideStatusUpdatedEvent);
              } else {
                this.logger.warn(`Tipo de evento não suportado: [${routingKey}]`);
              }

              // 3. Marcar evento como processado para evitar duplicatas futuras
              await this.mongoService.markEventProcessed(eventId, routingKey);

              // 4. Confirmar processamento ao RabbitMQ
              this.channel?.ack(msg);

              const diff = process.hrtime(startTime);
              const durationSeconds = diff[0] + diff[1] / 1e9;

              this.metricsService.eventsProcessedTotal.inc({
                event_type: routingKey,
                status: 'success',
              });
              this.metricsService.eventProcessingDurationSeconds.observe(
                { event_type: routingKey },
                durationSeconds,
              );

              this.logger.log(
                `Evento [${eventId}] processado e confirmado com sucesso em ${durationSeconds.toFixed(3)}s.`,
              );
            } catch (err: unknown) {
              this.logger.error(`Erro ao processar mensagem da fila [${routingKey}]:`, err);
              this.metricsService.eventsProcessedTotal.inc({
                event_type: routingKey,
                status: 'error',
              });

              // Se a mensagem estiver corrompida (JSON inválido), rejeita sem requeue
              if (err instanceof SyntaxError) {
                this.channel?.nack(msg, false, false);
              } else {
                // Erro transitório de processamento: requeue para nova tentativa
                this.channel?.nack(msg, false, true);
              }
            }
          },
        );
      },
    );
  }

  /**
   * Processa corrida.criada: atualiza Redis e grava auditoria no MongoDB
   */
  private async handleRideCreated(event: IRideCreatedEvent): Promise<void> {
    const ride = event.payload;

    // Atualizar cache no Redis
    await this.redisService.set(`corridas:${ride.id}`, JSON.stringify(ride), 300);

    // Gravar auditoria no MongoDB
    const auditRecord: IRideAuditRecord = {
      eventId: event.eventId,
      rideId: ride.id,
      eventType: event.eventType,
      previousStatus: null,
      newStatus: ride.status,
      changedByUserId: ride.passengerId,
      role: UserRole.PASSENGER,
      correlationId: event.correlationId,
      payload: ride as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };
    await this.mongoService.saveAuditRecord(auditRecord);
  }

  /**
   * Processa corrida.status_alterado: atualiza Redis e grava auditoria no MongoDB
   */
  private async handleRideStatusUpdated(event: IRideStatusUpdatedEvent): Promise<void> {
    const { rideId, previousStatus, newStatus, driverId, updatedAt } = event.payload;

    // Atualizar status no cache do Redis se existir
    const cached = await this.redisService.get(`corridas:${rideId}`);
    if (cached) {
      try {
        const rideObj = JSON.parse(cached) as Record<string, unknown>;
        rideObj['status'] = newStatus;
        if (driverId) rideObj['driverId'] = driverId;
        rideObj['updatedAt'] = updatedAt;
        await this.redisService.set(`corridas:${rideId}`, JSON.stringify(rideObj), 300);
      } catch {
        // Ignora erro no parse do cache
      }
    }

    // Gravar auditoria no MongoDB
    const auditRecord: IRideAuditRecord = {
      eventId: event.eventId,
      rideId,
      eventType: event.eventType,
      previousStatus,
      newStatus,
      changedByUserId: driverId || 'system',
      role: UserRole.DRIVER,
      correlationId: event.correlationId,
      payload: event.payload as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    };
    await this.mongoService.saveAuditRecord(auditRecord);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queueMonitorInterval) {
      clearInterval(this.queueMonitorInterval);
    }
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignora erro no fechamento
    }
  }
}
