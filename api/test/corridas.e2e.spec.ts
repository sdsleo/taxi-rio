import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { UserRole, RideStatus, IRide } from '@taxi-rio/shared';
import { AuthModule } from '../src/auth/auth.module';
import { MetricsModule } from '../src/metrics/metrics.module';
import { CorrelationMiddleware } from '../src/logging/correlation.middleware';
import { CorridasController } from '../src/corridas/corridas.controller';
import { CorridasService } from '../src/corridas/corridas.service';

describe('Corridas API — Fluxo E2E e Políticas de Segurança (Parte 1.5)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let corridasService: jest.Mocked<Partial<CorridasService>>;

  let passengerToken: string;
  let driverToken: string;

  const mockRide: IRide = {
    id: 'test-ride-123',
    passengerId: 'passenger-1',
    driverId: null,
    status: RideStatus.REQUESTED,
    origin: { latitude: -22.9711, longitude: -43.1822, address: 'Copacabana' },
    destination: { latitude: -22.9068, longitude: -43.1729, address: 'Centro' },
    price: 35.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    corridasService = {
      createRide: jest.fn().mockImplementation((passengerId, _dto, idempotencyKey) => {
        if (idempotencyKey === 'replay-key') {
          return Promise.resolve({ data: mockRide, isIdempotentReplay: true });
        }
        return Promise.resolve({
          data: { ...mockRide, passengerId },
          isIdempotentReplay: false,
        });
      }),
      updateStatus: jest.fn().mockResolvedValue({
        ...mockRide,
        status: RideStatus.ACCEPTED,
        driverId: 'driver-1',
      }),
      getRideById: jest.fn().mockResolvedValue(mockRide),
      listRides: jest.fn().mockResolvedValue([mockRide]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, MetricsModule],
      controllers: [CorridasController],
      providers: [
        {
          provide: CorridasService,
          useValue: corridasService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(new CorrelationMiddleware().use);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    passengerToken = jwtService.sign({
      sub: 'passenger-1',
      role: UserRole.PASSENGER,
      name: 'Maria Passageira',
    });

    driverToken = jwtService.sign({
      sub: 'driver-1',
      role: UserRole.DRIVER,
      name: 'João Motorista',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cenários de Falha 1: Autenticação e RBAC', () => {
    it('deve retornar 401 Unauthorized quando requisição não contiver cabeçalho Authorization', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/corridas')
        .send({
          origin: { latitude: -22.9711, longitude: -43.1822 },
          destination: { latitude: -22.9068, longitude: -43.1729 },
        });

      // Assert
      expect(response.status).toBe(401);
    });

    it('deve retornar 401 Unauthorized quando token JWT for inválido ou adulterado', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/corridas')
        .set('Authorization', 'Bearer token_invalido_ou_adulterado')
        .send({
          origin: { latitude: -22.9711, longitude: -43.1822 },
          destination: { latitude: -22.9068, longitude: -43.1729 },
        });

      // Assert
      expect(response.status).toBe(401);
    });

    it('deve retornar 403 Forbidden quando MOTORISTA tentar criar corrida (POST /corridas)', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/corridas')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          origin: { latitude: -22.9711, longitude: -43.1822 },
          destination: { latitude: -22.9068, longitude: -43.1729 },
        });

      // Assert
      expect(response.status).toBe(403);
    });

    it('deve retornar 403 Forbidden quando PASSAGEIRO tentar atualizar status (PATCH /corridas/:id/status)', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .patch('/corridas/test-ride-123/status')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ status: RideStatus.ACCEPTED });

      // Assert
      expect(response.status).toBe(403);
    });
  });

  describe('Fluxo Feliz: Passageiro cria e Motorista aceita', () => {
    it('deve criar uma corrida com 201 Created quando o perfil for PASSENGER', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/corridas')
        .set('Authorization', `Bearer ${passengerToken}`)
        .set('Idempotency-Key', 'unique-key-1')
        .send({
          origin: { latitude: -22.9711, longitude: -43.1822, address: 'Copacabana' },
          destination: { latitude: -22.9068, longitude: -43.1729, address: 'Centro' },
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.id).toBe(mockRide.id);
      expect(response.headers['x-idempotent-replay']).toBeUndefined();
    });

    it('deve permitir ao MOTORISTA atualizar o status da corrida para ACCEPTED (200 OK)', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .patch('/corridas/test-ride-123/status')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: RideStatus.ACCEPTED });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(RideStatus.ACCEPTED);
      expect(response.body.driverId).toBe('driver-1');
    });

    it('deve permitir consulta de corrida autenticada via GET /corridas/:id (200 OK)', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/corridas/test-ride-123')
        .set('Authorization', `Bearer ${passengerToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(mockRide.id);
    });
  });

  describe('Cenários de Falha 2: Idempotência de Requisição', () => {
    it('deve retornar X-Idempotent-Replay: true quando a mesma Idempotency-Key for reenviada', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/corridas')
        .set('Authorization', `Bearer ${passengerToken}`)
        .set('Idempotency-Key', 'replay-key')
        .send({
          origin: { latitude: -22.9711, longitude: -43.1822 },
          destination: { latitude: -22.9068, longitude: -43.1729 },
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers['x-idempotent-replay']).toBe('true');
      expect(response.body.id).toBe(mockRide.id);
    });
  });

  describe('Parte 2: Observabilidade, Logs Estruturados e Métricas Prometheus', () => {
    it('deve expor o endpoint GET /metrics no formato Prometheus sem exigir autenticação', async () => {
      // Act
      const response = await request(app.getHttpServer()).get('/metrics');

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('http_request_duration_seconds');
      expect(response.text).toContain('service="taxi-rio-api"');
    });

    it('deve injetar cabeçalho x-correlation-id e x-trace-id na resposta HTTP para rastreabilidade', async () => {
      // Act
      const customCorrelationId = 'meu-correlation-id-customizado-123';
      const response = await request(app.getHttpServer())
        .get('/auth/tokens')
        .set('x-correlation-id', customCorrelationId);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
      expect(response.headers['x-trace-id']).toBeDefined();
    });
  });
});
