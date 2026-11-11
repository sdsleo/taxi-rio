import { Global, Module } from '@nestjs/common';
import { WorkerMetricsService } from './metrics.service';

@Global()
@Module({
  providers: [WorkerMetricsService],
  exports: [WorkerMetricsService],
})
export class WorkerMetricsModule {}
