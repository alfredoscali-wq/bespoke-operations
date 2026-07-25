/**
 * Planning travel persistence helpers (task_metadata).
 * No Supabase client — pure mapping for OPS 2.3A.
 */

import type {
  RouteCoordinate,
  TravelSource,
} from "@/lib/engines/planning/contracts/RouteRequest"
import {
  PLANNING_RETURN_TO_BASE_KEY,
  PLANNING_TRAVEL_FROM_PREVIOUS_KEY,
} from "@/lib/planificacion/planning-travel"

export const TRAVEL_DISTANCE_FROM_PREVIOUS_KEY =
  "travel_from_previous_distance_meters" as const
export const TRAVEL_SOURCE_FROM_PREVIOUS_KEY =
  "travel_from_previous_source" as const
export const TRAVEL_ENDPOINTS_FROM_PREVIOUS_KEY =
  "travel_from_previous_endpoints" as const

export const RETURN_DISTANCE_KEY = "return_to_base_distance_meters" as const
export const RETURN_SOURCE_KEY = "return_to_base_source" as const
export const RETURN_ENDPOINTS_KEY = "return_to_base_endpoints" as const

export type PersistedTravelLeg = {
  minutes: number
  distanceMeters: number
  source: TravelSource
  endpointsKey: string | null
}

function readNonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed)
    }
  }
  return 0
}

function readSource(value: unknown): TravelSource | null {
  if (value === "MANUAL" || value === "AUTOMATIC") {
    return value
  }
  return null
}

export function buildTravelEndpointsKey(
  origin: RouteCoordinate,
  destination: RouteCoordinate
): string {
  const round = (n: number) => (Math.round(n * 1e5) / 1e5).toFixed(5)
  return `${round(origin.latitude)},${round(origin.longitude)}|${round(destination.latitude)},${round(destination.longitude)}`
}

export class PlanningRepository {
  readTravelFromPrevious(
    metadata: Record<string, unknown> | undefined
  ): PersistedTravelLeg {
    const minutes = readNonNegativeInt(
      metadata?.[PLANNING_TRAVEL_FROM_PREVIOUS_KEY]
    )
    return {
      minutes,
      distanceMeters: readNonNegativeInt(
        metadata?.[TRAVEL_DISTANCE_FROM_PREVIOUS_KEY]
      ),
      // OPS 2.1 minutes without source are treated as MANUAL to preserve edits.
      source:
        readSource(metadata?.[TRAVEL_SOURCE_FROM_PREVIOUS_KEY]) ??
        (minutes > 0 ? "MANUAL" : "AUTOMATIC"),
      endpointsKey:
        typeof metadata?.[TRAVEL_ENDPOINTS_FROM_PREVIOUS_KEY] === "string"
          ? (metadata[TRAVEL_ENDPOINTS_FROM_PREVIOUS_KEY] as string)
          : null,
    }
  }

  readReturnToBase(
    metadata: Record<string, unknown> | undefined
  ): PersistedTravelLeg {
    const minutes = readNonNegativeInt(metadata?.[PLANNING_RETURN_TO_BASE_KEY])
    return {
      minutes,
      distanceMeters: readNonNegativeInt(metadata?.[RETURN_DISTANCE_KEY]),
      source:
        readSource(metadata?.[RETURN_SOURCE_KEY]) ??
        (minutes > 0 ? "MANUAL" : "AUTOMATIC"),
      endpointsKey:
        typeof metadata?.[RETURN_ENDPOINTS_KEY] === "string"
          ? (metadata[RETURN_ENDPOINTS_KEY] as string)
          : null,
    }
  }

  /**
   * Skip provider when endpoints already match (MANUAL or AUTOMATIC).
   * Legacy MANUAL without fingerprint is skipped so we can stamp endpoints
   * without overwriting supervisor minutes; endpoint change later invalidates.
   */
  shouldSkipRecalc(
    existing: PersistedTravelLeg,
    endpointsKey: string
  ): boolean {
    if (
      existing.endpointsKey != null &&
      existing.endpointsKey === endpointsKey
    ) {
      return true
    }
    return (
      existing.source === "MANUAL" &&
      existing.endpointsKey == null &&
      existing.minutes > 0
    )
  }

  mergeTravelFromPrevious(
    metadata: Record<string, unknown> | undefined,
    input: {
      minutes: number
      distanceMeters: number
      source: TravelSource
      origin: RouteCoordinate
      destination: RouteCoordinate
    }
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      [PLANNING_TRAVEL_FROM_PREVIOUS_KEY]: Math.max(0, Math.round(input.minutes)),
      [TRAVEL_DISTANCE_FROM_PREVIOUS_KEY]: Math.max(
        0,
        Math.round(input.distanceMeters)
      ),
      [TRAVEL_SOURCE_FROM_PREVIOUS_KEY]: input.source,
      [TRAVEL_ENDPOINTS_FROM_PREVIOUS_KEY]: buildTravelEndpointsKey(
        input.origin,
        input.destination
      ),
    }
  }

  /**
   * MANUAL minutes without endpoint fingerprint (e.g. Base→OT when base GPS missing).
   * OPS 2.3A.1 — never block supervisor edits for missing base GPS.
   */
  mergeTravelFromPreviousMinutesOnly(
    metadata: Record<string, unknown> | undefined,
    input: { minutes: number; distanceMeters?: number }
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {
      ...(metadata ?? {}),
      [PLANNING_TRAVEL_FROM_PREVIOUS_KEY]: Math.max(0, Math.round(input.minutes)),
      [TRAVEL_SOURCE_FROM_PREVIOUS_KEY]: "MANUAL" as TravelSource,
      [TRAVEL_DISTANCE_FROM_PREVIOUS_KEY]: Math.max(
        0,
        Math.round(input.distanceMeters ?? 0)
      ),
    }
    delete next[TRAVEL_ENDPOINTS_FROM_PREVIOUS_KEY]
    return next
  }

  mergeReturnToBase(
    metadata: Record<string, unknown> | undefined,
    input: {
      minutes: number
      distanceMeters: number
      source: TravelSource
      origin: RouteCoordinate
      destination: RouteCoordinate
    }
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      [PLANNING_RETURN_TO_BASE_KEY]: Math.max(0, Math.round(input.minutes)),
      [RETURN_DISTANCE_KEY]: Math.max(0, Math.round(input.distanceMeters)),
      [RETURN_SOURCE_KEY]: input.source,
      [RETURN_ENDPOINTS_KEY]: buildTravelEndpointsKey(
        input.origin,
        input.destination
      ),
    }
  }

  /** MANUAL return minutes when base GPS is unavailable (OPS 2.3A.1). */
  mergeReturnToBaseMinutesOnly(
    metadata: Record<string, unknown> | undefined,
    input: { minutes: number; distanceMeters?: number }
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {
      ...(metadata ?? {}),
      [PLANNING_RETURN_TO_BASE_KEY]: Math.max(0, Math.round(input.minutes)),
      [RETURN_SOURCE_KEY]: "MANUAL" as TravelSource,
      [RETURN_DISTANCE_KEY]: Math.max(
        0,
        Math.round(input.distanceMeters ?? 0)
      ),
    }
    delete next[RETURN_ENDPOINTS_KEY]
    return next
  }

  clearReturnToBase(
    metadata: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const next = { ...(metadata ?? {}) }
    delete next[PLANNING_RETURN_TO_BASE_KEY]
    delete next[RETURN_DISTANCE_KEY]
    delete next[RETURN_SOURCE_KEY]
    delete next[RETURN_ENDPOINTS_KEY]
    return next
  }
}

export const planningRepository = new PlanningRepository()
