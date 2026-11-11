import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

// Inicializa o SDK OpenTelemetry antes de carregar o contexto do Worker
import './tracing/tracer';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './logging/json-logger.service';

async function bootstrap() {
  const jsonLogger = new JsonLogger();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: jsonLogger,
  });
  app.enableShutdownHooks();

  jsonLogger.log(
    'Worker assíncrono Taxi.Rio em execução e aguardando eventos do RabbitMQ...',
    'Bootstrap',
  );

  const shutdown = async (signal: string) => {
    jsonLogger.log(
      `Sinal [${signal}] recebido. Encerrando contexto do Worker graciosamente...`,
      'Shutdown',
    );
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err: unknown) => {
  const jsonLogger = new JsonLogger();
  jsonLogger.error(
    'Falha fatal ao inicializar o Worker Taxi.Rio:',
    err instanceof Error ? err.stack : String(err),
    'Bootstrap',
  );
  process.exit(1);
});
