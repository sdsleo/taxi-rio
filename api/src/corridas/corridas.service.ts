import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  RideStatus,
  UserRole,
  IRide,
  isValidStatusTransition,
  RIDE_CREATED_ROUTING_KEY,
  RIDE_STATUS_UPDATED_ROUTING_KEY,
  IRideCreatedEvent,
  IRideStatusUpdatedEvent,
} from '@taxi-rio/shared';
import { CorridaEntity } from '../database/entities/corrida.entity';
import { IdempotencyEntity } from '../database/entities/idempotency.entity';
import { CreateRideDto } from './dto/create-ride.dto';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class CorridasService {
  private readonly logger = new Logger(CorridasService.name);

  constructor(
    @InjectRepository(CorridaEntity)
    private readonly corridaRepo: Repository<CorridaEntity>,
    @InjectRepository(IdempotencyEntity)
    private readonly idempotencyRepo: Repository<IdempotencyEntity>,
    private readonly redisService: RedisService,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  /**
   * Criação de corrida com suporte a idempotência (Idempotency-Key)
   */
  async createRide(
    passengerId: string,
    dto: CreateRideDto,
    idempotencyKey?: string,
    correlationId = uuidv4(),
  ): Promise<{ data: IRide; isIdempotentReplay: boolean }> {
    // 1. Verificar idempotência se o cabeçalho for informado
    if (idempotencyKey) {
      const existing = await this.idempotencyRepo.findOne({
        where: { idempotencyKey },
      });

      if (existing) {
        this.logger.log(
          `Requisição idempotente detectada para chave [${idempotencyKey}]. Retornando resposta em cache.`,
        );
        return {
          data: existing.responseBody as unknown as IRide,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Calcular preço estimado simples baseado nas coordenadas
    const latDiff = Math.abs(dto.origin.latitude - dto.destination.latitude);
    const lonDiff = Math.abs(dto.origin.longitude - dto.destination.longitude);
    const estimatedDistanceKm = (latDiff + lonDiff) * 111; // aproximação 1 grau ~ 111km
    const baseFare = 6.0;
    const kmRate = 3.2;
    const calculatedPrice = Number(
      Math.max(baseFare, baseFare + estimatedDistanceKm * kmRate).toFixed(2),
    );

    // 3. Montar e persistir no MySQL (Fonte da Verdade)
    const corrida = this.corridaRepo.create({
      id: uuidv4(),
      passengerId,
      driverId: null,
      status: RideStatus.REQUESTED,
      originLatitude: dto.origin.latitude,
      originLongitude: dto.origin.longitude,
      originAddress: dto.origin.address ?? null,
      destinationLatitude: dto.destination.latitude,
      destinationLongitude: dto.destination.longitude,
      destinationAddress: dto.destination.address ?? null,
      price: calculatedPrice,
    });

    const saved = await this.corridaRepo.save(corrida);
    const domainRide = saved.toDomain();

    // 4. Salvar registro de idempotência no MySQL
    if (idempotencyKey) {
      try {
        const idempotencyRecord = this.idempotencyRepo.create({
          idempotencyKey,
          resourceId: domainRide.id,
          statusCode: 201,
          responseBody: domainRide as unknown as Record<string, unknown>,
        });
        await this.idempotencyRepo.save(idempotencyRecord);
      } catch (err: unknown) {
        this.logger.warn(`Falha ao registrar idempotency key [${idempotencyKey}]: ${String(err)}`);
      }
    }

    // 5. Atualizar cache no Redis (Cache-Aside / Write-Through inicial)
    await this.redisService.set(
      `corridas:${domainRide.id}`,
      JSON.stringify(domainRide),
      300, // 5 minutos
    );

    // 6. Publicar evento no RabbitMQ
    const event: IRideCreatedEvent = {
      eventId: uuidv4(),
      eventType: RIDE_CREATED_ROUTING_KEY,
      timestamp: new Date().toISOString(),
      correlationId,
      payload: domainRide,
    };
    void this.rabbitmqService.publish(RIDE_CREATED_ROUTING_KEY, event);

    return { data: domainRide, isIdempotentReplay: false };
  }

  /**
   * Transição de status da corrida com validação da máquina de estados
   */
  async updateStatus(
    rideId: string,
    driverId: string,
    nextStatus: RideStatus,
    correlationId = uuidv4(),
  ): Promise<IRide> {
    const corrida = await this.corridaRepo.findOne({ where: { id: rideId } });

    if (!corrida) {
      throw new NotFoundException(`Corrida com ID [${rideId}] não foi encontrada.`);
    }

    const currentStatus = corrida.status;

    // Validação estrita da máquina de estados
    if (!isValidStatusTransition(currentStatus, nextStatus)) {
      throw new BadRequestException(
        `Transição de status inválida: não é permitido alterar de [${currentStatus}] para [${nextStatus}].`,
      );
    }

    // Se estiver sendo aceita, vincula o motorista
    if (nextStatus === RideStatus.ACCEPTED) {
      if (corrida.driverId && corrida.driverId !== driverId) {
        throw new BadRequestException('Esta corrida já foi aceita por outro motorista.');
      }
      corrida.driverId = driverId;
    }

    corrida.status = nextStatus;
    const updated = await this.corridaRepo.save(corrida);
    const domainRide = updated.toDomain();

    // Atualizar cache no Redis
    await this.redisService.set(`corridas:${domainRide.id}`, JSON.stringify(domainRide), 300);

    // Publicar evento de alteração no RabbitMQ
    const event: IRideStatusUpdatedEvent = {
      eventId: uuidv4(),
      eventType: RIDE_STATUS_UPDATED_ROUTING_KEY,
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        rideId: domainRide.id,
        previousStatus: currentStatus,
        newStatus: nextStatus,
        driverId: corrida.driverId,
        updatedAt: domainRide.updatedAt,
      },
    };
    void this.rabbitmqService.publish(RIDE_STATUS_UPDATED_ROUTING_KEY, event);

    return domainRide;
  }

  /**
   * Consulta de corrida com Cache-Aside no Redis e controle de acesso RBAC
   */
  async getRideById(rideId: string, userId: string, role: UserRole): Promise<IRide> {
    const cacheKey = `corridas:${rideId}`;

    // 1. Tentar leitura no Redis primeiro (Cache Hit)
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      try {
        const ride = JSON.parse(cachedData) as IRide;
        // Validação de RBAC para passageiro
        if (role === UserRole.PASSENGER && ride.passengerId !== userId) {
          throw new ForbiddenException(
            'Acesso negado: passageiros só podem visualizar suas próprias corridas.',
          );
        }
        return ride;
      } catch (err: unknown) {
        if (err instanceof ForbiddenException) throw err;
        this.logger.debug(
          `Falha no parse do cache do Redis para chave [${cacheKey}], buscando no MySQL.`,
        );
      }
    }

    // 2. Cache Miss: buscar no MySQL (Fonte da Verdade)
    const corrida = await this.corridaRepo.findOne({ where: { id: rideId } });
    if (!corrida) {
      throw new NotFoundException(`Corrida com ID [${rideId}] não encontrada.`);
    }

    const domainRide = corrida.toDomain();

    // Validação de RBAC: passageiro só pode ler as próprias corridas
    if (role === UserRole.PASSENGER && domainRide.passengerId !== userId) {
      throw new ForbiddenException(
        'Acesso negado: passageiros só podem visualizar suas próprias corridas.',
      );
    }

    // Popula o cache no Redis para leituras subsequentes
    await this.redisService.set(cacheKey, JSON.stringify(domainRide), 300);

    return domainRide;
  }

  /**
   * Listagem de corridas filtrada pelo papel do usuário
   */
  async listRides(userId: string, role: UserRole): Promise<IRide[]> {
    if (role === UserRole.PASSENGER) {
      const corridas = await this.corridaRepo.find({
        where: { passengerId: userId },
        order: { createdAt: 'DESC' },
        take: 20,
      });
      return corridas.map((c) => c.toDomain());
    }

    // Para motoristas: lista corridas solicitadas ou atribuídas a ele
    const corridas = await this.corridaRepo.find({
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return corridas.map((c) => c.toDomain());
  }
}
