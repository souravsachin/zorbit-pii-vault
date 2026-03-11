import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TokenizationService } from '../src/services/tokenization.service';
import { PiiRecord, PiiDataType } from '../src/models/entities/pii-record.entity';
import { PiiAccessAction } from '../src/models/entities/pii-access-log.entity';
import { EncryptionService } from '../src/services/encryption.service';
import { AuditService } from '../src/services/audit.service';
import { HashIdService } from '../src/services/hash-id.service';
import { EventPublisherService } from '../src/events/event-publisher.service';

describe('TokenizationService', () => {
  let service: TokenizationService;
  let piiRepository: jest.Mocked<Repository<PiiRecord>>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let auditService: jest.Mocked<AuditService>;
  let hashIdService: jest.Mocked<HashIdService>;
  let eventPublisher: jest.Mocked<EventPublisherService>;

  const mockPiiRecord: Partial<PiiRecord> = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    hashId: 'PII-81F3',
    dataType: PiiDataType.EMAIL,
    encryptedValue: 'abc123:def456:encrypted',
    encryptionKeyId: 'EK-A1B2',
    organizationHashId: 'O-92AF',
    createdBy: 'U-81F3',
    createdAt: new Date('2026-01-01'),
    expiresAt: null,
  };

  const mockActiveKey = {
    hashId: 'EK-A1B2',
    keyMaterial: 'mock-key-material',
    version: 1,
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenizationService,
        {
          provide: getRepositoryToken(PiiRecord),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            getActiveKey: jest.fn(),
            getKeyByHashId: jest.fn(),
            encrypt: jest.fn(),
            decrypt: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logAccess: jest.fn(),
          },
        },
        {
          provide: HashIdService,
          useValue: { generate: jest.fn() },
        },
        {
          provide: EventPublisherService,
          useValue: { publish: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TokenizationService>(TokenizationService);
    piiRepository = module.get(getRepositoryToken(PiiRecord)) as jest.Mocked<Repository<PiiRecord>>;
    encryptionService = module.get(EncryptionService) as jest.Mocked<EncryptionService>;
    auditService = module.get(AuditService) as jest.Mocked<AuditService>;
    hashIdService = module.get(HashIdService) as jest.Mocked<HashIdService>;
    eventPublisher = module.get(EventPublisherService) as jest.Mocked<EventPublisherService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('tokenize', () => {
    it('should encrypt PII data, store it, and return a token', async () => {
      encryptionService.getActiveKey.mockResolvedValue(mockActiveKey as any);
      encryptionService.encrypt.mockReturnValue('abc123:def456:encrypted');
      hashIdService.generate.mockReturnValue('PII-NEW1');
      piiRepository.create.mockReturnValue({
        ...mockPiiRecord,
        hashId: 'PII-NEW1',
      } as PiiRecord);
      piiRepository.save.mockResolvedValue({
        ...mockPiiRecord,
        hashId: 'PII-NEW1',
      } as PiiRecord);
      auditService.logAccess.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.tokenize(
        'test@example.com',
        PiiDataType.EMAIL,
        'O-92AF',
        'U-81F3',
        '127.0.0.1',
      );

      expect(result.token).toBe('PII-NEW1');
      expect(result.dataType).toBe(PiiDataType.EMAIL);
      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        'test@example.com',
        mockActiveKey,
      );
      expect(hashIdService.generate).toHaveBeenCalledWith('PII');
      expect(auditService.logAccess).toHaveBeenCalledWith(
        'PII-NEW1',
        'U-81F3',
        PiiAccessAction.TOKENIZE,
        '127.0.0.1',
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'pii.token.created',
        'G',
        'G',
        expect.objectContaining({ tokenHashId: 'PII-NEW1' }),
      );
    });

    it('should throw if no active encryption key exists', async () => {
      encryptionService.getActiveKey.mockResolvedValue(null);

      await expect(
        service.tokenize('test@example.com', PiiDataType.EMAIL, 'O-92AF', 'U-81F3', null),
      ).rejects.toThrow('No active encryption key available');
    });
  });

  describe('deleteToken', () => {
    it('should delete a PII token and log the access', async () => {
      piiRepository.findOne.mockResolvedValue(mockPiiRecord as PiiRecord);
      piiRepository.remove.mockResolvedValue(mockPiiRecord as PiiRecord);
      auditService.logAccess.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      await service.deleteToken('PII-81F3', 'U-81F3', '127.0.0.1');

      expect(piiRepository.remove).toHaveBeenCalled();
      expect(auditService.logAccess).toHaveBeenCalledWith(
        'PII-81F3',
        'U-81F3',
        PiiAccessAction.DELETE,
        '127.0.0.1',
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'pii.token.deleted',
        'G',
        'G',
        expect.objectContaining({ tokenHashId: 'PII-81F3' }),
      );
    });

    it('should throw NotFoundException if token not found', async () => {
      piiRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteToken('PII-0000', 'U-81F3', null),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByToken', () => {
    it('should return the PII record for a valid token', async () => {
      piiRepository.findOne.mockResolvedValue(mockPiiRecord as PiiRecord);

      const result = await service.getByToken('PII-81F3');

      expect(result.hashId).toBe('PII-81F3');
    });

    it('should throw NotFoundException if token not found', async () => {
      piiRepository.findOne.mockResolvedValue(null);

      await expect(service.getByToken('PII-0000')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if token has expired', async () => {
      const expiredRecord = {
        ...mockPiiRecord,
        expiresAt: new Date('2020-01-01'),
      };
      piiRepository.findOne.mockResolvedValue(expiredRecord as PiiRecord);

      await expect(service.getByToken('PII-81F3')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkTokenize', () => {
    it('should tokenize multiple items', async () => {
      encryptionService.getActiveKey.mockResolvedValue(mockActiveKey as any);
      encryptionService.encrypt.mockReturnValue('abc:def:enc');
      hashIdService.generate.mockReturnValueOnce('PII-AAA1').mockReturnValueOnce('PII-BBB2');
      piiRepository.create.mockImplementation((data) => data as PiiRecord);
      piiRepository.save.mockImplementation(async (record) => ({
        ...record,
        createdAt: new Date(),
      }) as PiiRecord);
      auditService.logAccess.mockResolvedValue({} as any);
      eventPublisher.publish.mockResolvedValue(undefined);

      const result = await service.bulkTokenize(
        [
          { value: 'email@test.com', dataType: PiiDataType.EMAIL, organizationHashId: 'O-92AF' },
          { value: '555-1234', dataType: PiiDataType.PHONE, organizationHashId: 'O-92AF' },
        ],
        'U-81F3',
        '127.0.0.1',
      );

      expect(result.results).toHaveLength(2);
    });
  });
});
