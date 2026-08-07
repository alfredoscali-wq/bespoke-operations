/**
 * ATC browser-side performance — Sprint 27.1.
 * Development only. Never changes UX or business logic.
 */

import { isCustomerServicePerfEnabled } from "@/lib/customer-service/performance/enabled"

export type AtcClientInvalidationRecord = {
  key: string
  timestamp: string
}

export type AtcClientPerfSnapshot = {
  inboxLoadMs: number | null
  detailLoadMs: number | null
  seguimientosMs: number | null
  attachmentsMs: number | null
  invalidations: AtcClientInvalidationRecord[]
}

type AtcClientSpanName =
  | "inboxLoad"
  | "detailLoad"
  | "seguimientos"
  | "attachments"

const state: AtcClientPerfSnapshot = {
  inboxLoadMs: null,
  detailLoadMs: null,
  seguimientosMs: null,
  attachmentsMs: null,
  invalidations: [],
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function padLabel(label: string, width = 18): string {
  return label.padEnd(width, ".")
}

function formatMs(value: number | null): string {
  if (value == null) return "—"
  return `${Math.round(value)} ms`
}

export function resetAtcClientPerfForTests(): void {
  state.inboxLoadMs = null
  state.detailLoadMs = null
  state.seguimientosMs = null
  state.attachmentsMs = null
  state.invalidations = []
}

export function getAtcClientPerfSnapshot(): AtcClientPerfSnapshot {
  return {
    inboxLoadMs: state.inboxLoadMs,
    detailLoadMs: state.detailLoadMs,
    seguimientosMs: state.seguimientosMs,
    attachmentsMs: state.attachmentsMs,
    invalidations: [...state.invalidations],
  }
}

export function logAtcClientSummary(reason?: string): void {
  if (!isCustomerServicePerfEnabled()) return
  if (typeof window === "undefined") return

  const invalidationLines =
    state.invalidations.length === 0
      ? ["  (none)"]
      : state.invalidations.map(
          (item) => `  - ${item.key} @ ${item.timestamp}`
        )

  console.info(
    [
      "[ATC Client]",
      reason ? `Event: ${reason}` : null,
      `${padLabel("Inbox Load")} ${formatMs(state.inboxLoadMs)}`,
      `${padLabel("Detail Load")} ${formatMs(state.detailLoadMs)}`,
      `${padLabel("Seguimientos")} ${formatMs(state.seguimientosMs)}`,
      `${padLabel("Attachments")} ${formatMs(state.attachmentsMs)}`,
      "",
      "React Query Invalidations:",
      ...invalidationLines,
    ]
      .filter((line) => line != null)
      .join("\n")
  )
}

function recordSpan(name: AtcClientSpanName, durationMs: number): void {
  const rounded = Math.max(0, Math.round(durationMs))
  if (name === "inboxLoad") state.inboxLoadMs = rounded
  if (name === "detailLoad") state.detailLoadMs = rounded
  if (name === "seguimientos") state.seguimientosMs = rounded
  if (name === "attachments") state.attachmentsMs = rounded
}

/**
 * Time a browser-side ATC operation and refresh the [ATC Client] block.
 */
export async function measureAtcClientSpan<T>(
  name: AtcClientSpanName,
  run: () => Promise<T>,
  options?: { log?: boolean; reason?: string }
): Promise<T> {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") {
    return run()
  }

  const started = nowMs()
  try {
    return await run()
  } finally {
    recordSpan(name, nowMs() - started)
    if (options?.log !== false) {
      logAtcClientSummary(options?.reason ?? name)
    }
  }
}

export function measureAtcClientSpanSync<T>(
  name: AtcClientSpanName,
  run: () => T,
  options?: { log?: boolean; reason?: string }
): T {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") {
    return run()
  }

  const started = nowMs()
  try {
    return run()
  } finally {
    recordSpan(name, nowMs() - started)
    if (options?.log !== false) {
      logAtcClientSummary(options?.reason ?? name)
    }
  }
}

export function trackAtcQueryInvalidation(
  queryKey: unknown,
  options?: { log?: boolean }
): void {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") return

  const key = serializeQueryKey(queryKey)
  if (!isAtcRelatedQueryKey(key)) return

  state.invalidations.push({
    key,
    timestamp: new Date().toISOString(),
  })

  // Keep the log readable.
  if (state.invalidations.length > 40) {
    state.invalidations = state.invalidations.slice(-40)
  }

  if (options?.log !== false) {
    logAtcClientSummary("invalidateQueries")
  }
}

function serializeQueryKey(queryKey: unknown): string {
  try {
    return JSON.stringify(queryKey)
  } catch {
    return String(queryKey)
  }
}

function isAtcRelatedQueryKey(serialized: string): boolean {
  const normalized = serialized.toLowerCase()
  return (
    normalized.includes("customer_atencion") ||
    normalized.includes("customer-atencion") ||
    normalized.includes("atencion-cliente") ||
    normalized.includes("atencion_cliente") ||
    normalized.includes("shared-inbox") ||
    normalized.includes("sharedinbox") ||
    normalized.includes("seguimiento")
  )
}

let queryPatchInstalled = false

/**
 * Patch QueryClient.invalidateQueries once (dev only) to observe ATC-related keys.
 */
export function installAtcClientQueryInvalidationPatch(
  QueryClientCtor: { prototype: { invalidateQueries: (...args: never[]) => unknown } }
): void {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") return
  if (queryPatchInstalled) return

  const original = QueryClientCtor.prototype.invalidateQueries
  if (typeof original !== "function") return

  QueryClientCtor.prototype.invalidateQueries = function patchedInvalidateQueries(
    this: unknown,
    ...args: unknown[]
  ) {
    const filters = args[0] as { queryKey?: unknown } | unknown
    const queryKey =
      filters &&
      typeof filters === "object" &&
      filters !== null &&
      "queryKey" in filters
        ? (filters as { queryKey?: unknown }).queryKey
        : filters

    if (queryKey !== undefined) {
      trackAtcQueryInvalidation(queryKey)
    }

    return (original as (...inner: unknown[]) => unknown).apply(this, args)
  }

  queryPatchInstalled = true
}

export function isAtcClientQueryPatchInstalledForTests(): boolean {
  return queryPatchInstalled
}

export function resetAtcClientQueryPatchFlagForTests(): void {
  queryPatchInstalled = false
}
