/**
 * OPS 2.2 / 2.3C — planning-day operational config (ephemeral overrides).
 * Never persists back onto the crew permanent configuration.
 */

import { hasCoordinates } from "@/lib/gps"
import {
  resolveCrewHabitualShiftMinutes,
  resolveCrewHabitualStartTime,
  resolveCrewOperationalBase,
  resolveCrewOperationalConfig,
  type CrewOperationalBase,
} from "@/lib/crews/operational-config"
import { PLANNING_DEFAULT_AVAILABLE_MINUTES } from "@/lib/planificacion/planning-duration"
import type { Crew } from "@/lib/types/crews"

export type PlanningDayOperationalOverride = {
  useHabitual: boolean
  operationalBaseName?: string | null
  operationalBaseAddress?: string | null
  operationalBaseLatitude?: number | null
  operationalBaseLongitude?: number | null
  startTime?: string | null
  availableMinutes?: number | null
}

export type PlanningDayOperationalConfig = {
  useHabitual: boolean
  operationalBaseName: string
  operationalBaseAddress: string | null
  startTime: string
  availableMinutes: number
  /** Effective base for this jornada (habitual or day override GPS). */
  operationalBase: CrewOperationalBase | null
  source: "habitual" | "override"
}

const PLANNING_DAY_CONFIG_SESSION_KEY = "bespoke.planning.day-operational-config"

type PlanningDayConfigStore = Record<string, PlanningDayOperationalOverride>

function dayConfigKey(date: string, crewId: string): string {
  return `${date}:${crewId}`
}

