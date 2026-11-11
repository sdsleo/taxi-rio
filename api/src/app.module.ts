import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { CorridasModule } from './corridas/corridas.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { TracingModule } from './tracing/tracing.module';
import { CorrelationMiddleware } from './logging/correlation.middleware';
import { JsonLogger } from './logging/json-logger.service';
import { CorridaEntity } from './database/entities/corrida.entity';
import { IdempotencyEntity } from './database/entities/idempotency.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
      username: process.env.MYSQL_USER || 'taxirio_user',
      password: process.env.MYSQL_PASSWORD || 'taxirio_pass',
      database: process.env.MYSQL_DATABASE || 'taxirio',
      entities: [CorridaEntity, IdempotencyEntity],
      synchronize: false, // Usamos o init.sql como fonte da verdade do schema
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    RedisModule,
    RabbitMQModule,
    CorridasModule,
    MetricsModule,
    TracingModule,
  ],
  controllers: [AppController],
  providers: [
    JsonLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [JsonLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
