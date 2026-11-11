import { Module } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { MongoModule } from './mongo/mongo.module';
import { ConsumerModule } from './consumer/consumer.module';
import { WorkerMetricsModule } from './metrics/metrics.module';
import { WorkerTracingModule } from './tracing/tracing.module';
import { JsonLogger } from './logging/json-logger.service';

@Module({
  imports: [RedisModule, MongoModule, ConsumerModule, WorkerMetricsModule, WorkerTracingModule],
  controllers: [],
  providers: [JsonLogger],
  exports: [JsonLogger],
})
export class AppModule {}
