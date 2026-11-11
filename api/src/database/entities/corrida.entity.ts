import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { RideStatus, IRide, ILocation } from '@taxi-rio/shared';

@Entity('corridas')
export class CorridaEntity {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string;

  @Index('idx_passenger')
  @Column('varchar', { name: 'passenger_id', length: 36 })
  passengerId!: string;

  @Index('idx_driver')
  @Column('varchar', { name: 'driver_id', length: 36, nullable: true })
  driverId!: string | null;

  @Index('idx_status')
  @Column('enum', {
    enum: RideStatus,
    default: RideStatus.REQUESTED,
  })
  status!: RideStatus;

  @Column('decimal', { name: 'origin_latitude', precision: 10, scale: 8 })
  originLatitude!: number;

  @Column('decimal', { name: 'origin_longitude', precision: 11, scale: 8 })
  originLongitude!: number;

  @Column('varchar', { name: 'origin_address', length: 255, nullable: true })
  originAddress!: string | null;

  @Column('decimal', { name: 'destination_latitude', precision: 10, scale: 8 })
  destinationLatitude!: number;

  @Column('decimal', { name: 'destination_longitude', precision: 11, scale: 8 })
  destinationLongitude!: number;

  @Column('varchar', { name: 'destination_address', length: 255, nullable: true })
  destinationAddress!: string | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0.0 })
  price!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  toDomain(): IRide {
    const origin: ILocation = {
      latitude: Number(this.originLatitude),
      longitude: Number(this.originLongitude),
      ...(this.originAddress ? { address: this.originAddress } : {}),
    };

    const destination: ILocation = {
      latitude: Number(this.destinationLatitude),
      longitude: Number(this.destinationLongitude),
      ...(this.destinationAddress ? { address: this.destinationAddress } : {}),
    };

    return {
      id: this.id,
      passengerId: this.passengerId,
      driverId: this.driverId,
      status: this.status,
      origin,
      destination,
      price: Number(this.price),
      createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
