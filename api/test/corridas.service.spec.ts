import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  RideStatus,
  UserRole,
  RIDE_CREATED_ROUTING_KEY,
  RIDE_STATUS_UPDATED_ROUTING_KEY,
} from '@taxi-rio/shared';
import { CorridasService } from '../src/corridas/corridas.service';
import { CorridaEntity } from '../src/database/entities/corrida.entity';
import { IdempotencyEntity } from '../src/database/entities/idempotency.entity';
import { RedisService } from '../src/redis/redis.service';
import { RabbitMQService } from '../src/rabbitmq/rabbitmq.service';

describe('CorridasService', () => {
  let service: CorridasService;
  let corridaRepo: jest.Mocked<Partial<Repository<CorridaEntity>>>;
  let idempotencyRepo: jest.Mocked<Partial<Repository<IdempotencyEntity>>>;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let rabbitmqService: jest.Mocked<Partial<RabbitMQService>>;

  const mockPassengerId = 'passenger-uuid-123';
  const mockDriverId = 'driver-uuid-456';
  const mockRideId = 'ride-uuid-789';

  const createMockCorridaEntity = (overrides?: Partial<CorridaEntity>): CorridaEntity => {
    const entity = new CorridaEntity();
    entity.id = mockRideId;
    entity.passengerId = mockPassengerId;
    entity.driverId = null;
    entity.status = RideStatus.REQUESTED;
    entity.originLatitude = -22.9711;
    entity.originLongitude = -43.1822;
    entity.originAddress = 'Copacabana';
    entity.destinationLatitude = -22.9068;
    entity.destinationLongitude = -43.1729;
    entity.destinationAddress = 'Centro';
    entity.price = 35.5;
    entity.createdAt = new Date('2026-11-10T12:00:00Z');
    entity.updatedAt = new Date('2026-11-10T12:00:00Z');
    return Object.assign(entity, overrides);
  };

  const createMockIdempotencyEntity = (
    key: string,
    responseBody: Record<string, unknown>,
  ): IdempotencyEntity => {
    const entity = new IdempotencyEntity();
    entity.idempotencyKey = key;
    entity.resourceId = mockRideId;
    entity.statusCode = 201;
    entity.responseBody = responseBody;
    entity.createdAt = new Date('2026-11-10T12:00:00Z');
    return entity;
  };

  beforeEach(async () => {
    const sample = createMockCorridaEntity();

    corridaRepo = {
      create: jest.fn().mockImplementation((dto) => Object.assign(new CorridaEntity(), dto)),
      save: jest.fn().mockResolvedValue(sample),
      findOne: jest.fn().mockResolvedValue(sample),
      find: jest.fn().mockResolvedValue([sample]),
    };

    idempotencyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => Object.assign(new IdempotencyEntity(), dto)),
      save: jest.fn().mockResolvedValue(createMockIdempotencyEntity('test-key', {})),
    };

    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    rabbitmqService = {
      publish: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorridasService,
        {
          provide: getRepositoryToken(CorridaEntity),
          useValue: corridaRepo,
        },
        {
          provide: getRepositoryToken(IdempotencyEntity),
          useValue: idempotencyRepo,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: RabbitMQService,
          useValue: rabbitmqService,
        },
      ],
    }).compile();

    service = module.get<CorridasService>(CorridasService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Fluxo Feliz (Parte 1.5)', () => {
    it('deve criar uma corrida com sucesso quando os dados forem válidos', async () => {
      // Arrange
      const dto = {
        origin: { latitude: -22.9711, longitude: -43.1822, address: 'Copacabana' },
        destination: { latitude: -22.9068, longitude: -43.1729, address: 'Centro' },
      };

      // Act
      const result = await service.createRide(mockPassengerId, dto);

      // Assert
      expect(result.isIdempotentReplay).toBe(false);
      expect(result.data.id).toBe(mockRideId);
      expect(result.data.status).toBe(RideStatus.REQUESTED);
      expect(corridaRepo.save).toHaveBeenCalled();
      expect(rabbitmqService.publish).toHaveBeenCalledWith(
        RIDE_CREATED_ROUTING_KEY,
        expect.objectContaining({
          eventType: RIDE_CREATED_ROUTING_KEY,
          payload: expect.objectContaining({ id: mockRideId }),
        }),
      );
    });

    it('deve atualizar o status com sucesso quando a transição for válida (REQUESTED -> ACCEPTED)', async () => {
      // Arrange
      const acceptedEntity = createMockCorridaEntity({
        status: RideStatus.ACCEPTED,
        driverId: mockDriverId,
      });
      corridaRepo.findOne = jest.fn().mockResolvedValue(createMockCorridaEntity());
      corridaRepo.save = jest.fn().mockResolvedValue(acceptedEntity);

      // Act
      const result = await service.updateStatus(mockRideId, mockDriverId, RideStatus.ACCEPTED);

      // Assert
      expect(result.status).toBe(RideStatus.ACCEPTED);
      expect(result.driverId).toBe(mockDriverId);
      expect(redisService.set).toHaveBeenCalled();
      expect(rabbitmqService.publish).toHaveBeenCalledWith(
        RIDE_STATUS_UPDATED_ROUTING_KEY,
        expect.objectContaining({
          eventType: RIDE_STATUS_UPDATED_ROUTING_KEY,
          payload: expect.objectContaining({
            rideId: mockRideId,
            newStatus: RideStatus.ACCEPTED,
            driverId: mockDriverId,
          }),
        }),
      );
    });

    it('deve buscar corrida do cache Redis quando ela já estiver cacheada (Cache-Aside hit)', async () => {
      // Arrange
      const cachedRide = {
        id: mockRideId,
        passengerId: mockPassengerId,
        driverId: null,
        status: RideStatus.REQUESTED,
        price: 35.5,
      };
      redisService.get = jest.fn().mockResolvedValue(JSON.stringify(cachedRide));

      // Act
      const result = await service.getRideById(mockRideId, mockPassengerId, UserRole.PASSENGER);

      // Assert
      expect(result.id).toBe(mockRideId);
      expect(redisService.get).toHaveBeenCalledWith(`corridas:${mockRideId}`);
      expect(corridaRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('Cenários de Falha 1: Autenticação e RBAC (Parte 1.5)', () => {
    it('deve lançar ForbiddenException quando um passageiro tentar consultar a corrida de outro usuário', async () => {
      // Arrange
      const anotherPassengerId = 'another-passenger-uuid';
      corridaRepo.findOne = jest.fn().mockResolvedValue(createMockCorridaEntity());

      // Act & Assert
      await expect(
        service.getRideById(mockRideId, anotherPassengerId, UserRole.PASSENGER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar NotFoundException quando a corrida solicitada não existir', async () => {
      // Arrange
      corridaRepo.findOne = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getRideById('non-existent-id', mockPassengerId, UserRole.PASSENGER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Cenários de Falha 2: Idempotência e Transição Inválida (Parte 1.5)', () => {
    it('deve retornar resposta anterior sem duplicar quando a Idempotency-Key for reenviada (Replay)', async () => {
      // Arrange
      const key = 'idem-unique-key-123';
      const dto = {
        origin: { latitude: -22.9711, longitude: -43.1822, address: 'Copacabana' },
        destination: { latitude: -22.9068, longitude: -43.1729, address: 'Centro' },
      };
      const previousResponse = {
        id: mockRideId,
        passengerId: mockPassengerId,
        status: RideStatus.REQUESTED,
      };
      idempotencyRepo.findOne = jest
        .fn()
        .mockResolvedValue(createMockIdempotencyEntity(key, previousResponse));

      // Act
      const result = await service.createRide(mockPassengerId, dto, key);

      // Assert
      expect(result.isIdempotentReplay).toBe(true);
      expect(result.data.id).toBe(mockRideId);
      expect(corridaRepo.save).not.toHaveBeenCalled();
      expect(rabbitmqService.publish).not.toHaveBeenCalled();
    });

    it('deve lançar BadRequestException quando a transição de status for inválida (ex.: REQUESTED -> COMPLETED)', async () => {
      // Arrange
      corridaRepo.findOne = jest.fn().mockResolvedValue(createMockCorridaEntity());

      // Act & Assert
      await expect(
        service.updateStatus(mockRideId, mockDriverId, RideStatus.COMPLETED),
      ).rejects.toThrow(BadRequestException);

      expect(corridaRepo.save).not.toHaveBeenCalled();
      expect(rabbitmqService.publish).not.toHaveBeenCalled();
    });
  });
});
