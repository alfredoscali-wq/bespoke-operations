import type {
  RouteRequest,
  RouteResult,
} from "@/lib/engines/planning/contracts/RouteRequest"
import {
  MemoryRouteCache,
  sharedMemoryRouteCache,
} from "@/lib/engines/planning/cache/MemoryRouteCache"
import { OpenRouteServiceProvider } from "@/lib/engines/planning/providers/OpenRouteServiceProvider"
import type { RouteProvider } from "@/lib/engines/planning/providers/RouteProvider"
import { isValidRouteCoordinate } from "@/lib/engines/planning/providers/RouteProvider"

function logRoute(event: string, details: Record<string, unknown>): void {
  console.info("[planning/route]", event, details)
}

export type RouteServiceOptions = {
  provider?: RouteProvider
  cache?: MemoryRouteCache
}

/**
 * Single entry point for route lookups. No Supabase. No React.
 */
export class RouteService {
  private readonly provider: RouteProvider
  private readonly cache: MemoryRouteCache

  constructor(options: RouteServiceOptions = {}) {
    this.provider = options.provider ?? new OpenRouteServiceProvider()
    this.cache = options.cache ?? sharedMemoryRouteCache
  }

  async getRoute(request: RouteRequest): Promise<RouteResult> {
    if (
      !isValidRouteCoordinate(request.origin) ||
      !isValidRouteCoordinate(request.destination)
    ) {
      const invalid: RouteResult = {
        minutes: 0,
        distanceMeters: 0,
        provider: this.provider.name,
        status: "invalid_coordinates",
        cacheHit: false,
        responseTimeMs: 0,
        message: "Coordenadas inválidas.",
      }
      logRoute("invalid_coordinates", {
        requestId: request.requestId,
        status: invalid.status,
      })
      return invalid
    }

    const cached = this.cache.get(request.origin, request.destination)
    if (cached) {
      logRoute("cache_hit", {
        requestId: request.requestId,
        provider: cached.provider,
        minutes: cached.minutes,
      })
      return cached
    }

    logRoute("cache_miss", {
      requestId: request.requestId,
      provider: this.provider.name,
    })

    const result = await this.provider.getRoute(request)

    logRoute("provider_result", {
      requestId: request.requestId,
      provider: result.provider,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      minutes: result.minutes,
      distanceMeters: result.distanceMeters,
      message: result.message,
    })

    if (result.status === "ok") {
      this.cache.set(request.origin, request.destination, result)
    }

    return result
  }
}

let sharedRouteService: RouteService | null = null

export function getSharedRouteService(): RouteService {
  if (!sharedRouteService) {
    sharedRouteService = new RouteService()
  }
  return sharedRouteService
}

/** Test helper — reset singleton. */
export function resetSharedRouteServiceForTests(): void {
  sharedRouteService = null
  sharedMemoryRouteCache.clear()
}
