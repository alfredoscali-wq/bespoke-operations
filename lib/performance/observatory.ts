/**
 * Performance Observatory — opt-in execution timing.
 * Never changes business behavior. When disabled, all APIs are no-ops.
 *
 * Enable (server): PERF_OBSERVATORY_ENABLED=1
 * Enable (browser + server): NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED=1
 */

export type PerfCheckpointMeta = {
  /** RPC / query name */
  name?: string
  /** Rows affected or returned when known */
  rows?: number | null
  detail?: string
}

export type PerfTraceOptions = {
  /** Logical layer for summaries (backend | frontend | total). */
  layer?: "backend" | "frontend" | "total"
  /** Correlation id (e.g. mobile requestId). */
  requestId?: string | null
}

type Checkpoint = {
  label: string
  atMs: number
  durationMs: number
  meta?: PerfCheckpointMeta
}

export type PerformanceTrace = {
  readonly enabled: boolean
  readonly operation: string
  checkpoint: (label: string, meta?: PerfCheckpointMeta) => void
  /** Time an async block; records one checkpoint for the elapsed span. */
  span: <T>(
    label: string,
    run: () => Promise<T>,
    meta?: PerfCheckpointMeta | (() => PerfCheckpointMeta | undefined)
  ) => Promise<T>
  /** Time a sync block. */
  spanSync: <T>(
    label: string,
    run: () => T,
    meta?: PerfCheckpointMeta | (() => PerfCheckpointMeta | undefined)
  ) => T
  finish: (extra?: Record<string, string | number | null | undefined>) => void
  fail: (error?: unknown) => void
}

const LABEL_WIDTH = 22

function readEnvFlag(name: string): boolean {
  try {
    const value = process.env[name]
    if (!value) return false
    const normalized = value.trim().toLowerCase()
    return normalized === "1" || normalized === "true" || normalized === "yes"
  } catch {
    return false
  }
}

/**
 * Hard kill-switch for local toggles without env.
 * Prefer env vars in shared environments.
 */
const FORCE_PERF_OBSERVATORY = false

export function isPerformanceObservatoryEnabled(): boolean {
  if (FORCE_PERF_OBSERVATORY) return true
  return (
    readEnvFlag("PERF_OBSERVATORY_ENABLED") ||
    readEnvFlag("NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED")
  )
}

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0 ms"
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(3)} s`
  }
  if (ms >= 10) {
    return `${Math.round(ms)} ms`
  }
  return `${ms.toFixed(1)} ms`
}

function padLabel(label: string): string {
  if (label.length >= LABEL_WIDTH) return label
  return label + ".".repeat(LABEL_WIDTH - label.length)
}

function formatMeta(meta?: PerfCheckpointMeta): string {
  if (!meta) return ""
  const parts: string[] = []
  if (meta.name) parts.push(meta.name)
  if (meta.rows != null && Number.isFinite(meta.rows)) {
    parts.push(`${meta.rows} row${meta.rows === 1 ? "" : "s"}`)
  }
  if (meta.detail) parts.push(meta.detail)
  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}

function resolveMeta(
  meta?: PerfCheckpointMeta | (() => PerfCheckpointMeta | undefined)
): PerfCheckpointMeta | undefined {
  if (typeof meta === "function") {
    try {
      return meta()
    } catch {
      return undefined
    }
  }
  return meta
}

const noopTrace: PerformanceTrace = {
  enabled: false,
  operation: "",
  checkpoint() {},
  async span(_label, run) {
    return run()
  },
  spanSync(_label, run) {
    return run()
  },
  finish() {},
  fail() {},
}

function printSummary(input: {
  operation: string
  layer?: string
  requestId?: string | null
  totalMs: number
  checkpoints: Checkpoint[]
  failed?: boolean
  extra?: Record<string, string | number | null | undefined>
}) {
  const lines: string[] = []
  lines.push("================================================")
  lines.push(input.operation)
  if (input.layer) {
    lines.push(`Layer: ${input.layer}`)
  }
  if (input.requestId) {
    lines.push(`Request: ${input.requestId}`)
  }
  if (input.failed) {
    lines.push("Status: FAILED")
  }
  lines.push(`Total: ${formatDuration(input.totalMs)}`)
  lines.push("")
  for (const checkpoint of input.checkpoints) {
    lines.push(
      `${padLabel(checkpoint.label)}${formatDuration(checkpoint.durationMs)}${formatMeta(checkpoint.meta)}`
    )
  }
  if (input.extra) {
    for (const [key, value] of Object.entries(input.extra)) {
      if (value == null || value === "") continue
      lines.push(`${padLabel(key)}${String(value)}`)
    }
  }
  lines.push("================================================")
  console.info(lines.join("\n"))
}

/**
 * Start a named performance trace. Safe to call when disabled (returns no-op).
 */
export function startPerformanceTrace(
  operation: string,
  options: PerfTraceOptions = {}
): PerformanceTrace {
  if (!isPerformanceObservatoryEnabled()) {
    return noopTrace
  }

  const startedAt = nowMs()
  let lastAt = startedAt
  const checkpoints: Checkpoint[] = []
  let finished = false

  const record = (label: string, durationMs: number, meta?: PerfCheckpointMeta) => {
    const atMs = nowMs()
    checkpoints.push({
      label,
      atMs,
      durationMs,
      meta,
    })
    lastAt = atMs
  }

  const end = (failed: boolean, extra?: Record<string, string | number | null | undefined>) => {
    if (finished) return
    finished = true
    const totalMs = nowMs() - startedAt
    printSummary({
      operation,
      layer: options.layer,
      requestId: options.requestId,
      totalMs,
      checkpoints,
      failed,
      extra,
    })
  }

  return {
    enabled: true,
    operation,
    checkpoint(label, meta) {
      if (finished) return
      const at = nowMs()
      record(label, at - lastAt, meta)
    },
    async span(label, run, meta) {
      if (finished) return run()
      const spanStart = nowMs()
      try {
        const result = await run()
        record(label, nowMs() - spanStart, resolveMeta(meta))
        return result
      } catch (error) {
        record(label, nowMs() - spanStart, {
          ...resolveMeta(meta),
          detail: "error",
        })
        throw error
      }
    },
    spanSync(label, run, meta) {
      if (finished) return run()
      const spanStart = nowMs()
      try {
        const result = run()
        record(label, nowMs() - spanStart, resolveMeta(meta))
        return result
      } catch (error) {
        record(label, nowMs() - spanStart, {
          ...resolveMeta(meta),
          detail: "error",
        })
        throw error
      }
    },
    finish(extra) {
      end(false, extra)
    },
    fail(error) {
      const message =
        error instanceof Error
          ? error.message
          : error != null
            ? String(error)
            : undefined
      end(true, message ? { Error: message } : undefined)
    },
  }
}

/** Convenience: run an async function under a finished trace. */
export async function withPerformanceTrace<T>(
  operation: string,
  run: (trace: PerformanceTrace) => Promise<T>,
  options?: PerfTraceOptions
): Promise<T> {
  const trace = startPerformanceTrace(operation, options)
  try {
    const result = await run(trace)
    trace.finish()
    return result
  } catch (error) {
    trace.fail(error)
    throw error
  }
}
