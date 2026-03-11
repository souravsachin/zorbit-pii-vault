# zorbit-pii-vault

Zorbit Platform PII Vault Service — secure storage of Personally Identifiable Information with tokenization and encryption at rest.

## Quick Start

```bash
npm install
cp .env.example .env
docker-compose up -d
npm run start:dev
```

Service runs on **port 3005**.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/G/pii/tokenize | Store PII, get opaque token |
| POST | /api/v1/G/pii/detokenize | Send token, get PII back |
| POST | /api/v1/G/pii/bulk-tokenize | Tokenize multiple values |
| POST | /api/v1/G/pii/bulk-detokenize | Detokenize multiple tokens |
| DELETE | /api/v1/G/pii/tokens/:tokenId | Delete a PII token |
| GET | /api/v1/G/pii/tokens/:tokenId/audit | Access log for a token |

## Architecture

All PII data is encrypted at rest using AES-256-GCM. The encryption key is itself encrypted with a master key provided via environment variable. Raw PII is never stored unencrypted.
