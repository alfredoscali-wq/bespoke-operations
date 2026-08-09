/**
 * OPS 2.3B / 2.3C — SummaryService (Asistente de Jornada).
 * Builds the complete crew panel payload. UI only renders.
 */

import type {
  CrewCapacityStatus,
  CrewPlanningSummary,
} from "@/lib/engines/planning/contracts/CrewPlanningSummary"
import {
  calculateCrewCapacity,
  isCrewBaseGpsAvailable,
} from "@/lib/engines/planning/services/CapacityService"
import { validateCrewPlanning } from "@/lib/engines/planning/services/ValidationService"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type SummaryServiceInput = {
  tasks: readonly Task[]
  crew: Pick<
    Crew,
    | "id"
    | "name"
    | "operationalBaseName"
    | "operationalBaseAddress"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
    | "habitualShiftMinutes"
  >
  crews: readonly Pick<Crew, "id" | "name">[]
  availableMinutes: number
  /** OPS 2.1A — planning day for multi-day duration share. */
  planningDate?: string
}

const STATUS_LABEL: Record<CrewCapacityStatus, string> = {
  empty: "⚪ Sin planificación",
  normal: "🟢 Normal",
  high_load: "🟡 Alta carga",
  overloaded: "🔴 Sobrecargada",
}

const RECOMMENDATION: Record<CrewCapacityStatus, string> = {
  empty: "La cuadrilla no posee tareas para esta jornada.",
  normal: "La cuadrilla tiene capacidad disponible para nuevas tareas.",
  high_load: "La jornada está próxima al límite operativo.",
  overloaded: "Se recomienda redistribuir tareas entre cuadrillas.",
}

/**
 * Formats meters as kilometers with one decimal (es-AR comma).
 * Example: 48300 → "48,3 km"
 */
export function formatTravelDistanceKm(meters: number): string {
  const km = Math.max(0, meters) / 1000
  const rounded = Math.round(km * 10) / 10
  const label = rounded.toFixed(1).replace(".", ",")
  return `${label} km`
}

export function buildCrewPlanningSummary(
  input: SummaryServiceInput
): CrewPlanningSummary {
  const capacity = calculateCrewCapacity({
    tasks: input.tasks,
    crew: input.crew,
    crews: input.crews,
    availableMinutes: input.availableMinutes,
    planningDate: input.planningDate,
  })

  const warnings = validateCrewPlanning({
    tasks: input.tasks,
    crew: input.crew,
    crews: input.crews,
    capacity,
  })

  const baseGpsAvailable = isCrewBaseGpsAvailable(input.crew)
  const operationalBaseName =
    input.crew.operationalBaseName?.trim() || "Base Operativa"

  return {
    crewId: input.crew.id,
    crewName: input.crew.name,
    operationalBaseName,
    operationalBaseAddress: input.crew.operationalBaseAddress?.trim() || null,
    taskCount: capacity.taskCount,
    technicalMinutes: capacity.technicalMinutes,
    travelMinutes: capacity.travelMinutes,
    departureMinutes: capacity.departureMinutes,
    returnMinutes: capacity.returnMinutes,
    travelDistanceMeters: capacity.travelDistanceMeters,
    travelDistanceLabel: formatTravelDistanceKm(capacity.travelDistanceMeters),
    totalMinutes: capacity.totalMinutes,
    availableMinutes: capacity.availableMinutes,
    remainingMinutes: capacity.remainingMinutes,
    occupancyPercent: capacity.occupancyPercent,
    status: capacity.status,
    statusLabel: STATUS_LABEL[capacity.status],
    recommendation: RECOMMENDATION[capacity.status],
    warnings,
    baseGpsAvailable,
    configureBaseHref: `/cuadrillas/${input.crew.id}`,
  }
}

export class SummaryService {
  build(input: SummaryServiceInput): CrewPlanningSummary {
    return buildCrewPlanningSummary(input)
  }
}

export const summaryService = new SummaryService()
