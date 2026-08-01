/**
 * Server-side agenda task cache for Mobile API (Sprint 18).
 * Reused by agenda/today and task detail (nextWork) while fresh.
 * Never persisted. Cleared via clearMobileAgendaTaskCache.
 */

import type { Task } from "@/lib/types/tasks"
import {
  MOBILE_SESSION_STALE_TIME_MS,
} from "@/lib/mobile/session/mobile-session-store"

type CacheEntry = {
  fetchedAt: number
  tasks: Task[]
}

const agendaTaskCache = new Map<string, CacheEntry>()

function cacheKey(
  companyId: string,
  workTeamId: string,
  referenceDate: string
): string {
  return `${companyId}:${workTeamId}:${referenceDate}`
}

export function getCachedAgendaTasks(
  companyId: string,
  workTeamId: string,
  referenceDate: string,
  now: number = Date.now()
): Task[] | null {
  const entry = agendaTaskCache.get(
    cacheKey(companyId, workTeamId, referenceDate)
  )
  if (!entry) return null
  if (now - entry.fetchedAt >= MOBILE_SESSION_STALE_TIME_MS) {
    agendaTaskCache.delete(cacheKey(companyId, workTeamId, referenceDate))
    return null
  }
  return entry.tasks
}

export function setCachedAgendaTasks(
  companyId: string,
  workTeamId: string,
  referenceDate: string,
  tasks: Task[],
  now: number = Date.now()
): void {
  agendaTaskCache.set(cacheKey(companyId, workTeamId, referenceDate), {
    fetchedAt: now,
    tasks,
  })
}

export function clearMobileAgendaTaskCache(): void {
  agendaTaskCache.clear()
}

export function getMobileAgendaTaskCacheSize(): number {
  return agendaTaskCache.size
}
