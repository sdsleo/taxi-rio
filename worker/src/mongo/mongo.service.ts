import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';
import { IRideAuditRecord } from '@taxi-rio/shared';

interface IProcessedEventDoc {
  eventId: string;
  eventType: string;
  processedAt: Date;
}

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;

  async onModuleInit(): Promise<void> {
    const uri =
      process.env.MONGO_URI ||
      'mongodb://mongoadmin:mongopassword@localhost:27017/taxirio_audit?authSource=admin';

    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db('taxirio_audit');
      this.isConnected = true;
      this.logger.log('Worker conectado ao MongoDB com sucesso.');

      // Criar índices essenciais para auditoria e deduplicação
      const auditsCol = this.getAuditsCollection();
      if (auditsCol) {
        await auditsCol.createIndex({ rideId: 1, timestamp: -1 });
        await auditsCol.createIndex({ correlationId: 1 });
      }

      const eventsCol = this.getProcessedEventsCollection();
      if (eventsCol) {
        // Índice único por eventId para garantia de idempotência no processamento
        await eventsCol.createIndex({ eventId: 1 }, { unique: true });
        // Índice de expiração automática (TTL de 7 dias)
        await eventsCol.createIndex({ processedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `MongoDB não acessível na inicialização: ${errorMsg}. Operando em modo tolerante a falhas.`,
      );
    }
  }

  getAuditsCollection(): Collection<IRideAuditRecord> | null {
    return this.db ? this.db.collection<IRideAuditRecord>('ride_audits') : null;
  }

  getProcessedEventsCollection(): Collection<IProcessedEventDoc> | null {
    return this.db ? this.db.collection<IProcessedEventDoc>('processed_events') : null;
  }

  /**
   * Verifica se o evento já foi processado anteriormente (Garantia de idempotência at-least-once)
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const col = this.getProcessedEventsCollection();
    if (!col || !this.isConnected) return false;
    try {
      const found = await col.findOne({ eventId });
      return found !== null;
    } catch {
      return false;
    }
  }

  /**
   * Marca o evento como processado
   */
  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    const col = this.getProcessedEventsCollection();
    if (!col || !this.isConnected) return;
    try {
      await col.insertOne({
        eventId,
        eventType,
        processedAt: new Date(),
      });
    } catch (err: unknown) {
      this.logger.debug(`Evento ${eventId} já marcado ou erro de inserção: ${String(err)}`);
    }
  }

  /**
   * Grava o registro de auditoria da corrida
   */
  async saveAuditRecord(record: IRideAuditRecord): Promise<void> {
    const col = this.getAuditsCollection();
    if (!col || !this.isConnected) {
      this.logger.warn(
        `MongoDB offline. Auditoria para a corrida [${record.rideId}] não foi persistida.`,
      );
      return;
    }
    try {
      await col.insertOne(record);
      this.logger.log(
        `Auditoria gravada no MongoDB para a corrida [${record.rideId}], evento [${record.eventType}].`,
      );
    } catch (err: unknown) {
      this.logger.error(`Erro ao salvar auditoria no MongoDB:`, err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}
