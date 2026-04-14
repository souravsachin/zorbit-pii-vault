import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisibilityPolicy } from './entities/visibility-policy.entity';
import { PiiNickname } from './entities/pii-nickname.entity';
import { PiiRecord } from '../models/entities/pii-record.entity';
import { EncryptionService } from '../services/encryption.service';
import { HashIdService } from '../services/hash-id.service';
import {
  CreateVisibilityPolicyDto,
  UpdateVisibilityPolicyDto,
} from './dto/create-visibility-policy.dto';
import {
  ResolveVisibilityDto,
  ResolvedToken,
  ResolveVisibilityResult,
} from './dto/resolve-visibility.dto';

/**
 * Nickname sequence labels: A, B, C … Z, AA, AB …
 * Based on count of existing nicknames per (org, piiType).
 */
function toAlphaLabel(n: number): string {
  let label = '';
  n = n + 1; // 0-indexed input → 1-indexed
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

/**
 * Generate a nickname for a PII token based on its type and sequential index.
 */
function generateNickname(piiType: string, index: number): string {
  const label = toAlphaLabel(index);
  switch (piiType) {
    case 'name':
      return `Person ${label}`;
    case 'email':
      return `email-${label.toLowerCase()}@masked.local`;
    case 'phone':
      return '+XXX-XXX-XXXX';
    case 'address':
      return `Address ${label}`;
    default:
      return '****';
  }
}

/**
 * Naive CIDR/IP check: supports exact IP and simple /24 /16 /8 masks.
 * Sufficient for basic IP restriction in this context.
 */
function ipMatchesRestriction(ip: string, restriction: string): boolean {
  if (!restriction) return true;
  if (!ip) return false;

  // Exact match
  if (!restriction.includes('/')) {
    return ip === restriction;
  }

  // CIDR match
  const [network, prefixStr] = restriction.split('/');
  const prefix = parseInt(prefixStr, 10);
  const ipToNum = (addr: string): number =>
    addr.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;

  try {
    const ipNum = ipToNum(ip);
    const netNum = ipToNum(network);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (netNum & mask);
  } catch {
    return false;
  }
}

@Injectable()
export class VisibilityService {
  private readonly logger = new Logger(VisibilityService.name);

  constructor(
    @InjectRepository(VisibilityPolicy)
    private readonly policyRepo: Repository<VisibilityPolicy>,
    @InjectRepository(PiiNickname)
    private readonly nicknameRepo: Repository<PiiNickname>,
    @InjectRepository(PiiRecord)
    private readonly piiRepo: Repository<PiiRecord>,
    private readonly encryptionService: EncryptionService,
    private readonly hashIdService: HashIdService,
  ) {}

  // ── Visibility Policy CRUD ───────────────────────────────────────────────

  async createPolicy(
    orgId: string,
    dto: CreateVisibilityPolicyDto,
  ): Promise<VisibilityPolicy> {
    const hashId = this.hashIdService.generate('VP');
    const policy = this.policyRepo.create({
      hashId,
      organizationHashId: orgId,
      piiType: dto.piiType,
      role: dto.role,
      contextType: dto.contextType,
      visibilityLevel: dto.visibilityLevel,
      ipRestriction: dto.ipRestriction ?? null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });
    return this.policyRepo.save(policy);
  }

  async listPolicies(
    orgId: string,
    filters?: { piiType?: string; role?: string },
  ): Promise<VisibilityPolicy[]> {
    const qb = this.policyRepo
      .createQueryBuilder('p')
      .where('p.organizationHashId = :orgId', { orgId });

    if (filters?.piiType) {
      qb.andWhere('p.piiType = :piiType', { piiType: filters.piiType });
    }
    if (filters?.role) {
      qb.andWhere('p.role = :role', { role: filters.role });
    }

    return qb.orderBy('p.createdAt', 'DESC').getMany();
  }

  async getPolicy(orgId: string, policyId: string): Promise<VisibilityPolicy> {
    const policy = await this.policyRepo.findOne({
      where: { hashId: policyId, organizationHashId: orgId },
    });
    if (!policy) {
      throw new NotFoundException(`Visibility policy ${policyId} not found`);
    }
    return policy;
  }

  async updatePolicy(
    orgId: string,
    policyId: string,
    dto: UpdateVisibilityPolicyDto,
  ): Promise<VisibilityPolicy> {
    const policy = await this.getPolicy(orgId, policyId);
    Object.assign(policy, dto);
    return this.policyRepo.save(policy);
  }

  async deletePolicy(orgId: string, policyId: string): Promise<void> {
    const policy = await this.getPolicy(orgId, policyId);
    await this.policyRepo.remove(policy);
  }

  // ── Resolve Visibility ───────────────────────────────────────────────────

  /**
   * Batch resolve a list of PII tokens to their visibility-governed representation.
   *
   * Performance notes:
   *  - All PII records are fetched in a single WHERE hashId IN (...) query.
   *  - All nicknames are fetched in a single WHERE token IN (...) query.
   *  - All policies for the org are fetched in one query per call and cached
   *    in a local Map for O(1) lookup per token.
   *  - Detokenization (decrypt) only happens for tokens that actually need
   *    'full' visibility — avoiding unnecessary crypto work.
   */
  async resolveVisibility(
    orgId: string,
    dto: ResolveVisibilityDto,
    requestIp: string | null,
  ): Promise<ResolveVisibilityResult> {
    const callerIp = dto.ipAddress ?? requestIp ?? '';
    const callerRole = dto.userRole;
    const callerId = dto.userId;
    const dataOwnerId = dto.context?.dataOwnerId ?? null;

    // Determine context: is the caller viewing their own data?
    const isSelf = !!dataOwnerId && callerId === dataOwnerId;

    // 1. Fetch all PII records for the requested tokens in one query
    const piiRecords = await this.piiRepo
      .createQueryBuilder('r')
      .where('r.hashId IN (:...tokens)', { tokens: dto.tokens })
      .getMany();

    const piiByToken = new Map<string, PiiRecord>();
    for (const r of piiRecords) {
      piiByToken.set(r.hashId, r);
    }

    // 2. Fetch all active policies for this org in one query
    const allPolicies = await this.policyRepo.find({
      where: { organizationHashId: orgId, isActive: true },
    });

    // 3. Fetch existing nicknames for all tokens in one query
    const existingNicknames = await this.nicknameRepo
      .createQueryBuilder('n')
      .where('n.token IN (:...tokens)', { tokens: dto.tokens })
      .getMany();

    const nicknameByToken = new Map<string, PiiNickname>();
    for (const n of existingNicknames) {
      nicknameByToken.set(n.token, n);
    }

    // 4. Resolve each token
    const resolved: Record<string, ResolvedToken> = {};

    for (const token of dto.tokens) {
      resolved[token] = await this.resolveToken(
        token,
        piiByToken,
        allPolicies,
        nicknameByToken,
        orgId,
        callerRole,
        callerId,
        callerIp,
        isSelf,
      );
    }

    return { resolved };
  }

  /**
   * Resolve a single token. Separated so the batch loop stays clean.
   */
  private async resolveToken(
    token: string,
    piiByToken: Map<string, PiiRecord>,
    allPolicies: VisibilityPolicy[],
    nicknameByToken: Map<string, PiiNickname>,
    orgId: string,
    role: string,
    _userId: string,
    callerIp: string,
    isSelf: boolean,
  ): Promise<ResolvedToken> {
    const record = piiByToken.get(token);

    // If the token does not exist, return it as-is (safe default)
    if (!record) {
      return { value: token, level: 'token' };
    }

    const piiType = record.dataType as string;
    const contextType = isSelf ? 'self' : 'other';

    // Policy priority: most-specific → least-specific
    // Order: (exact piiType + exact role + exact context)
    //   → (exact piiType + exact role + 'any')
    //   → (exact piiType + '*' + exact context)
    //   → (exact piiType + '*' + 'any')
    //   → ('*' + exact role + exact context)
    //   → ('*' + exact role + 'any')
    //   → ('*' + '*' + exact context)
    //   → ('*' + '*' + 'any')
    const candidates = [
      [piiType, role, contextType],
      [piiType, role, 'any'],
      [piiType, '*', contextType],
      [piiType, '*', 'any'],
      ['*', role, contextType],
      ['*', role, 'any'],
      ['*', '*', contextType],
      ['*', '*', 'any'],
    ];

    let matchedPolicy: VisibilityPolicy | null = null;
    for (const [pt, r, ct] of candidates) {
      const found = allPolicies.find(
        (p) => p.piiType === pt && p.role === r && p.contextType === ct,
      );
      if (found) {
        matchedPolicy = found;
        break;
      }
    }

    // Default: return raw token (safest fallback)
    let level = matchedPolicy?.visibilityLevel ?? 'token';

    // IP restriction check: downgrade to 'masked' if IP doesn't match
    if (
      matchedPolicy?.ipRestriction &&
      !ipMatchesRestriction(callerIp, matchedPolicy.ipRestriction)
    ) {
      level = 'masked';
    }

    switch (level) {
      case 'full': {
        const value = await this.decryptRecord(record);
        return { value, level: 'full' };
      }

      case 'nickname': {
        const nickname = await this.getOrCreateNickname(
          token,
          piiType,
          orgId,
          nicknameByToken,
        );
        return { value: nickname, level: 'nickname' };
      }

      case 'masked':
        return { value: '****', level: 'masked' };

      case 'token':
      default:
        return { value: token, level: 'token' };
    }
  }

  /**
   * Decrypt a PII record using the encryption service.
   */
  private async decryptRecord(record: PiiRecord): Promise<string> {
    const encryptionKey = await this.encryptionService.getKeyByHashId(
      record.encryptionKeyId,
    );
    if (!encryptionKey) {
      throw new Error(`Encryption key ${record.encryptionKeyId} not found`);
    }
    return this.encryptionService.decrypt(record.encryptedValue, encryptionKey);
  }

  /**
   * Return an existing nickname or generate and persist a new one.
   * Generation is deterministic: based on count of existing nicknames for
   * the same (org, piiType) so labels are stable across restarts.
   */
  private async getOrCreateNickname(
    token: string,
    piiType: string,
    orgId: string,
    cache: Map<string, PiiNickname>,
  ): Promise<string> {
    const existing = cache.get(token);
    if (existing) {
      return existing.nickname;
    }

    // Count existing nicknames for (org, piiType) to determine sequence index
    const count = await this.nicknameRepo.count({
      where: { organizationHashId: orgId, piiType },
    });

    const nickname = generateNickname(piiType, count);

    const entry = this.nicknameRepo.create({
      token,
      nickname,
      piiType,
      organizationHashId: orgId,
    });

    const saved = await this.nicknameRepo.save(entry);
    cache.set(token, saved);

    this.logger.debug(`Generated nickname "${nickname}" for token ${token}`);
    return nickname;
  }

  // ── Default Policy Seeder ────────────────────────────────────────────────

  /**
   * Seed sensible default visibility policies for an org.
   * Safe to call multiple times — skips existing entries (checked by
   * org + piiType + role + contextType combination).
   */
  async seedDefaultPolicies(orgId: string): Promise<void> {
    const defaults: Array<{
      piiType: string;
      role: string;
      contextType: string;
      visibilityLevel: string;
    }> = [
      // Admins see everything
      { piiType: '*', role: 'admin', contextType: 'any', visibilityLevel: 'full' },
      // Customers see their own data in full, others' data masked
      { piiType: '*', role: 'customer', contextType: 'self', visibilityLevel: 'full' },
      { piiType: '*', role: 'customer', contextType: 'other', visibilityLevel: 'masked' },
      // Brokers: name = full, email/phone = masked for others
      { piiType: 'name', role: 'broker', contextType: 'other', visibilityLevel: 'full' },
      { piiType: 'email', role: 'broker', contextType: 'other', visibilityLevel: 'masked' },
      { piiType: 'phone', role: 'broker', contextType: 'other', visibilityLevel: 'masked' },
      // Medical records — always masked for non-self access regardless of role
      { piiType: 'medical_record', role: '*', contextType: 'other', visibilityLevel: 'masked' },
      // Support agents see nicknames for all other-context data
      { piiType: '*', role: 'support', contextType: 'other', visibilityLevel: 'nickname' },
    ];

    let seeded = 0;
    for (const def of defaults) {
      const exists = await this.policyRepo.findOne({
        where: {
          organizationHashId: orgId,
          piiType: def.piiType,
          role: def.role,
          contextType: def.contextType,
        },
      });
      if (!exists) {
        const hashId = this.hashIdService.generate('VP');
        await this.policyRepo.save(
          this.policyRepo.create({
            hashId,
            organizationHashId: orgId,
            ...def,
            ipRestriction: null,
            isActive: true,
          }),
        );
        seeded++;
      }
    }

    if (seeded > 0) {
      this.logger.log(`Seeded ${seeded} default visibility policies for org ${orgId}`);
    }
  }
}
