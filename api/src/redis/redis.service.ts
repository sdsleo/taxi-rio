import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  onModuleInit(): void {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

    try {
      this.client = new Redis({
        host,
        port,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(
              `Redis não disponível em ${host}:${port}. Operando em modo fallback sem cache.`,
            );
            return null; // para de tentar reconectar agressivamente para não travar
          }
          return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Conectado ao Redis em ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.debug(`Aviso de conexão com Redis: ${err.message}`);
      });

      void this.client.connect().catch((err: Error) => {
        this.logger.warn(
          `Falha ao conectar inicialmente ao Redis: ${err.message}. Cache desabilitado.`,
        );
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Não foi possível inicializar cliente Redis: ${errorMsg}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (err: unknown) {
      this.logger.debug(`Erro ao buscar chave ${key} no Redis: ${String(err)}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (err: unknown) {
      this.logger.debug(`Erro ao gravar chave ${key} no Redis: ${String(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }
    try {
      await this.client.del(key);
    } catch (err: unknown) {
      this.logger.debug(`Erro ao deletar chave ${key} no Redis: ${String(err)}`);
    }
  }

  onModuleDestroy(): void {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
