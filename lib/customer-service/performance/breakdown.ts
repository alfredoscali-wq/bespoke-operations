/**
 * Sprint 28.5 — ATC mutation response breakdown (dev-only instrumentation).
 * Does not change control flow or business behavior.
 */

import { isCustomerServicePerfEnabled } from "@/lib/customer-service/performance/enabled"

export type AtcBreakdownAction =
  | "start-management"
  | "defer"
  | "resolve"

export type AtcBreakdownSnapshot = {
  action: AtcBreakdownAction
  rpcMs: number | null
  refreshInboxMs: number | null
  fetchAtencionMs: number | null
  fetchEventsMs: number | null
  loadDetailMs: number | null
  attachmentsMs: number | null
  renderMs: number | null
  totalMs: number | null
}

type AtcBreakdownSession = {
  action: AtcBreakdownAction
  startedAt: number
  rpcMs: number | null
  refreshInboxMs: number | null
  fetchAtencionMs: number | null
  fetchEventsMs: number | null
  loadDetailMs: number | null
  attachmentsMs: number | null
  renderMs: number | null
  asyncFinishedAt: number | null
}

let activeSession: AtcBreakdownSession | null = null
let lastSnapshot: AtcBreakdownSnapshot | null = null

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function padLabel(label: string, width = 22): string {
  return label.padEnd(width, ".")
}

function formatMs(value: number | null): string {
  if (value == null) return "—"
  return `${Math.round(value)} ms`
}

function waitForNextPaint(): Promise<void> {
  if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

export function resetAtcBreakdownForTests(): void {
  activeSession = null
  lastSnapshot = null
}

export function getActiveAtcBreakdownAction(): AtcBreakdownAction | null {
  return activeSession?.action ?? null
}

export function getLastAtcBreakdownSnapshot(): AtcBreakdownSnapshot | null {
  return lastSnapshot
}

/**
 * Start a mutation breakdown session. Replaces any prior open session.
 */
export function beginAtcBreakdown(action: AtcBreakdownAction): void {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") return

  activeSession = {
    action,
    startedAt: nowMs(),
    rpcMs: null,
    refreshInboxMs: null,
    fetchAtencionMs: null,
    fetchEventsMs: null,
    loadDetailMs: null,
    attachmentsMs: null,
    renderMs: null,
    asyncFinishedAt: null,
  }
}

export function recordAtcBreakdownPhase(
  phase:
    | "rpc"
    | "refreshInbox"
    | "fetchAtencion"
    | "fetchEvents"
    | "loadDetail"
    | "attachments",
  durationMs: number
): void {
  if (!isCustomerServicePerfEnabled() || !activeSession) return

  const rounded = Math.max(0, Math.round(durationMs))
  if (phase === "rpc") activeSession.rpcMs = rounded
  if (phase === "refreshInbox") activeSession.refreshInboxMs = rounded
  if (phase === "fetchAtencion") activeSession.fetchAtencionMs = rounded
  if (phase === "fetchEvents") activeSession.fetchEventsMs = rounded
  if (phase === "loadDetail") activeSession.loadDetailMs = rounded
  if (phase === "attachments") activeSession.attachmentsMs = rounded
}

export async function measureAtcBreakdownPhase<T>(
  phase:
    | "rpc"
    | "refreshInbox"
    | "fetchAtencion"
    | "fetchEvents"
    | "loadDetail"
    | "attachments",
  run: () => Promise<T>
): Promise<T> {
  if (!isCustomerServicePerfEnabled() || !activeSession) {
    return run()
  }

  const started = nowMs()
  try {
    return await run()
  } finally {
    recordAtcBreakdownPhase(phase, nowMs() - started)
  }
}

function logAtcBreakdown(snapshot: AtcBreakdownSnapshot): void {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") return

  console.info(
    [
      "[ATC Breakdown]",
      `${padLabel("Action")} ${snapshot.action}`,
      "",
      `${padLabel("RPC")} ${formatMs(snapshot.rpcMs)}`,
      `${padLabel("Refresh Inbox")} ${formatMs(snapshot.refreshInboxMs)}`,
      `${padLabel("Load Detail")} ${formatMs(snapshot.loadDetailMs)}`,
      `${padLabel("Fetch Atencion")} ${formatMs(snapshot.fetchAtencionMs)}`,
      `${padLabel("Fetch Events")} ${formatMs(snapshot.fetchEventsMs)}`,
      `${padLabel("Attachments")} ${formatMs(snapshot.attachmentsMs)}`,
      `${padLabel("Render")} ${formatMs(snapshot.renderMs)}`,
      `${padLabel("TOTAL")} ${formatMs(snapshot.totalMs)}`,
    ].join("\n")
  )
}

/**
 * Close the active session: measure paint/render gap, log [ATC Breakdown], clear.
 * Safe no-op when no session is open.
 */
export async function finalizeAtcBreakdown(): Promise<void> {
  if (!isCustomerServicePerfEnabled() || typeof window === "undefined") return
  if (!activeSession) return

  const session = activeSession
  session.asyncFinishedAt = nowMs()

  await waitForNextPaint()
  session.renderMs = Math.max(0, Math.round(nowMs() - session.asyncFinishedAt))

  const snapshot: AtcBreakdownSnapshot = {
    action: session.action,
    rpcMs: session.rpcMs,
    refreshInboxMs: session.refreshInboxMs,
    fetchAtencionMs: session.fetchAtencionMs,
    fetchEventsMs: session.fetchEventsMs,
    loadDetailMs: session.loadDetailMs,
    attachmentsMs: session.attachmentsMs,
    renderMs: session.renderMs,
    totalMs: Math.max(0, Math.round(nowMs() - session.startedAt)),
  }

  lastSnapshot = snapshot
  activeSession = null
  logAtcBreakdown(snapshot)
}
