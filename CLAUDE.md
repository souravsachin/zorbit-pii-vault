# Zorbit Service: zorbit-pii-vault

## Purpose

This repository implements the PII Vault service for the Zorbit platform.

Zorbit is a MACH-compliant shared platform infrastructure used to build enterprise applications.

The PII Vault provides secure storage of Personally Identifiable Information (PII) data,
tokenization, detokenization, and access audit capabilities. All PII data is encrypted at
rest using AES-256-GCM. Raw PII is never stored unencrypted.

**This is one of the 4 critical platform capabilities** (alongside DataTable, FormBuilder, and Workflow Engine).

## Responsibilities

- Store raw PII (email, phone, SSN, address, name, date_of_birth, passport, national_id, bank_account, medical_record, custom) in encrypted form
- Return opaque tokens (PII-XXXX) for stored PII data
- Detokenize on authorized request (decrypt and return PII)
- Audit all access to PII data (tokenize, detokenize, delete)
- Manage encryption keys with rotation support
- Bulk tokenization and detokenization operations
- Cascade delete PII when user is deleted (via identity.user.deleted event)
- **Role-based visibility engine**: resolve tokens to appropriate representation (full/nickname/masked/token) based on caller role, data ownership context, and optional IP restriction

## Architecture Context

This service follows Zorbit platform architecture.

Key rules:

- REST API grammar: /api/v1/{namespace}/{namespace_id}/resource
- namespace-based multi-tenancy (G, O, D, U)
- short hash identifiers (PREFIX-HASH, e.g. PII-81F3, EK-92AF)
- event-driven integration (domain.entity.action)
- service isolation
- PII data encrypted at rest with AES-256-GCM
- Encryption keys encrypted with master key from environment

## Critical Architecture Rule: Separate PII Database

**The PII Vault database MUST be on a separate host from operational databases.**

Currently same PostgreSQL instance (KNOWN GAP - backlog A5.01). The goal is:
- Operational databases: one host
- PII vault database: separate host, separate credentials, separate backup policy
- Only the PII Vault service talks to the PII database
- All other services store only tokens (PII-XXXX), never raw PII

## Dependencies

Allowed dependencies:

- zorbit-identity (JWT validation)
- zorbit-messaging (Kafka)

Forbidden dependencies:

- direct database access to other services
- cross-service code imports

## Platform Dependencies

Upstream services:
- zorbit-identity (JWT authentication)
- zorbit-messaging (Kafka event bus)

Downstream consumers:
- zorbit-identity (PII tokenization for user emails)
- sample-customer-service (customer PII)
- zorbit-app-hi_quotation (policyholder PII)
- Any business module storing personal data
- zorbit-audit (PII access events)

## Repository Structure

```
/src
  /api            - route definitions (not currently used, routes in controllers)
  /controllers    - PiiController (all CRUD), HealthController
  /services       - TokenizationService, DetokenizationService, EncryptionService, AuditService, HashIdService
  /models
    /entities     - PiiRecord, PiiAccessLog, EncryptionKey (TypeORM entities)
    /dto          - TokenizeDto, DetokenizeDto, BulkTokenizeDto, BulkDetokenizeDto
  /events         - EventPublisherService, EventConsumerService, PiiEvents constants
  /middleware     - JwtAuthGuard, JwtStrategy
  /config         - database.config.ts (TypeORM DataSource for migrations)
  /modules        - pii.module.ts, events.module.ts
  /visibility     - Role-based visibility engine (VisibilityModule)
    /entities     - VisibilityPolicy, PiiNickname (TypeORM entities)
    /dto          - CreateVisibilityPolicyDto, ResolveVisibilityDto
    visibility.controller.ts  - Policy CRUD + resolve-visibility endpoint
    visibility.service.ts     - Policy resolution logic, nickname generation
    visibility.module.ts
/tests            - unit and integration tests
Dockerfile        - multi-stage Node 20 Alpine build
```

## Running Locally

```bash
npm install
cp .env.example .env
# Ensure PostgreSQL is running on port 5437
# Ensure Kafka is running on port 9096
npm run start:dev
```

Service runs on port 3005. Swagger docs at http://localhost:3005/api-docs

Production/server port: 3105

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3005 | Service port |
| DATABASE_HOST | localhost | PostgreSQL host |
| DATABASE_PORT | 5437 | PostgreSQL port |
| DATABASE_NAME | zorbit_pii_vault | Database name |
| DATABASE_USER | zorbit | Database user |
| DATABASE_PASSWORD | zorbit_dev | Database password |
| DATABASE_SYNCHRONIZE | false | Auto-create tables (true for dev) |
| JWT_SECRET | (required) | Same JWT secret as zorbit-identity |
| KAFKA_BROKERS | localhost:9096 | Kafka broker addresses |
| KAFKA_CLIENT_ID | zorbit-pii-vault | Kafka client ID |
| KAFKA_GROUP_ID | zorbit-pii-vault-group | Kafka consumer group |
| ENCRYPTION_MASTER_KEY | (required) | 64-char hex string (256-bit key) for encrypting encryption keys |
| CORS_ORIGINS | http://localhost:3000 | Comma-separated allowed origins |

