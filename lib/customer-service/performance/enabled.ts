/**
 * ATC performance enablement — development only (Sprint 27 / ATC Perf 1.0).
 * Production: disabled → zero cost, no logs.
 */

let testOverride: boolean | null = null

/** Test-only gate override. Pass `null` to restore env-based behavior. */
export function setCustomerServicePerfEnabledForTests(
  value: boolean | null
): void {
  testOverride = value
}

export function isCustomerServicePerfEnabled(): boolean {
  if (testOverride != null) return testOverride
  return process.env.NODE_ENV === "development"
}
