import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('encryption_keys')
export class EncryptionKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Short hash identifier, e.g. EK-81F3 */
  @Column({ name: 'hash_id', unique: true, length: 20 })
  @Index()
  hashId!: string;

  /**
   * The encryption key material, itself encrypted with the master key.
   * Format: base64(iv:authTag:ciphertext)
   * Decrypted at runtime using ENCRYPTION_MASTER_KEY from environment.
   */
  @Column({ name: 'key_material', type: 'text' })
  keyMaterial!: string;

  /** Key version for rotation tracking */
  @Column({ type: 'integer', default: 1 })
  version!: number;

  /** Whether this key is the active key for new encryptions */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /** When the key was last rotated */
  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;
}
