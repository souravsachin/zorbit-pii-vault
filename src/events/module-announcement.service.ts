import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleAnnouncementService as SdkModuleAnnouncementService } from '@zorbit-platform/sdk-node';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const manifest = require('../../zorbit-module-manifest.json');

/**
 * SDK-backed wrapper (EPIC 9 Tier 1 migration).
 * Kafka announcement + HMAC signing + boot delay + nav-cache notify all
 * live in `@zorbit-platform/sdk-node` now.
 * See `/00_docs/platform/PLAYBOOK-sdk-migration.md`.
 */
@Injectable()
export class ModuleAnnouncementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModuleAnnouncementService.name);
  private readonly sdk: SdkModuleAnnouncementService;

  constructor(private readonly config: ConfigService) {
    this.sdk = new SdkModuleAnnouncementService(config, manifest);
  }

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log(
      `Module announcement wrapper ready for ${manifest.moduleId} v${manifest.version} (SDK-backed)`,
    );
    await this.sdk.onApplicationBootstrap();
  }
}
