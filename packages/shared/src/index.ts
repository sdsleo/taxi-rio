/**
 * Taxi.Rio — Contratos e Tipos Compartilhados (@taxi-rio/shared)
 * Fonte de verdade para tipos de domínio compartilhados entre API, Worker e UI.
 */

// -------------------------------------------------------------
// 1. Estados e Papéis de Usuário
// -------------------------------------------------------------
export enum RideStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
}

export interface IJwtPayload {
  readonly sub: string; // ID do Usuário
  readonly role: UserRole;
  readonly name: string;
  readonly email?: string;
  readonly iat?: number;
  readonly exp?: number;
}

// -------------------------------------------------------------
// 2. Modelo de Corrida e Localização
// -------------------------------------------------------------
export interface ILocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly address?: string;
}

export interface IRide {
  readonly id: string;
  readonly passengerId: string;
  readonly driverId: string | null;
  readonly status: RideStatus;
  readonly origin: ILocation;
  readonly destination: ILocation;
  readonly price: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// -------------------------------------------------------------
// 3. Regras de Transição de Estado da Corrida
// -------------------------------------------------------------
export const VALID_STATUS_TRANSITIONS: Readonly<Record<RideStatus, readonly RideStatus[]>> = {
  [RideStatus.REQUESTED]: [RideStatus.ACCEPTED, RideStatus.CANCELLED],
  [RideStatus.ACCEPTED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELLED],
  [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
  [RideStatus.COMPLETED]: [],
  [RideStatus.CANCELLED]: [],
};

export function isValidStatusTransition(
  currentStatus: RideStatus,
  nextStatus: RideStatus,
): boolean {
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

// -------------------------------------------------------------
// 4. DTOs de Entrada e Saída da API
// -------------------------------------------------------------
export interface ICreateRideDto {
  readonly origin: ILocation;
  readonly destination: ILocation;
}

export interface IUpdateRideStatusDto {
  readonly status: RideStatus;
  readonly driverId?: string;
}

// -------------------------------------------------------------
// 5. Eventos do RabbitMQ (Broker)
// -------------------------------------------------------------
export const RABBITMQ_EXCHANGE = 'taxirio.events';
export const RIDE_CREATED_ROUTING_KEY = 'corrida.criada';
export const RIDE_STATUS_UPDATED_ROUTING_KEY = 'corrida.status_alterado';
export const RIDE_EVENTS_QUEUE = 'taxirio.corridas.queue';

export interface IBaseEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: string;
  readonly correlationId: string;
}

export interface IRideCreatedEvent extends IBaseEvent {
  readonly eventType: typeof RIDE_CREATED_ROUTING_KEY;
  readonly payload: IRide;
}

export interface IRideStatusUpdatedEvent extends IBaseEvent {
  readonly eventType: typeof RIDE_STATUS_UPDATED_ROUTING_KEY;
  readonly payload: {
    readonly rideId: string;
    readonly previousStatus: RideStatus;
    readonly newStatus: RideStatus;
    readonly driverId: string | null;
    readonly updatedAt: string;
  };
}

export type TRideEvent = IRideCreatedEvent | IRideStatusUpdatedEvent;

// -------------------------------------------------------------
// 6. Auditoria (MongoDB)
// -------------------------------------------------------------
export interface IRideAuditRecord {
  readonly eventId: string;
  readonly rideId: string;
  readonly eventType: string;
  readonly previousStatus?: RideStatus | null;
  readonly newStatus: RideStatus;
  readonly changedByUserId: string;
  readonly role: UserRole;
  readonly correlationId: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
}

// -------------------------------------------------------------
// 7. Health Check
// -------------------------------------------------------------
export interface IHealthStatus {
  readonly status: 'ok' | 'degraded' | 'error';
  readonly service: string;
  readonly timestamp: string;
  readonly uptime: number;
}

// -------------------------------------------------------------
// 8. Contexto de Rastreabilidade e Correlação
// -------------------------------------------------------------
export * from './context';
