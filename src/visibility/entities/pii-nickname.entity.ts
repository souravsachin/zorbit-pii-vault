import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores stable human-readable nicknames for PII tokens.
 *
 * When a visibility policy resolves to 'nickname', this table is consulted
 * first. If no entry exists, one is generated and stored so the nickname
 * remains consistent across calls for the same token.
 *
 * Generation patterns per type:
 *   name           → "Person A", "Person B", …
 *   email          → "email-a@masked.local", "email-b@masked.local", …
 *   phone          → "+XXX-XXX-XXXX"
 *   address        → "Address A", "Address B", …
 *   other/custom   → "****"
 */
@Entity('pii_nicknames')
export class PiiNickname {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The PII token this nickname belongs to (e.g. PII-A1B2) */
  @Column({ name: 'token', unique: true, length: 20 })
  @Index()
  token!: string;

  /** Human-readable replacement value */
  @Column({ name: 'nickname', type: 'varchar', length: 200 })
  nickname!: string;

  /** Original PII data type (drives generation logic) */
  @Column({ name: 'pii_type', length: 50 })
  piiType!: string;

  /** Org scope (needed for sequential numbering within an org) */
  @Column({ name: 'organization_hash_id', length: 20 })
  @Index()
  organizationHashId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
