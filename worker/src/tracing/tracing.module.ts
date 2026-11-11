import { Global, Module } from '@nestjs/common';
import { WorkerTracingService } from './tracing.service';

@Global()
@Module({
  providers: [WorkerTracingService],
  exports: [WorkerTracingService],
})
export class WorkerTracingModule {}
