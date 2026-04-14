import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PiiDataType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  ADDRESS = 'address',
  NAME = 'name',
  DATE_OF_BIRTH = 'date_of_birth',
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
  BANK_ACCOUNT = 'bank_account',
  MEDICAL_RECORD = 'medical_record',
  CUSTOM = 'custom',
}

@Entity('pii_records')
export class PiiRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Short hash identifier, e.g. PII-81F3 */
  @Column({ name: 'hash_id', unique: true, length: 20 })
  @Index()
  hashId!: string;

  /** The type of PII data stored */
  @Column({
    name: 'data_type',
    type: 'enum',
    enum: PiiDataType,
  })
  dataType!: PiiDataType;

  /**
   * AES-256-GCM encrypted PII value.
   * Format: base64(iv:authTag:ciphertext)
   * Raw PII is NEVER stored unencrypted.
   */
  @Column({ name: 'encrypted_value', type: 'text' })
  encryptedValue!: string;

  /** Reference to the encryption key used */
  @Column({ name: 'encryption_key_id', length: 20 })
  @Index()
  encryptionKeyId!: string;

  /** Organization this PII belongs to */
  @Column({ name: 'organization_hash_id', length: 20 })
  @Index()
  organizationHashId!: string;

  /** User hash ID who created this token */
  @Column({ name: 'created_by', length: 20 })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** Optional expiration date for the PII token */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}
