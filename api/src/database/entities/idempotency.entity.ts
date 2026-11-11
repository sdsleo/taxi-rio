import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('idempotency_keys')
export class IdempotencyEntity {
  @PrimaryColumn('varchar', { name: 'idempotency_key', length: 128 })
  idempotencyKey!: string;

  @Column('varchar', { name: 'resource_id', length: 36, nullable: true })
  resourceId!: string | null;

  @Column('int', { name: 'status_code' })
  statusCode!: number;

  @Column('json', { name: 'response_body' })
  responseBody!: Record<string, unknown>;

  @Index('idx_created_at')
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
