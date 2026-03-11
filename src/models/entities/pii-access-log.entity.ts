import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PiiAccessAction {
  TOKENIZE = 'tokenize',
  DETOKENIZE = 'detokenize',
  DELETE = 'delete',
}

@Entity('pii_access_logs')
export class PiiAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Short hash identifier, e.g. PAL-81F3 */
  @Column({ name: 'hash_id', unique: true, length: 20 })
  @Index()
  hashId!: string;

  /** The PII token that was accessed */
  @Column({ name: 'pii_token_id', length: 20 })
  @Index()
  piiTokenId!: string;

  /** User hash ID who performed the access */
  @Column({ name: 'accessed_by', length: 20 })
  @Index()
  accessedBy!: string;

  /** The action performed */
  @Column({
    type: 'enum',
    enum: PiiAccessAction,
  })
  action!: PiiAccessAction;

  /** IP address of the requester */
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
