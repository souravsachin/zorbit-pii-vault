import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { EncryptionService } from '../src/services/encryption.service';
import { EncryptionKey } from '../src/models/entities/encryption-key.entity';
import { HashIdService } from '../src/services/hash-id.service';

// A valid 256-bit hex key for testing
const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let keyRepository: jest.Mocked<Repository<EncryptionKey>>;
  let configService: jest.Mocked<ConfigService>;
  let hashIdService: jest.Mocked<HashIdService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: getRepositoryToken(EncryptionKey),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'ENCRYPTION_MASTER_KEY') return TEST_MASTER_KEY;
              return undefined;
            }),
          },
        },
        {
          provide: HashIdService,
          useValue: { generate: jest.fn().mockReturnValue('EK-TEST') },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    keyRepository = module.get(getRepositoryToken(EncryptionKey)) as jest.Mocked<Repository<EncryptionKey>>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    hashIdService = module.get(HashIdService) as jest.Mocked<HashIdService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should throw if master key is not set', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(service.onModuleInit()).rejects.toThrow(
        'ENCRYPTION_MASTER_KEY must be a 64-character hex string',
      );
    });

    it('should throw if master key is wrong length', async () => {
      configService.get.mockReturnValue('tooshort');

      await expect(service.onModuleInit()).rejects.toThrow(
        'ENCRYPTION_MASTER_KEY must be a 64-character hex string',
      );
    });

    it('should create a new key if none exists', async () => {
      keyRepository.findOne.mockResolvedValue(null);
      keyRepository.create.mockImplementation((data) => data as EncryptionKey);
      keyRepository.save.mockImplementation(async (data) => data as EncryptionKey);
      keyRepository.update.mockResolvedValue({} as any);

      await service.onModuleInit();

      expect(keyRepository.create).toHaveBeenCalled();
      expect(keyRepository.save).toHaveBeenCalled();
    });
  });

  describe('encrypt and decrypt', () => {
    let mockKey: EncryptionKey;

    beforeEach(async () => {
      // Initialize the service to set the master key
      keyRepository.findOne.mockResolvedValue(null);
      keyRepository.create.mockImplementation((data) => data as EncryptionKey);
      keyRepository.save.mockImplementation(async (data) => {
        mockKey = data as EncryptionKey;
        return mockKey;
      });
      keyRepository.update.mockResolvedValue({} as any);

      await service.onModuleInit();
    });

    it('should encrypt and decrypt data correctly (round trip)', () => {
      const plaintext = 'test@example.com';

      const encrypted = service.encrypt(plaintext, mockKey);

      // Encrypted value should be in iv:authTag:ciphertext format
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // Should not contain the original plaintext
      expect(encrypted).not.toContain(plaintext);

      // Decrypt should return original value
      const decrypted = service.decrypt(encrypted, mockKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same-value';

      const encrypted1 = service.encrypt(plaintext, mockKey);
      const encrypted2 = service.encrypt(plaintext, mockKey);

      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(service.decrypt(encrypted1, mockKey)).toBe(plaintext);
      expect(service.decrypt(encrypted2, mockKey)).toBe(plaintext);
    });

    it('should handle special characters in PII data', () => {
      const testValues = [
        'user+tag@example.com',
        '+1 (555) 123-4567',
        '123 Main St, Apt #4, City, ST 12345',
        '123-45-6789',
        'Jose Garcia-Lopez',
        'Unicode: cafe\u0301 \u2603 \u2764',
      ];

      for (const value of testValues) {
        const encrypted = service.encrypt(value, mockKey);
        const decrypted = service.decrypt(encrypted, mockKey);
        expect(decrypted).toBe(value);
      }
    });

    it('should throw on invalid encrypted value format', () => {
      expect(() => service.decrypt('invalid-format', mockKey)).toThrow(
        'Invalid encrypted value format',
      );
    });

    it('should throw on tampered ciphertext (auth tag mismatch)', () => {
      const encrypted = service.encrypt('test', mockKey);
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = '00'.repeat(parts[2].length / 2);
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered, mockKey)).toThrow();
    });
  });

  describe('createNewKey', () => {
    it('should deactivate existing keys and create a new one', async () => {
      keyRepository.findOne.mockResolvedValue(null);
      keyRepository.create.mockImplementation((data) => data as EncryptionKey);
      keyRepository.save.mockImplementation(async (data) => data as EncryptionKey);
      keyRepository.update.mockResolvedValue({} as any);

      await service.onModuleInit();

      const newKey = await service.createNewKey();

      expect(keyRepository.update).toHaveBeenCalledWith(
        { isActive: true },
        { isActive: false },
      );
      expect(newKey.isActive).toBe(true);
      expect(newKey.hashId).toBe('EK-TEST');
    });
  });
});
