import type {
  RouteCoordinate,
  RouteResult,
} from "@/lib/engines/planning/contracts/RouteRequest"

type CacheEntry = {
  result: RouteResult
  expiresAt: number
}

const DEFAULT_TTL_MS = 30 * 60 * 1000

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5
}

export function buildRouteCacheKey(
  origin: RouteCoordinate,
  destination: RouteCoordinate
): string {
  return [
    roundCoord(origin.latitude),
    roundCoord(origin.longitude),
    roundCoord(destination.latitude),
    roundCoord(destination.longitude),
  ].join("|")
}

/**
 * In-memory route cache (process lifetime). Not persisted.
 */
export class MemoryRouteCache {
  private readonly store = new Map<string, CacheEntry>()
  private readonly ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  get(
    origin: RouteCoordinate,
    destination: RouteCoordinate
  ): RouteResult | null {
    const key = buildRouteCacheKey(origin, destination)
    const entry = this.store.get(key)
    if (!entry) {
      return null
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return {
      ...entry.result,
      cacheHit: true,
      responseTimeMs: 0,
    }
  }

  set(
    origin: RouteCoordinate,
    destination: RouteCoordinate,
    result: RouteResult
  ): void {
    if (result.status !== "ok") {
      return
    }
    const key = buildRouteCacheKey(origin, destination)
    this.store.set(key, {
      result: { ...result, cacheHit: false },
      expiresAt: Date.now() + this.ttlMs,
    })
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

/** Shared server-process cache. */
export const sharedMemoryRouteCache = new MemoryRouteCache()