function readStore(): PlanningDayConfigStore {
  if (typeof window === "undefined") {
    return {}
  }
  try {
    const raw = window.sessionStorage.getItem(PLANNING_DAY_CONFIG_SESSION_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as PlanningDayConfigStore
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: PlanningDayConfigStore): void {
  if (typeof window === "undefined") {
    return
  }
  try {
    window.sessionStorage.setItem(
      PLANNING_DAY_CONFIG_SESSION_KEY,
      JSON.stringify(store)
    )
  } catch {
    // Ignore quota / privacy errors.
  }
}

function readOverrideCoords(entry: PlanningDayOperationalOverride): {
  latitude: number | null
  longitude: number | null
} {
  const latitude =
    typeof entry.operationalBaseLatitude === "number" &&
    Number.isFinite(entry.operationalBaseLatitude)
      ? entry.operationalBaseLatitude
      : null
  const longitude =
    typeof entry.operationalBaseLongitude === "number" &&
    Number.isFinite(entry.operationalBaseLongitude)
      ? entry.operationalBaseLongitude
      : null
  return { latitude, longitude }
}

export function readPlanningDayOperationalOverride(
  date: string,
  crewId: string
): PlanningDayOperationalOverride | null {
  const entry = readStore()[dayConfigKey(date, crewId)]
  if (!entry || typeof entry !== "object") {
    return null
  }
  const coords = readOverrideCoords(entry)
  return {
    useHabitual: entry.useHabitual !== false,
    operationalBaseName: entry.operationalBaseName ?? null,
    operationalBaseAddress: entry.operationalBaseAddress ?? null,
    operationalBaseLatitude: coords.latitude,
    operationalBaseLongitude: coords.longitude,
    startTime: entry.startTime ?? null,
    availableMinutes:
      typeof entry.availableMinutes === "number"
        ? entry.availableMinutes
        : null,
  }
}

export function writePlanningDayOperationalOverride(
  date: string,
  crewId: string,
  override: PlanningDayOperationalOverride
): void {
  const store = readStore()
  store[dayConfigKey(date, crewId)] = {
    useHabitual: override.useHabitual,
    operationalBaseName: override.operationalBaseName ?? null,
    operationalBaseAddress: override.operationalBaseAddress ?? null,
    operationalBaseLatitude:
      typeof override.operationalBaseLatitude === "number"
        ? override.operationalBaseLatitude
        : null,
    operationalBaseLongitude:
      typeof override.operationalBaseLongitude === "number"
        ? override.operationalBaseLongitude
        : null,
    startTime: override.startTime ?? null,
    availableMinutes:
      typeof override.availableMinutes === "number" &&
      override.availableMinutes > 0
        ? Math.round(override.availableMinutes)
        : null,
  }
  writeStore(store)
}

export function clearPlanningDayOperationalOverride(
  date: string,
  crewId: string
): void {
  const store = readStore()
  delete store[dayConfigKey(date, crewId)]
  writeStore(store)
}

function resolveOverrideOperationalBase(input: {
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  fallback: CrewOperationalBase | null
}): CrewOperationalBase | null {
  if (
    hasCoordinates(input.latitude, input.longitude) &&
    input.latitude != null &&
    input.longitude != null &&
    input.name.trim()
  ) {
    return {
      name: input.name.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
    }
  }
  if (input.fallback) {
    return {
      ...input.fallback,
      name: input.name.trim() || input.fallback.name,
    }
  }
  return null
}

/**
 * Resolves effective jornada settings for a crew on a planning day.
 * Override never mutates crew permanent config.
 */
export function resolvePlanningDayOperationalConfig(input: {
  crew: Pick<
    Crew,
    | "operationalBaseName"
    | "operationalBaseAddress"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
    | "habitualStartTime"
    | "habitualShiftMinutes"
  >
  override?: PlanningDayOperationalOverride | null
}): PlanningDayOperationalConfig {
  const habitual = resolveCrewOperationalConfig(input.crew)
  const override = input.override
  const useHabitual = override == null || override.useHabitual !== false
  const habitualBase = resolveCrewOperationalBase(input.crew)

  if (useHabitual) {
    return {
      useHabitual: true,
      operationalBaseName:
        habitual.baseName?.trim() ||
        habitual.base?.name ||
        "Base Operativa",
      operationalBaseAddress:
        input.crew.operationalBaseAddress?.trim() || null,
      startTime: habitual.startTime,
      availableMinutes: habitual.shiftMinutes,
      operationalBase: habitualBase,
      source: "habitual",
    }
  }

  const startTime = override?.startTime?.trim() || habitual.startTime
  const availableMinutes =
    typeof override?.availableMinutes === "number" &&
    override.availableMinutes > 0
      ? Math.round(override.availableMinutes)
      : habitual.shiftMinutes
  const operationalBaseName =
    override?.operationalBaseName?.trim() ||
    habitual.baseName?.trim() ||
    habitual.base?.name ||
    "Base Operativa"
  const operationalBaseAddress =
    override?.operationalBaseAddress?.trim() ||
    input.crew.operationalBaseAddress?.trim() ||
    null

  return {
    useHabitual: false,
    operationalBaseName,
    operationalBaseAddress,
    startTime,
    availableMinutes,
    operationalBase: resolveOverrideOperationalBase({
      name: operationalBaseName,
      address: operationalBaseAddress,
      latitude: override?.operationalBaseLatitude ?? null,
      longitude: override?.operationalBaseLongitude ?? null,
      fallback: habitualBase,
    }),
    source: "override",
  }
}

/**
 * Returns a crew-shaped pick with effective base fields for Route/Summary.
 */
export function applyDayOperationalBaseToCrew<
  T extends Pick<
    Crew,
    | "id"
    | "name"
    | "operationalBaseName"
    | "operationalBaseAddress"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
    | "habitualShiftMinutes"
  >,
>(crew: T, dayConfig: PlanningDayOperationalConfig): T {
  const base = dayConfig.operationalBase
  return {
    ...crew,
    operationalBaseName: dayConfig.operationalBaseName,
    operationalBaseAddress: dayConfig.operationalBaseAddress,
    operationalBaseLatitude: base?.latitude ?? null,
    operationalBaseLongitude: base?.longitude ?? null,
  }
}

export function resolveAvailableMinutesFromCrews(
  crews: readonly Pick<Crew, "habitualShiftMinutes">[]
): number {
  if (crews.length === 0) {
    return PLANNING_DEFAULT_AVAILABLE_MINUTES
  }
  if (crews.length === 1) {
    return resolveCrewHabitualShiftMinutes(crews[0])
  }
  return crews.reduce(
    (sum, crew) => sum + resolveCrewHabitualShiftMinutes(crew),
    0
  )
}

export function validatePlanningDayOperationalOverride(
  override: PlanningDayOperationalOverride
): { ok: true } | { ok: false; message: string } {
  if (override.useHabitual) {
    return { ok: true }
  }

  if (
    override.availableMinutes != null &&
    (!(typeof override.availableMinutes === "number") ||
      !Number.isFinite(override.availableMinutes) ||
      override.availableMinutes <= 0)
  ) {
    return {
      ok: false,
      message: "La duración de la jornada debe ser mayor a cero.",
    }
  }

  if (override.startTime?.trim()) {
    const match = override.startTime.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (!match) {
      return {
        ok: false,
        message: "La hora de inicio no es válida (formato HH:MM).",
      }
    }
  }

  const hasLat = override.operationalBaseLatitude != null
  const hasLng = override.operationalBaseLongitude != null
  if (hasLat !== hasLng) {
    return {
      ok: false,
      message: "La Base Operativa del día requiere latitud y longitud.",
    }
  }
  if (
    hasLat &&
    hasLng &&
    !hasCoordinates(
      override.operationalBaseLatitude,
      override.operationalBaseLongitude
    )
  ) {
    return {
      ok: false,
      message: "Las coordenadas de la Base Operativa del día no son válidas.",
    }
  }

  return { ok: true }
}

/** Re-export helpers useful for OPS 2.3 route endpoints. */
export {
  resolveCrewHabitualShiftMinutes,
  resolveCrewHabitualStartTime,
  resolveCrewOperationalBase,
}
