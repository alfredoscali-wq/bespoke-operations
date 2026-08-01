/**
 * Shared utilities for Indicator Engine 2.0.
 * Sprint 1: exhaustiveness helper only — no data access.
 */

export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${String(value)}`)
}
