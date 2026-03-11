# Zorbit Service: zorbit-pii-vault

## Purpose

This repository implements the PII Vault service for the Zorbit platform.

Zorbit is a MACH-compliant shared platform infrastructure used to build enterprise applications.

The PII Vault provides secure storage of Personally Identifiable Information (PII) data,
tokenization, detokenization, and access audit capabilities. All PII data is encrypted at
rest using AES-256-GCM. Raw PII is never stored unencrypted.

## Responsibilities

- Store raw PII (email, phone, SSN, address, name, custom) in encrypted form
- Return opaque tokens (PII-XXXX) for stored PII data
- Detokenize on authorized request (decrypt and return PII)
- Audit all access to PII data (tokenize, detokenize, delete)
- Manage encryption keys with rotation support
- Bulk tokenization and detokenization operations
- Cascade delete PII when user is deleted (via identity.user.deleted event)

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
- Any platform service storing PII data
- zorbit-audit (PII access events)

## Repository Structure

- /src/api — route definitions
- /src/controllers — request handlers (PiiController)
- /src/services — business logic (TokenizationService, DetokenizationService, EncryptionService, AuditService)
- /src/models — database entities (PiiRecord, PiiAccessLog, EncryptionKey) and DTOs
- /src/events — event publishers and consumers
- /src/middleware — JWT, namespace, logging middleware
- /src/config — configuration module
- /tests — unit and integration tests

## Running Locally

```bash
npm install
cp .env.example .env
docker-compose up -d  # PostgreSQL + Kafka
npm run start:dev
```

Service runs on port 3005.

## Events Published

- pii.token.created
- pii.token.accessed
- pii.token.deleted

## Events Consumed

- identity.user.deleted (cascade delete all PII for the user)

## API Endpoints

- POST /api/v1/G/pii/tokenize — store PII data, return opaque token
- POST /api/v1/G/pii/detokenize — send token, get decrypted PII back
- POST /api/v1/G/pii/bulk-tokenize — tokenize multiple PII values
- POST /api/v1/G/pii/bulk-detokenize — detokenize multiple tokens
- DELETE /api/v1/G/pii/tokens/:tokenId — delete a PII token and its data
- GET /api/v1/G/pii/tokens/:tokenId/audit — get access log for a token

## Development Guidelines

Follow Zorbit architecture rules.

- Never store raw PII unencrypted
- Always use AES-256-GCM for encryption at rest
- Log every access (tokenize, detokenize, delete) to PiiAccessLog
- Encryption keys must be encrypted with the master key
- Support key rotation without re-encrypting existing data immediately
