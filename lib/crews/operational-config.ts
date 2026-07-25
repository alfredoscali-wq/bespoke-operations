/**
 * OPS 2.2 — crew permanent operational configuration.
 * Planning may read these defaults; never write them from day overrides.
 */

import { hasCoordinates } from "@/lib/gps"
import { PLANNING_DEFAULT_AVAILABLE_MINUTES } from "@/lib/planificacion/planning-duration"
import type { Crew } from "@/lib/types/crews"

export const CREW_DEFAULT_HABITUAL_START_TIME = "08:00"

export type CrewOperationalBase = {
  name: string
  latitude: number
  longitude: number
}

export type CrewOperationalConfig = {
  baseName: string | null
  latitude: number | null
  longitude: number | null
  startTime: string
  shiftMinutes: number
  /** Ready for OPS 2.3 routing when name + coords are present. */
  base: CrewOperationalBase | null
}

export type CrewOperationalConfigInput = {
  operationalBaseName?: string | null
  operationalBaseLatitude?: number | null
  operationalBaseLongitude?: number | null
  habitualStartTime?: string | null
  habitualShiftMinutes?: number | null
}

function normalizeTimeInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) {
    return null
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function formatHabitualStartTimeForInput(
  value: string | null | undefined
): string {
  return normalizeTimeInput(value) ?? ""
}

export function formatHabitualStartTimeForDb(
  value: string | null | undefined
): string | null {
  const normalized = normalizeTimeInput(value)
  return normalized ? `${normalized}:00` : null
}

export function resolveCrewHabitualStartTime(
  crew: Pick<Crew, "habitualStartTime">
): string {
  return (
    normalizeTimeInput(crew.habitualStartTime) ?? CREW_DEFAULT_HABITUAL_START_TIME
  )
}

export function resolveCrewHabitualShiftMinutes(
  crew: Pick<Crew, "habitualShiftMinutes">
): number {
  const value = crew.habitualShiftMinutes
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }
  return PLANNING_DEFAULT_AVAILABLE_MINUTES
}

export function resolveCrewOperationalBase(
  crew: Pick<
    Crew,
    | "operationalBaseName"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
  >
): CrewOperationalBase | null {
  const name = crew.operationalBaseName?.trim() ?? ""
  const latitude = crew.operationalBaseLatitude
  const longitude = crew.operationalBaseLongitude

  if (
    !name ||
    !hasCoordinates(latitude, longitude) ||
    latitude == null ||
    longitude == null
  ) {
    return null
  }

  return {
    name,
    latitude,
    longitude,
  }
}

export function resolveCrewOperationalConfig(
  crew: Pick<
    Crew,
    | "operationalBaseName"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
    | "habitualStartTime"
    | "habitualShiftMinutes"
  >
): CrewOperationalConfig {
  const base = resolveCrewOperationalBase(crew)
  return {
    baseName: crew.operationalBaseName?.trim() || null,
    latitude: crew.operationalBaseLatitude ?? null,
    longitude: crew.operationalBaseLongitude ?? null,
    startTime: resolveCrewHabitualStartTime(crew),
    shiftMinutes: resolveCrewHabitualShiftMinutes(crew),
    base,
  }
}

/**
 * Validates permanent crew operational config before save.
 * Empty config is allowed; partial base (name without GPS) is not.
 */
export function validateCrewOperationalConfigInput(
  input: CrewOperationalConfigInput
): { ok: true } | { ok: false; message: string } {
  const name = input.operationalBaseName?.trim() ?? ""
  const lat = input.operationalBaseLatitude
  const lng = input.operationalBaseLongitude
  const hasName = Boolean(name)
  const hasLat = lat != null && Number.isFinite(lat)
  const hasLng = lng != null && Number.isFinite(lng)

  if (hasName || hasLat || hasLng) {
    if (!hasName) {
      return {
        ok: false,
        message: "Indicá el nombre de la Base Operativa.",
      }
    }
    if (!hasLat || !hasLng) {
      return {
        ok: false,
        message: "La Base Operativa requiere latitud y longitud GPS.",
      }
    }
    if (!hasCoordinates(lat, lng)) {
      return {
        ok: false,
        message: "Las coordenadas de la Base Operativa no son válidas.",
      }
    }
  }

  if (input.habitualStartTime != null && input.habitualStartTime.trim()) {
    if (!normalizeTimeInput(input.habitualStartTime)) {
      return {
        ok: false,
        message: "La hora habitual de inicio no es válida (formato HH:MM).",
      }
    }
  }

  if (input.habitualShiftMinutes != null) {
    const minutes = Number(input.habitualShiftMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return {
        ok: false,
        message: "La duración habitual de jornada debe ser mayor a cero.",
      }
    }
  }

  return { ok: true }
}
