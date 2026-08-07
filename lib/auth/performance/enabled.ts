/**
 * Sprint 29.0 — Proxy / auth performance instrumentation.
 * Development only. Never changes control flow or auth decisions.
 */

let testOverride: boolean | null = null

export function setAuthPerfEnabledForTests(value: boolean | null): void {
  testOverride = value
}

export function isAuthPerfEnabled(): boolean {
  if (testOverride != null) return testOverride
  return process.env.NODE_ENV === "development"
}

export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

export function padLabel(label: string, width = 22): string {
  return label.padEnd(width, ".")
}

export function formatMs(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${Math.round(value)} ms`
}
