/**
 * Shared pure helpers for Reporting Engine.
 * Keep free of domain-specific report logic.
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function clampLimit(
  limit: number | undefined,
  fallback: number,
  max: number
): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return fallback
  }
  return Math.min(Math.floor(limit), max)
}
