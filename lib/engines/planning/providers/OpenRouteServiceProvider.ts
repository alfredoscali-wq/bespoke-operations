import type {
  RouteRequest,
  RouteResult,
} from "@/lib/engines/planning/contracts/RouteRequest"
import type { RouteProvider } from "@/lib/engines/planning/providers/RouteProvider"
import { isValidRouteCoordinate } from "@/lib/engines/planning/providers/RouteProvider"

const DEFAULT_TIMEOUT_MS = 8_000
const ORS_DIRECTIONS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car"

type OrsDirectionsResponse = {
  routes?: Array<{
    summary?: {
      duration?: number
      distance?: number
    }
  }>
  error?: {
    code?: number
    message?: string
  }
}

export type OpenRouteServiceProviderOptions = {
  apiKey?: string | null
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * OpenRouteService adapter. Never returns raw provider payloads.
 */
export class OpenRouteServiceProvider implements RouteProvider {
  readonly name = "openrouteservice" as const
  private readonly apiKey: string | null
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: OpenRouteServiceProviderOptions = {}) {
    this.apiKey =
      options.apiKey?.trim() ||
      process.env.OPENROUTESERVICE_API_KEY?.trim() ||
      null
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async getRoute(request: RouteRequest): Promise<RouteResult> {
    const started = Date.now()

    if (
      !isValidRouteCoordinate(request.origin) ||
      !isValidRouteCoordinate(request.destination)
    ) {
      return {
        minutes: 0,
        distanceMeters: 0,
        provider: this.name,
        status: "invalid_coordinates",
        cacheHit: false,
        responseTimeMs: Date.now() - started,
        message: "Coordenadas inválidas.",
      }
    }

    if (!this.apiKey) {
      return {
        minutes: 0,
        distanceMeters: 0,
        provider: this.name,
        status: "unavailable",
        cacheHit: false,
        responseTimeMs: Date.now() - started,
        message: "OPENROUTESERVICE_API_KEY no configurada.",
      }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImpl(ORS_DIRECTIONS_URL, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [request.origin.longitude, request.origin.latitude],
            [request.destination.longitude, request.destination.latitude],
          ],
          units: "m",
        }),
        signal: controller.signal,
      })

      const responseTimeMs = Date.now() - started

      if (response.status === 429) {
        return {
          minutes: 0,
          distanceMeters: 0,
          provider: this.name,
          status: "rate_limited",
          cacheHit: false,
          responseTimeMs,
          message: "Límite de uso de OpenRouteService alcanzado.",
        }
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        return {
          minutes: 0,
          distanceMeters: 0,
          provider: this.name,
          status: "error",
          cacheHit: false,
          responseTimeMs,
          message: text.slice(0, 200) || `HTTP ${response.status}`,
        }
      }

      const payload = (await response.json()) as OrsDirectionsResponse
      const summary = payload.routes?.[0]?.summary
      const durationSeconds = summary?.duration
      const distanceMeters = summary?.distance

      if (
        typeof durationSeconds !== "number" ||
        !Number.isFinite(durationSeconds) ||
        typeof distanceMeters !== "number" ||
        !Number.isFinite(distanceMeters)
      ) {
        return {
          minutes: 0,
          distanceMeters: 0,
          provider: this.name,
          status: "error",
          cacheHit: false,
          responseTimeMs,
          message: "Respuesta ORS sin summary usable.",
        }
      }

      return {
        minutes: Math.max(0, Math.round(durationSeconds / 60)),
        distanceMeters: Math.max(0, Math.round(distanceMeters)),
        provider: this.name,
        status: "ok",
        cacheHit: false,
        responseTimeMs,
      }
    } catch (error) {
      const responseTimeMs = Date.now() - started
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || /aborted/i.test(error.message))

      return {
        minutes: 0,
        distanceMeters: 0,
        provider: this.name,
        status: aborted ? "timeout" : "error",
        cacheHit: false,
        responseTimeMs,
        message:
          error instanceof Error ? error.message : "Error desconocido ORS.",
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
