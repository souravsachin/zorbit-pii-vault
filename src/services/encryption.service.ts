import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EncryptionKey } from '../models/entities/encryption-key.entity';
import { HashIdService } from './hash-id.service';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Manages encryption keys and provides encrypt/decrypt operations using AES-256-GCM.
 *
 * The encryption key stored in the database is itself encrypted using the master key
 * from the ENCRYPTION_MASTER_KEY environment variable.
 *
 * Encrypted value format: base64(iv:authTag:ciphertext) where each component is hex-encoded.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private masterKey!: Buffer;

  constructor(
    @InjectRepository(EncryptionKey)
    private readonly keyRepository: Repository<EncryptionKey>,
    private readonly configService: ConfigService,
    private readonly hashIdService: HashIdService,
  ) {}

  async onModuleInit(): Promise<void> {
    const masterKeyHex = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKeyHex || masterKeyHex.length !== 64) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY must be a 64-character hex string (256-bit key)',
      );
    }
    this.masterKey = Buffer.from(masterKeyHex, 'hex');

    // Ensure at least one active encryption key exists
    const activeKey = await this.getActiveKey();
    if (!activeKey) {
      await this.createNewKey();
    }
  }

  /**
   * Get the currently active encryption key (decrypted).
   */
  async getActiveKey(): Promise<EncryptionKey | null> {
    return this.keyRepository.findOne({
      where: { isActive: true },
      order: { version: 'DESC' },
    });
  }

  /**
   * Get a specific encryption key by hashId.
   */
  async getKeyByHashId(hashId: string): Promise<EncryptionKey | null> {
    return this.keyRepository.findOne({ where: { hashId } });
  }

  /**
   * Create a new encryption key and store it encrypted with the master key.
   */
  async createNewKey(): Promise<EncryptionKey> {
    // Deactivate all existing keys
    await this.keyRepository.update({ isActive: true }, { isActive: false });

    // Generate a new 256-bit key
    const rawKey = randomBytes(32);
    const encryptedKeyMaterial = this.encryptWithMasterKey(rawKey);

    const maxVersion = await this.keyRepository
      .createQueryBuilder('ek')
      .select('MAX(ek.version)', 'max')
      .getRawOne();

    const nextVersion = (maxVersion?.max || 0) + 1;

    const key = this.keyRepository.create({
      hashId: this.hashIdService.generate('EK'),
      keyMaterial: encryptedKeyMaterial,
      version: nextVersion,
      isActive: true,
      rotatedAt: null,
    });

    const saved = await this.keyRepository.save(key);
    this.logger.log(`Created encryption key ${saved.hashId} (version ${nextVersion})`);
    return saved;
  }

  /**
   * Rotate the active encryption key. Creates a new key; old keys remain for decryption.
   */
  async rotateKey(): Promise<EncryptionKey> {
    const currentKey = await this.getActiveKey();
    if (currentKey) {
      currentKey.isActive = false;
      currentKey.rotatedAt = new Date();
      await this.keyRepository.save(currentKey);
    }

    return this.createNewKey();
  }

  /**
   * Encrypt plaintext PII data using the specified encryption key.
   * @returns Encrypted string in format: hex(iv):hex(authTag):hex(ciphertext)
   */
  encrypt(plaintext: string, encryptionKey: EncryptionKey): string {
    const rawKey = this.decryptKeyMaterial(encryptionKey.keyMaterial);

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, rawKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt encrypted PII data using the specified encryption key.
   * @param encryptedValue - Format: hex(iv):hex(authTag):hex(ciphertext)
   */
  decrypt(encryptedValue: string, encryptionKey: EncryptionKey): string {
    const rawKey = this.decryptKeyMaterial(encryptionKey.keyMaterial);

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');

    const decipher = createDecipheriv(ALGORITHM, rawKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Encrypt a raw key with the master key (for storing key material in DB).
   */
  private encryptWithMasterKey(rawKey: Buffer): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(rawKey),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt key material stored in the database using the master key.
   */
  private decryptKeyMaterial(encryptedKeyMaterial: string): Buffer {
    const parts = encryptedKeyMaterial.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid key material format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'hex');

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  }
}
