/**
 * In-memory store for baseline ScreenMetrics (Sprint 14).
 * Never logs, persists, or transmits.
 */

import type { BaselineScreenId } from "@/lib/performance/baseline/screens"
import type { ScreenMetrics } from "@/lib/performance/baseline/types"

const byScreen = new Map<BaselineScreenId, ScreenMetrics>()

export function upsertScreenMetrics(metrics: ScreenMetrics): void {
  byScreen.set(metrics.screenId, metrics)
}

export function getScreenMetrics(
  screenId: BaselineScreenId
): ScreenMetrics | null {
  return byScreen.get(screenId) ?? null
}

export function listScreenMetrics(): readonly ScreenMetrics[] {
  return [...byScreen.values()]
}

export function clearScreenMetrics(): void {
  byScreen.clear()
}
