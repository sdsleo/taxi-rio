import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import {
  RABBITMQ_EXCHANGE,
  RIDE_EVENTS_QUEUE,
  RIDE_CREATED_ROUTING_KEY,
  RIDE_STATUS_UPDATED_ROUTING_KEY,
  TRideEvent,
} from '@taxi-rio/shared';
import { TracingService } from '../tracing/tracing.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected = false;

  constructor(private readonly tracingService: TracingService) {}

  async onModuleInit(): Promise<void> {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      // Declarar Exchange topic e fila durável
      await this.channel.assertExchange(RABBITMQ_EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(RIDE_EVENTS_QUEUE, { durable: true });

      // Fazer bind dos tópicos principais
      await this.channel.bindQueue(RIDE_EVENTS_QUEUE, RABBITMQ_EXCHANGE, RIDE_CREATED_ROUTING_KEY);
      await this.channel.bindQueue(
        RIDE_EVENTS_QUEUE,
        RABBITMQ_EXCHANGE,
        RIDE_STATUS_UPDATED_ROUTING_KEY,
      );

      this.isConnected = true;
      this.logger.log(`Conectado ao RabbitMQ (${url}) e topologia configurada.`);

      this.connection.on('error', (err) => {
        this.isConnected = false;
        this.logger.debug(`Aviso de conexão RabbitMQ: ${err.message}`);
      });

      this.connection.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Conexão com RabbitMQ fechada.');
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `RabbitMQ não acessível na inicialização: ${errorMsg}. Publicação assíncrona operando em fallback.`,
      );
    }
  }

  async publish(routingKey: string, event: TRideEvent): Promise<boolean> {
    if (!this.channel || !this.isConnected) {
      this.logger.warn(
        `RabbitMQ desconectado. Evento [${routingKey}] para a corrida [${event.eventId}] não pôde ser publicado em tempo real.`,
      );
      return false;
    }

    return this.tracingService.withSpan(`rabbitmq.publish:${routingKey}`, async (span) => {
      try {
        span.setAttribute('messaging.system', 'rabbitmq');
        span.setAttribute('messaging.destination', RABBITMQ_EXCHANGE);
        span.setAttribute('messaging.routing_key', routingKey);
        span.setAttribute('messaging.message_id', event.eventId);
        span.setAttribute('correlation_id', event.correlationId);

        // Injeta cabeçalhos W3C tracecontext (traceparent)
        const traceCarrier: Record<string, string> = {};
        this.tracingService.injectContext(traceCarrier);

        const content = Buffer.from(JSON.stringify(event));
        const published = this.channel?.publish(RABBITMQ_EXCHANGE, routingKey, content, {
          persistent: true,
          contentType: 'application/json',
          messageId: event.eventId,
          timestamp: Date.now(),
          headers: {
            ...traceCarrier,
            correlationId: event.correlationId,
          },
        });

        this.logger.log(`Evento [${routingKey}] publicado com sucesso. ID: ${event.eventId}`);
        return !!published;
      } catch (err: unknown) {
        this.logger.error(`Falha ao publicar evento [${routingKey}] no RabbitMQ:`, err);
        throw err;
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignora erro no shutdown
    }
  }
}