## Events Published

- pii.token.created
- pii.token.accessed
- pii.token.deleted

## Events Consumed

- identity.user.deleted (cascade delete all PII for the user)

## API Endpoints

All endpoints require JWT Bearer token (except health).

### Health
- GET /api/v1/G/health - service health check (no auth required)

### Tokenize
- POST /api/v1/G/pii/tokenize - store PII data, return opaque token
- POST /api/v1/G/pii/bulk-tokenize - tokenize multiple PII values

### Detokenize
- POST /api/v1/G/pii/detokenize - send token, get decrypted PII back
- POST /api/v1/G/pii/bulk-detokenize - detokenize multiple tokens

### Management
- DELETE /api/v1/G/pii/tokens/:tokenId - delete a PII token and its data
- GET /api/v1/G/pii/tokens/:tokenId/audit - get access log for a token

### Visibility Policies (org-scoped)
- POST /api/v1/O/:orgId/pii/visibility-policies - create visibility policy
- GET  /api/v1/O/:orgId/pii/visibility-policies - list policies (filterable by piiType, role)
- GET  /api/v1/O/:orgId/pii/visibility-policies/:policyId - get policy
- PUT  /api/v1/O/:orgId/pii/visibility-policies/:policyId - update policy
- DELETE /api/v1/O/:orgId/pii/visibility-policies/:policyId - delete policy
- POST /api/v1/O/:orgId/pii/visibility-policies/seed-defaults - seed built-in defaults

### Resolve Visibility (main DataTable integration point)
- POST /api/v1/O/:orgId/pii/resolve-visibility - batch resolve tokens with role-based visibility

## Supported Data Types

| Type | Example | Use Case |
|------|---------|----------|
| email | user@example.com | User registration, contact |
| phone | +971501234567 | Contact, OTP delivery |
| ssn | 123-45-6789 | US Social Security Number |
| address | 123 Main St, Dubai | Physical address |
| name | Sourav Sachin | Full name, first/last |
| date_of_birth | 1990-01-15 | Policyholder DOB |
| passport | AB1234567 | Travel document |
| national_id | 784-1990-1234567-1 | Emirates ID, Aadhaar |
| bank_account | AE070331234567890123456 | IBAN, account numbers |
| medical_record | MRN-2024-001234 | Medical record numbers |
| custom | (any string) | Catch-all for unlisted types |

## API Contract Examples

### Tokenize (single)
```bash
curl -X POST http://localhost:3105/api/v1/G/pii/tokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "sourav@example.com",
    "dataType": "email",
    "organizationHashId": "O-OZPY"
  }'
```

Response:
```json
{
  "token": "PII-A3F2",
  "dataType": "email",
  "createdAt": "2026-04-09T10:00:00.000Z"
}
```

### Detokenize
```bash
curl -X POST http://localhost:3105/api/v1/G/pii/detokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "token": "PII-A3F2" }'
```

Response:
```json
{
  "token": "PII-A3F2",
  "value": "sourav@example.com",
  "dataType": "email"
}
```

### Bulk Tokenize
```bash
curl -X POST http://localhost:3105/api/v1/G/pii/bulk-tokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "value": "Sourav Sachin", "dataType": "name", "organizationHashId": "O-OZPY" },
      { "value": "+971501234567", "dataType": "phone", "organizationHashId": "O-OZPY" },
      { "value": "784-1990-1234567-1", "dataType": "national_id", "organizationHashId": "O-OZPY" }
    ]
  }'
```

### Bulk Detokenize
```bash
curl -X POST http://localhost:3105/api/v1/G/pii/bulk-detokenize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "tokens": ["PII-A3F2", "PII-B4C1", "PII-D5E6"] }'
```

### Delete Token
```bash
curl -X DELETE http://localhost:3105/api/v1/G/pii/tokens/PII-A3F2 \
  -H "Authorization: Bearer $TOKEN"
```

### Get Audit Log
```bash
curl http://localhost:3105/api/v1/G/pii/tokens/PII-A3F2/audit \
  -H "Authorization: Bearer $TOKEN"
```

## How Business Modules Should Use the PII Vault

### Pattern: Store PII on creation, store token in operational DB

