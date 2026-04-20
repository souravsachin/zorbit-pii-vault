import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { createHmac } from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const manifest = require('../../zorbit-module-manifest.json');

@Injectable()
export class ModuleAnnouncementService implements OnModuleInit {
  private readonly logger = new Logger(ModuleAnnouncementService.name);
  private producer!: Producer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.config.get<string>('KAFKA_BROKERS', 'zs-kafka:9092').split(',');
    const kafka = new Kafka({ clientId: manifest.moduleId, brokers });
    this.producer = kafka.producer();

    try {
      await this.producer.connect();
      await this.publish();
      await this.producer.disconnect();
    } catch (err) {
      this.logger.warn('Module announcement failed (non-fatal):', err instanceof Error ? err.message : String(err));
    }
  }

  private async publish(): Promise<void> {
    const secret = this.config.get<string>('PLATFORM_MODULE_SECRET', 'dev-secret');
    const dependencies = normaliseDependenciesV2(manifest.dependencies);
    const manifestUrl: string = manifest.registration.manifestUrl;
    const version: string = manifest.version;
    const moduleId: string = manifest.moduleId;

    // Canonical JSON: recursive key-sort, no whitespace.
    // MUST match HmacValidatorService.canonicalJson byte-for-byte.
    const payloadForSigning = { dependencies, manifestUrl, moduleId, version };
    const canonical = canonicalJson(payloadForSigning);
    const signedToken = createHmac('sha256', secret).update(canonical).digest('hex');

    const message = {
      moduleId,
      moduleName: manifest.moduleName,
      moduleType: manifest.moduleType,
      version,
      manifestUrl,
      dependencies,
      signedToken,
    };

    await this.producer.send({
      topic: 'platform-module-announcements',
      messages: [{ key: moduleId, value: JSON.stringify(message) }],
    });

    this.logger.log(`Module announcement published for ${moduleId} v${version}`);
  }
}

// ---------------------------------------------------------------------------
// Canonical JSON + dependency normaliser — MUST match the registry's
// HmacValidatorService / registry.events.ts implementations byte-for-byte.
//
// Duplicated here (instead of imported) because each Zorbit service is a
// standalone repo and there is no shared sdk-node package yet. When that
// package exists, move these helpers there and delete the local copies.
// ---------------------------------------------------------------------------

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src).sort()) {
      const v = src[key];
      if (v === undefined) continue;
      out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

interface DependenciesV2 {
  platform: string[];
  business: string[];
}

function normaliseDependenciesV2(raw: unknown): DependenciesV2 {
  if (raw === null || raw === undefined) {
    return { platform: [], business: [] };
  }
  if (Array.isArray(raw)) {
    return {
      platform: raw.filter((x): x is string => typeof x === 'string'),
      business: [],
    };
  }
  if (typeof raw !== 'object') {
    return { platform: [], business: [] };
  }
  const obj = raw as Record<string, unknown>;
  const platform: string[] = [];
  const business: string[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (!Array.isArray(val)) continue;
    const items = val.filter((x): x is string => typeof x === 'string');
    if (key === 'business') {
      business.push(...items);
    } else {
      platform.push(...items);
    }
  }
  return { platform, business };
}
