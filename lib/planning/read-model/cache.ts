/**
 * PlanningReadCache — in-memory jornada snapshot cache (Sprint 19).
 */

import {
  PLANNING_READ_GC_TIME_MS,
  PLANNING_READ_STALE_TIME_MS,
} from "@/lib/planning/read-model/defaults"
import type {
  PlanningReadBuilderInput,
  PlanningReadModel,
} from "@/lib/planning/read-model/types"

type CacheEntry = {
  model: PlanningReadModel
  storedAt: number
}

const memoryCache = new Map<string, CacheEntry>()

function djb2(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

/**
 * Stable fingerprint of builder inputs for cache / React Query keys.
 */
export function buildPlanningReadCacheKey(
  input: PlanningReadBuilderInput
): string {
  const taskSig = input.tasks
    .map(
      (task) =>
        [
          task.id,
          task.status,
          task.dueDate,
          task.crewId ?? "",
          task.dispatchOrder ?? "",
          task.executionOrder ?? "",
          task.estimatedDuration ?? "",
          task.progress ?? "",
        ].join(":")
    )
    .join("|")

  const crewSig = input.crews
    .map(
      (crew) =>
        `${crew.id}:${crew.status}:${crew.members.length}:${crew.habitualShiftMinutes ?? ""}`
    )
    .join("|")

  const employeeSig = `${input.employees.length}:${input.employees
    .map((employee) => employee.id)
    .join(",")}`

  const raw = [
    input.date,
    input.crewFilterId ?? "",
    input.overdueFilterActive ? "1" : "0",
    String(input.dayConfigRevision),
    String(input.activeIncidentsCount),
    djb2(taskSig),
    djb2(crewSig),
    djb2(employeeSig),
  ].join("::")

  return djb2(raw)
}

export function getCachedPlanningReadModel(
  cacheKey: string,
  now: number = Date.now(),
  staleTimeMs: number = PLANNING_READ_STALE_TIME_MS
): PlanningReadModel | null {
  const entry = memoryCache.get(cacheKey)
  if (!entry) return null
  if (now - entry.storedAt >= staleTimeMs) {
    memoryCache.delete(cacheKey)
    return null
  }
  return entry.model
}

export function setCachedPlanningReadModel(
  cacheKey: string,
  model: PlanningReadModel,
  now: number = Date.now()
): void {
  memoryCache.set(cacheKey, { model, storedAt: now })
  prunePlanningReadCache(now)
}

export function getOrBuildPlanningReadModel(
  cacheKey: string,
  builder: () => PlanningReadModel,
  now: number = Date.now()
): PlanningReadModel {
  const cached = getCachedPlanningReadModel(cacheKey, now)
  if (cached) return cached

  const model = builder()
  setCachedPlanningReadModel(cacheKey, model, now)
  return model
}

export function clearPlanningReadCache(): void {
  memoryCache.clear()
}

export function getPlanningReadCacheSize(): number {
  return memoryCache.size
}

function prunePlanningReadCache(now: number): void {
  for (const [key, entry] of memoryCache) {
    if (now - entry.storedAt >= PLANNING_READ_GC_TIME_MS) {
      memoryCache.delete(key)
    }
  }
}
