/**
 * Sprint 42.0 — Activity Engine queue.
 *
 * Decouples Activity Engine writes from Atención al Cliente (and other) request
 * critical paths: callers enqueue work and return immediately. Processing is
 * best-effort in the background so auditoría / historial / trazabilidad still
 * persist, without blocking auth + RPC response time.
 *
 * Note: the drain function is named `process` per sprint API. Inside this
 * module, prefer `globalThis.process` when reading Node env.
 */

export type ActivityQueueJob = {
  /** Stable name for logs / debugging (e.g. atc.management.resolve). */
  name: string
  /** Executes the Activity Engine write(s). Must not throw into the caller. */
  run: () => Promise<void>
}

type QueuedActivityJob = ActivityQueueJob & {
  id: string
  enqueuedAt: number
}

const queue: QueuedActivityJob[] = []
let draining = false
let jobSeq = 0

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function nextJobId(): string {
  jobSeq += 1
  return `aq-${Date.now()}-${jobSeq}`
}

function logQueueError(error: unknown): void {
  console.error("[ACTIVITY QUEUE]", error)
}

function isDevelopment(): boolean {
  return globalThis.process?.env?.NODE_ENV === "development"
}

/**
 * Enqueue an activity job. Never awaits persistence.
 * Kicks `process()` in the background so the queue drains.
 */
export function enqueue(job: ActivityQueueJob): string {
  const id = nextJobId()
  queue.push({
    id,
    name: job.name,
    run: job.run,
    enqueuedAt: Date.now(),
  })

  void process()
  return id
}

/**
 * Drain the queue sequentially. Safe to call concurrently — only one
 * processor runs at a time. Failures are isolated per job (logged, next continues).
 */
export async function process(): Promise<void> {
  if (draining) return
  draining = true

  try {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break

      const started = nowMs()
      try {
        await job.run()
        if (isDevelopment()) {
          console.info(
            `[ACTIVITY QUEUE] ok name=${job.name} id=${job.id} ${Math.round(nowMs() - started)} ms`
          )
        }
      } catch (error) {
        logQueueError(error)
        if (isDevelopment()) {
          console.info(
            `[ACTIVITY QUEUE] failed name=${job.name} id=${job.id} ${Math.round(nowMs() - started)} ms`
          )
        }
      }
    }
  } finally {
    draining = false
    // Jobs may have been enqueued while we were finishing — drain again.
    if (queue.length > 0) {
      void process()
    }
  }
}

/** Test / diagnostics helpers (not used on the request path). */
export function getActivityQueueDepthForTests(): number {
  return queue.length
}

export function isActivityQueueProcessingForTests(): boolean {
  return draining
}

export function resetActivityQueueForTests(): void {
  queue.length = 0
  draining = false
  jobSeq = 0
}
