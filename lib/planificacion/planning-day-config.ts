/**
 * OPS 2.2 — planning-day operational config (ephemeral overrides).
 * Never persists back onto the crew permanent configuration.
 */

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
  startTime?: string | null
  availableMinutes?: number | null
}

export type PlanningDayOperationalConfig = {
  useHabitual: boolean
  operationalBaseName: string
  startTime: string
  availableMinutes: number
  /** Permanent crew GPS base — for OPS 2.3 routing. */
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

export function readPlanningDayOperationalOverride(
  date: string,
  crewId: string
): PlanningDayOperationalOverride | null {
  const entry = readStore()[dayConfigKey(date, crewId)]
  if (!entry || typeof entry !== "object") {
    return null
  }
  return {
    useHabitual: entry.useHabitual !== false,
    operationalBaseName: entry.operationalBaseName ?? null,
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

/**
 * Resolves effective jornada settings for a crew on a planning day.
 * Override never mutates crew permanent config.
 */
export function resolvePlanningDayOperationalConfig(input: {
  crew: Pick<
    Crew,
    | "operationalBaseName"
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

  if (useHabitual) {
    return {
      useHabitual: true,
      operationalBaseName:
        habitual.baseName?.trim() ||
        habitual.base?.name ||
        "Base Operativa",
      startTime: habitual.startTime,
      availableMinutes: habitual.shiftMinutes,
      operationalBase: resolveCrewOperationalBase(input.crew),
      source: "habitual",
    }
  }

  const startTime =
    override?.startTime?.trim() || habitual.startTime
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

  return {
    useHabitual: false,
    operationalBaseName,
    startTime,
    availableMinutes,
    operationalBase: resolveCrewOperationalBase(input.crew),
    source: "override",
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

  return { ok: true }
}

/** Re-export helpers useful for OPS 2.3 route endpoints. */
export {
  resolveCrewHabitualShiftMinutes,
  resolveCrewHabitualStartTime,
  resolveCrewOperationalBase,
}
