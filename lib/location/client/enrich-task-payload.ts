import { hasCoordinates } from "@/lib/gps/coordinates"
import { resolveLocationViaApi } from "@/lib/location/client/resolve-via-api"
import type { ResolvedLocation } from "@/lib/location/types"
import type {
  CreateTaskPayload,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string
): string {
  const value = metadata?.[key]
  return typeof value === "string" ? value.trim() : ""
}

function readMetadataNumber(
  metadata: Record<string, unknown> | undefined,
  key: string
): number | null {
  const value = metadata?.[key]
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  return null
}

async function resolveIfNeeded(
  sharedLocation: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  cache: Map<string, ResolvedLocation>
): Promise<ResolvedLocation | null> {
  const trimmed = sharedLocation.trim()
  if (!trimmed) {
    return null
  }

  if (hasCoordinates(latitude, longitude)) {
    return null
  }

  return resolveSharedLocationOnSave(trimmed, cache)
}

async function resolveSharedLocationOnSave(
  sharedLocation: string,
  cache: Map<string, ResolvedLocation>
): Promise<ResolvedLocation | null> {
  const trimmed = sharedLocation.trim()
  if (!trimmed) {
    return null
  }

  const cacheKey = trimmed.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }

  const resolved = await resolveLocationViaApi(trimmed)
  cache.set(cacheKey, resolved)
  return resolved
}

export async function enrichCreateTaskPayloadWithResolvedLocation(
  payload: CreateTaskPayload
): Promise<CreateTaskPayload> {
  const resolutionCache = new Map<string, ResolvedLocation>()
  let nextPayload = { ...payload }
  const metadata = { ...(payload.taskMetadata ?? {}) }

  if (payload.sharedLocation?.trim()) {
    const resolved = await resolveIfNeeded(
      payload.sharedLocation,
      payload.latitude,
      payload.longitude,
      resolutionCache
    )

    if (resolved) {
      nextPayload = {
        ...nextPayload,
        sharedLocation: resolved.normalizedLocation,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        locationResolutionMethod: resolved.resolutionMethod,
      }
    }
  }

  const currentSharedLocation = readMetadataString(metadata, "currentSharedLocation")
  if (currentSharedLocation) {
    const resolved = await resolveIfNeeded(
      currentSharedLocation,
      readMetadataNumber(metadata, "currentLatitude"),
      readMetadataNumber(metadata, "currentLongitude"),
      resolutionCache
    )

    if (resolved) {
      metadata.currentSharedLocation = resolved.normalizedLocation
      metadata.currentLatitude = resolved.latitude
      metadata.currentLongitude = resolved.longitude
      metadata.currentLocationResolutionMethod = resolved.resolutionMethod
    }
  }

  const newSharedLocation = readMetadataString(metadata, "newSharedLocation")
  if (
    newSharedLocation &&
    newSharedLocation.toLowerCase() !==
      (nextPayload.sharedLocation?.trim().toLowerCase() ?? "")
  ) {
    const resolved = await resolveIfNeeded(
      newSharedLocation,
      readMetadataNumber(metadata, "newLatitude"),
      readMetadataNumber(metadata, "newLongitude"),
      resolutionCache
    )

    if (resolved) {
      metadata.newSharedLocation = resolved.normalizedLocation
      metadata.newLatitude = resolved.latitude
      metadata.newLongitude = resolved.longitude
      metadata.newLocationResolutionMethod = resolved.resolutionMethod
    }
  }

  if (Object.keys(metadata).length > 0) {
    nextPayload = {
      ...nextPayload,
      taskMetadata: metadata,
    }
  }

  if (
    nextPayload.sharedLocation?.trim() &&
    !hasCoordinates(nextPayload.latitude, nextPayload.longitude)
  ) {
    throw new Error(
      "No se pudo resolver la ubicación GPS. Verifique el enlace de Google Maps."
    )
  }

  return nextPayload
}

export async function enrichUpdateTaskPayloadWithResolvedLocation(
  payload: UpdateTaskPayload
): Promise<UpdateTaskPayload> {
  const resolutionCache = new Map<string, ResolvedLocation>()
  let nextPayload = { ...payload }
  const metadata =
    payload.taskMetadata !== undefined
      ? { ...payload.taskMetadata }
      : undefined

  if (payload.sharedLocation !== undefined && payload.sharedLocation?.trim()) {
    const resolved = await resolveSharedLocationOnSave(
      payload.sharedLocation,
      resolutionCache
    )

    if (resolved) {
      nextPayload = {
        ...nextPayload,
        sharedLocation: resolved.normalizedLocation,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        locationResolutionMethod: resolved.resolutionMethod,
      }
    } else if (
      payload.sharedLocation.trim() &&
      !hasCoordinates(payload.latitude, payload.longitude)
    ) {
      throw new Error(
        "No se pudo resolver la ubicación GPS. Verifique el enlace de Google Maps."
      )
    }
  }

  if (metadata) {
    const currentSharedLocation = readMetadataString(
      metadata,
      "currentSharedLocation"
    )
    if (currentSharedLocation) {
      const resolved = await resolveIfNeeded(
        currentSharedLocation,
        readMetadataNumber(metadata, "currentLatitude"),
        readMetadataNumber(metadata, "currentLongitude"),
        resolutionCache
      )

      if (resolved) {
        metadata.currentSharedLocation = resolved.normalizedLocation
        metadata.currentLatitude = resolved.latitude
        metadata.currentLongitude = resolved.longitude
        metadata.currentLocationResolutionMethod = resolved.resolutionMethod
      }
    }

    const newSharedLocation = readMetadataString(metadata, "newSharedLocation")
    if (newSharedLocation) {
      const resolved = await resolveIfNeeded(
        newSharedLocation,
        readMetadataNumber(metadata, "newLatitude"),
        readMetadataNumber(metadata, "newLongitude"),
        resolutionCache
      )

      if (resolved) {
        metadata.newSharedLocation = resolved.normalizedLocation
        metadata.newLatitude = resolved.latitude
        metadata.newLongitude = resolved.longitude
        metadata.newLocationResolutionMethod = resolved.resolutionMethod
        nextPayload = {
          ...nextPayload,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          locationResolutionMethod: resolved.resolutionMethod,
          taskMetadata: metadata,
        }
      }
    }

    if (nextPayload.taskMetadata !== metadata) {
      nextPayload = {
        ...nextPayload,
        taskMetadata: metadata,
      }
    }
  }

  return nextPayload
}
