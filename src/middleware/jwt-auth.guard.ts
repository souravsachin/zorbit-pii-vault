/**
 * SDK-backed re-export (EPIC 9 Tier 1 migration).
 * The NestJS JWT guard now lives in @zorbit-platform/sdk-node as ZorbitJwtGuard.
 */
export { ZorbitJwtGuard as JwtAuthGuard } from '@zorbit-platform/sdk-node';
