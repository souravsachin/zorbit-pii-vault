/**
 * Canonical event type constants for the PII Vault domain.
 * Naming convention: domain.entity.action
 */
export const PiiEvents = {
  TOKEN_CREATED: 'pii.token.created',
  TOKEN_ACCESSED: 'pii.token.accessed',
  TOKEN_DELETED: 'pii.token.deleted',
} as const;

export type PiiEventType = (typeof PiiEvents)[keyof typeof PiiEvents];

/**
 * External events consumed by this service.
 */
export const ConsumedEvents = {
  IDENTITY_USER_DELETED: 'identity.user.deleted',
} as const;

/**
 * Canonical event envelope for all Zorbit platform events.
 */
export interface ZorbitEventEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  namespace: string;
  namespaceId: string;
  payload: T;
  metadata?: Record<string, string>;
}
