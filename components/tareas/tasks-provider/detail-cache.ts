import type { TaskDetail } from "@/lib/types/tasks"

const detailCache = new Map<string, TaskDetail>()

export function cacheDetail(id: string, detail: TaskDetail) {
  detailCache.set(id, detail)
}

export function getCachedDetail(id: string) {
  return detailCache.get(id)
}

export function hasCachedDetail(id: string) {
  return detailCache.has(id)
}

export function deleteCachedDetail(id: string) {
  detailCache.delete(id)
}

export function clearDetailCache() {
  detailCache.clear()
}
