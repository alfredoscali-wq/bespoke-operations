/**
 * Opaque Activity Engine event shapes accepted by adapters.
 *
 * Defined inside the adapter boundary — Indicator Engine 2.0 must not import
 * `@/lib/activity` types. Callers outside may pass simulated or live-shaped
 * objects; only the adapter interprets them.
 */

/**
 * Version 1 source event — camelCase and/or snake_case fields.
 * Technical AE fields (severity, origin, geo, session, actor, …) are ignored.
 */
export type ActivityEngineSourceEventV1 = {
  readonly id?: unknown
  readonly module?: unknown
  readonly action?: unknown
  readonly entityType?: unknown
  readonly entity_type?: unknown
  readonly entityId?: unknown
  readonly entity_id?: unknown
  readonly employeeId?: unknown
  readonly employee_id?: unknown
  readonly createdAt?: unknown
  readonly created_at?: unknown
  readonly title?: unknown
  readonly description?: unknown
  /** Legacy AE detail text — used only if description is absent. */
  readonly detail?: unknown
  readonly metadata?: unknown
  /** Ignored technical fields may still appear on the object. */
  readonly [key: string]: unknown
}

/** Placeholder for a future Activity Engine payload revision. */
export type ActivityEngineSourceEventV2 = {
  readonly schemaVersion: 2
  readonly payload: unknown
}
