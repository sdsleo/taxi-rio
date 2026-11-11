import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorridaEntity } from '../database/entities/corrida.entity';
import { IdempotencyEntity } from '../database/entities/idempotency.entity';
import { CorridasController } from './corridas.controller';
import { CorridasService } from './corridas.service';

@Module({
  imports: [TypeOrmModule.forFeature([CorridaEntity, IdempotencyEntity])],
  controllers: [CorridasController],
  providers: [CorridasService],
  exports: [CorridasService],
})
export class CorridasModule {}
