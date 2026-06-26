/**
 * PWA 2.0 — cola de sincronización (estructura reservada).
 * No implementado en Sprint PWA 1.0.
 */

export type PwaSyncQueueItemStatus = "pending" | "processing" | "failed"

export type PwaSyncQueueItem = {
  id: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
  status: PwaSyncQueueItemStatus
  retryCount: number
}

/** Placeholder para PWA 2.0 — persistencia de cola offline. */
export type PwaSyncQueueStore = {
  enqueue: (item: Omit<PwaSyncQueueItem, "id" | "createdAt" | "status" | "retryCount">) => Promise<void>
  listPending: () => Promise<PwaSyncQueueItem[]>
  markProcessed: (id: string) => Promise<void>
}

/** Stub — implementar en PWA 2.0 con IndexedDB. */
export const pwaSyncQueueStore: PwaSyncQueueStore = {
  async enqueue() {
    throw new Error("PWA sync queue no implementada (PWA 2.0).")
  },
  async listPending() {
    return []
  },
  async markProcessed() {
    throw new Error("PWA sync queue no implementada (PWA 2.0).")
  },
}
