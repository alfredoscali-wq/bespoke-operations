/**
 * Performance Observatory — opt-in execution timing.
 * Never changes business behavior. When disabled, all APIs are no-ops.
 *
 * Enable (server): PERF_OBSERVATORY_ENABLED=1
 * Enable (browser + server): NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED=1
 */

export type PerfCheckpointMeta = {
  /** RPC / operation name */
  name?: string
  /** Rows affected or returned when known */
  rows?: number | null
  detail?: string
  /** section = header row; span = timed step */
  kind?: "section" | "span"
  /** 1 = indented under the last section */
  depth?: number
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
  /** Prints a section header in the summary (no timing). */
  section: (title: string) => void
  /**
   * Runs work under a section scope. Children recorded via the scoped trace
   * stay grouped under this section even when sections run in parallel.
   */
  runSection: <T>(
    title: string,
    run: (section: PerformanceTrace) => Promise<T>
  ) => Promise<T>
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

function readEnvFlag(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

/**
 * Hard kill-switch for local toggles without env.
 * Prefer env vars in shared environments.
 */
const FORCE_PERF_OBSERVATORY = false

/** Static env reads — required for Next.js/Turbopack inlining. */
const PERF_OBSERVATORY_ENABLED = process.env.PERF_OBSERVATORY_ENABLED
const NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED =
  process.env.NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED

export function isPerformanceObservatoryEnabled(): boolean {
  if (FORCE_PERF_OBSERVATORY) return true
  return (
    readEnvFlag(PERF_OBSERVATORY_ENABLED) ||
    readEnvFlag(NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED)
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
  section() {},
  async runSection(_title, run) {
    return run(noopTrace)
  },
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

function createScopedTrace(input: {
  operation: string
  finished: () => boolean
  recordChild: (checkpoint: Checkpoint) => void
}): PerformanceTrace {
  const childMeta = (meta?: PerfCheckpointMeta): PerfCheckpointMeta => ({
    ...meta,
    kind: meta?.kind ?? "span",
    depth: meta?.depth ?? 1,
  })

  const record = (label: string, durationMs: number, meta?: PerfCheckpointMeta) => {
    input.recordChild({
      label,
      atMs: nowMs(),
      durationMs,
      meta,
    })
  }

  const scoped: PerformanceTrace = {
    enabled: true,
    operation: input.operation,
    section(title) {
      if (input.finished()) return
      record(title, 0, { kind: "section", depth: 1 })
    },
    async runSection(title, run) {
      if (input.finished()) return run(noopTrace)
      // Nested sections flatten into this scope's buffer (still contiguous).
      const nestedChildren: Checkpoint[] = []
      const nestedHeader: Checkpoint = {
        label: title,
        atMs: nowMs(),
        durationMs: 0,
        meta: { kind: "section", depth: 1 },
      }
      const nested = createScopedTrace({
        operation: title,
        finished: input.finished,
        recordChild: (checkpoint) => nestedChildren.push(checkpoint),
      })
      try {
        return await run(nested)
      } finally {
        input.recordChild(nestedHeader)
        for (const child of nestedChildren) {
          input.recordChild(child)
        }
      }
    },
    checkpoint(label, meta) {
      if (input.finished()) return
      record(label, 0, childMeta(meta))
    },
    async span(label, run, meta) {
      if (input.finished()) return run()
      const spanStart = nowMs()
      try {
        const result = await run()
        record(label, nowMs() - spanStart, childMeta(resolveMeta(meta)))
        return result
      } catch (error) {
        record(
          label,
          nowMs() - spanStart,
          childMeta({
            ...resolveMeta(meta),
            detail: "error",
          })
        )
        throw error
      }
    },
    spanSync(label, run, meta) {
      if (input.finished()) return run()
      const spanStart = nowMs()
      try {
        const result = run()
        record(label, nowMs() - spanStart, childMeta(resolveMeta(meta)))
        return result
      } catch (error) {
        record(
          label,
          nowMs() - spanStart,
          childMeta({
            ...resolveMeta(meta),
            detail: "error",
          })
        )
        throw error
      }
    },
    finish() {},
    fail() {},
  }

  return scoped
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
  lines.push("=====================================")
  lines.push(input.operation)
  lines.push("=====================================")
  if (input.layer) {
    lines.push(`Layer: ${input.layer}`)
  }
  if (input.requestId) {
    lines.push(`Request: ${input.requestId}`)
  }
  if (input.failed) {
    lines.push("Status: FAILED")
  }
  lines.push("")
  for (const checkpoint of input.checkpoints) {
    if (checkpoint.meta?.kind === "section") {
      lines.push("")
      lines.push(checkpoint.label)
      lines.push("")
      continue
    }
    const depth = checkpoint.meta?.depth ?? 0
    const indent = depth > 0 ? " " : ""
    const label = checkpoint.label.trimStart()
    lines.push(
      `${indent}${padLabel(label)}${formatDuration(checkpoint.durationMs)}${formatMeta(checkpoint.meta)}`
    )
  }
  lines.push("")
  lines.push(`${padLabel("TOTAL")}${formatDuration(input.totalMs)}`)
  if (input.extra) {
    for (const [key, value] of Object.entries(input.extra)) {
      if (value == null || value === "") continue
      lines.push(`${padLabel(key)}${String(value)}`)
    }
  }
  lines.push("=====================================")
  const summary = lines.join("\n")
  console.info(summary)
  console.log(summary)
}

/**
 * Start a named performance trace. Safe to call when disabled (returns no-op).
 */
export function startPerformanceTrace(
  operation: string,
  options: PerfTraceOptions = {}
): PerformanceTrace {
  const enabled = isPerformanceObservatoryEnabled()

  // Temporary diagnostics — confirm instrumentation + env wiring.
  if (enabled) {
    console.log("[PERF] Observatory enabled")
    console.log(`[PERF] Trace started: ${operation}`)
  } else {
    console.log("[PERF] Observatory disabled", {
      PERF_OBSERVATORY_ENABLED,
      NEXT_PUBLIC_PERF_OBSERVATORY_ENABLED,
      FORCE_PERF_OBSERVATORY,
    })
  }

  if (!enabled) {
    return noopTrace
  }

  const startedAt = nowMs()
  let lastAt = startedAt
  const checkpoints: Checkpoint[] = []
  let finished = false
  let inSection = false

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

  const childMeta = (meta?: PerfCheckpointMeta): PerfCheckpointMeta => ({
    ...meta,
    kind: meta?.kind ?? "span",
    depth: meta?.depth ?? (inSection ? 1 : 0),
  })

  const end = (
    failed: boolean,
    extra?: Record<string, string | number | null | undefined>
  ) => {
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
    section(title) {
      if (finished) return
      inSection = true
      record(title, 0, { kind: "section" })
    },
    async runSection(title, run) {
      if (finished) return run(noopTrace)

      // Reserve header immediately so parallel sections keep declaration order.
      const header: Checkpoint = {
        label: title,
        atMs: nowMs(),
        durationMs: 0,
        meta: { kind: "section" },
      }
      checkpoints.push(header)
      inSection = true

      const children: Checkpoint[] = []
      const scoped = createScopedTrace({
        operation: title,
        finished: () => finished,
        recordChild: (checkpoint) => children.push(checkpoint),
      })

      try {
        return await run(scoped)
      } finally {
        const headerIndex = checkpoints.indexOf(header)
        if (headerIndex >= 0) {
          checkpoints.splice(headerIndex + 1, 0, ...children)
        } else {
          checkpoints.push(header, ...children)
        }
      }
    },
    checkpoint(label, meta) {
      if (finished) return
      const at = nowMs()
      record(label, at - lastAt, childMeta(meta))
    },
    async span(label, run, meta) {
      if (finished) return run()
      const spanStart = nowMs()
      try {
        const result = await run()
        record(label, nowMs() - spanStart, childMeta(resolveMeta(meta)))
        return result
      } catch (error) {
        record(
          label,
          nowMs() - spanStart,
          childMeta({
            ...resolveMeta(meta),
            detail: "error",
          })
        )
        throw error
      }
    },
    spanSync(label, run, meta) {
      if (finished) return run()
      const spanStart = nowMs()
      try {
        const result = run()
        record(label, nowMs() - spanStart, childMeta(resolveMeta(meta)))
        return result
      } catch (error) {
        record(
          label,
          nowMs() - spanStart,
          childMeta({
            ...resolveMeta(meta),
            detail: "error",
          })
        )
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