```typescript
// In your business module service (e.g., customer service)
async createCustomer(dto: CreateCustomerDto, jwt: string) {
  // 1. Tokenize PII fields
  const piiResponse = await this.httpService.axiosRef.post(
    `${PII_VAULT_URL}/api/v1/G/pii/bulk-tokenize`,
    {
      items: [
        { value: dto.email, dataType: 'email', organizationHashId: dto.orgId },
        { value: dto.phone, dataType: 'phone', organizationHashId: dto.orgId },
        { value: dto.fullName, dataType: 'name', organizationHashId: dto.orgId },
      ],
    },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  const [emailToken, phoneToken, nameToken] = piiResponse.data.results;

  // 2. Store ONLY tokens in operational database
  const customer = await this.customerRepo.save({
    hashId: generateHashId('CUS'),
    emailToken: emailToken.token,    // PII-XXXX — not raw email
    phoneToken: phoneToken.token,    // PII-XXXX — not raw phone
    nameToken: nameToken.token,      // PII-XXXX — not raw name
    organizationHashId: dto.orgId,
    // ...other non-PII fields...
  });

  return customer;
}
```

### Pattern: Detokenize for display

```typescript
async getCustomerForDisplay(hashId: string, jwt: string) {
  const customer = await this.customerRepo.findOne({ where: { hashId } });

  // Detokenize for display
  const piiResponse = await this.httpService.axiosRef.post(
    `${PII_VAULT_URL}/api/v1/G/pii/bulk-detokenize`,
    { tokens: [customer.emailToken, customer.phoneToken, customer.nameToken] },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  return {
    ...customer,
    email: piiResponse.data.results[0].value,
    phone: piiResponse.data.results[1].value,
    name: piiResponse.data.results[2].value,
  };
}
```

### Key Rules for Business Modules

1. NEVER store raw PII in your operational database
2. ALWAYS forward the JWT when calling PII Vault (it requires auth)
3. Include organizationHashId in tokenize requests (required for org isolation)
4. Use bulk operations when tokenizing/detokenizing multiple fields
5. The PII-XXXX token is safe to store, log, and display -- it reveals nothing
6. Token expiration is optional (use for temporary data like OTPs)

## Encryption Architecture

```
User Request -> PII Vault -> AES-256-GCM encrypt with Data Key -> Store ciphertext
                                |
                                +-- Data Key encrypted with Master Key (ENCRYPTION_MASTER_KEY env)
                                |
                                +-- Key rotation: new key for new records, old keys kept for decryption
```

- Each PII record references the encryption key used (encryptionKeyId)
- Key rotation creates a new active key; old keys remain for decrypting old records
- Master key is never stored in the database -- only in environment variable
- Encrypted value format: hex(iv):hex(authTag):hex(ciphertext)

## Database Schema (PostgreSQL)

### pii_records
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hash_id | varchar(20) | Short hash ID (PII-XXXX), unique, indexed |
| data_type | enum | email, phone, ssn, address, name, date_of_birth, passport, national_id, bank_account, medical_record, custom |
| encrypted_value | text | AES-256-GCM encrypted PII |
| encryption_key_id | varchar(20) | Reference to encryption key |
| organization_hash_id | varchar(20) | Org scope, indexed |
| created_by | varchar(20) | User who tokenized |
| created_at | timestamptz | Creation timestamp |
| expires_at | timestamptz | Optional expiration |

### pii_access_logs
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hash_id | varchar(20) | Short hash ID (PAL-XXXX) |
| pii_token_id | varchar(20) | Which token was accessed |
| accessed_by | varchar(20) | Who accessed it |
| action | enum | tokenize, detokenize, delete |
| ip_address | varchar(45) | Client IP |
| created_at | timestamptz | Access timestamp |

### encryption_keys
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hash_id | varchar(20) | Short hash ID (EK-XXXX) |
| key_material | text | Encrypted with master key |
| version | integer | Key version number |
| is_active | boolean | Active for new encryptions |
| created_at | timestamptz | Creation timestamp |
| rotated_at | timestamptz | When rotated (null if current) |

## Development Guidelines

Follow Zorbit architecture rules.

- Never store raw PII unencrypted
- Always use AES-256-GCM for encryption at rest
- Log every access (tokenize, detokenize, delete) to PiiAccessLog
- Encryption keys must be encrypted with the master key
- Support key rotation without re-encrypting existing data immediately
- All endpoints require JWT auth (except health check)
- Forward JWT from calling services

## Backlog Items (from BACKLOG-FULL-20260409.md)

| ID | Item | Priority | Status |
|----|------|----------|--------|
| A5.01 | Separate PII database host | P1 | NOT-STARTED |
| A5.02 | PII detection on all data ingestion | P0 | NOT-STARTED |
| A5.03 | Fake/nickname assignment layer | P2 | DONE (PiiNickname entity + auto-generation in VisibilityService) |
| A5.04 | Role-based PII visibility levels | P2 | DONE (VisibilityModule: policies, resolve-visibility endpoint) |
| A5.05 | PII Showcase module | P3 | NOT-STARTED |
| A5.06 | Bulk PII upload with SSE progress | P3 | NOT-STARTED |
