import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Defines what level of PII visibility a given role has for a given data type
 * and context (self vs other). Evaluated at detokenize/resolve time.
 *
 * Wildcard '*' is supported for piiType and role — specific entries take
 * precedence over wildcards during policy resolution.
 */
@Entity('visibility_policies')
export class VisibilityPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Short hash ID, e.g. VP-A1B2 */
  @Column({ name: 'hash_id', unique: true, length: 20 })
  @Index()
  hashId!: string;

  /** Which org this policy belongs to */
  @Column({ name: 'organization_hash_id', length: 20 })
  @Index()
  organizationHashId!: string;

  /**
   * PII data type this policy applies to.
   * Use '*' for a wildcard that matches any type.
   */
  @Column({ name: 'pii_type', length: 50 })
  piiType!: string;

  /**
   * Role this policy applies to (e.g. admin, broker, customer, support).
   * Use '*' for a wildcard that matches any role.
   */
  @Column({ name: 'role', length: 50 })
  role!: string;

  /**
   * Context of the access:
   *   'self'  — user is viewing their own data (userId == dataOwnerId)
   *   'other' — user is viewing someone else's data
   *   'any'   — applies regardless of ownership context
   */
  @Column({ name: 'context_type', length: 20 })
  contextType!: string; // 'self' | 'other' | 'any'

  /**
   * What representation of PII to return:
   *   'full'     — real decrypted PII value
   *   'nickname' — stable human-readable placeholder (Customer A, email-b@masked.local)
   *   'masked'   — static "****"
   *   'token'    — raw token string (PII-XXXX), reveals nothing
   */
  @Column({ name: 'visibility_level', length: 20 })
  visibilityLevel!: string; // 'full' | 'nickname' | 'masked' | 'token'

  /**
   * Optional IP restriction (CIDR or exact IP).
   * If set and caller IP does not match, visibility is downgraded to 'masked'.
   * Null means no IP restriction.
   */
  @Column({ name: 'ip_restriction', type: 'varchar', length: 100, nullable: true })
  ipRestriction!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
