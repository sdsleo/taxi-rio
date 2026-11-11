import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

// Inicializa o SDK OpenTelemetry antes de carregar o NestJS
import './tracing/tracer';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { JsonLogger } from './logging/json-logger.service';

async function bootstrap() {
  const jsonLogger = new JsonLogger();
  const app = await NestFactory.create(AppModule, {
    logger: jsonLogger,
  });

  // Habilitar CORS para permitir comunicação com o frontend React
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type, Accept, Authorization, Idempotency-Key, X-Correlation-ID, X-Trace-ID',
    exposedHeaders: 'X-Idempotent-Replay, X-Correlation-ID, X-Trace-ID',
  });

  // Validação estrita de todos os payloads de entrada
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  jsonLogger.log(`API Taxi.Rio operando na porta ${port}`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  const jsonLogger = new JsonLogger();
  jsonLogger.error(
    'Falha fatal ao inicializar a API Taxi.Rio:',
    err instanceof Error ? err.stack : String(err),
    'Bootstrap',
  );
  process.exit(1);
});
