/**
 * OPS 2.3B — ValidationService.
 * Non-blocking operational warnings only.
 */

import type {
  CrewCapacity,
  PlanningWarning,
} from "@/lib/engines/planning/contracts/CrewPlanningSummary"
import { isCrewBaseGpsAvailable } from "@/lib/engines/planning/services/CapacityService"
import {
  PLANNING_RETURN_TO_BASE_KEY,
  PLANNING_TRAVEL_FROM_PREVIOUS_KEY,
  listOrderedTasksForCrewJourney,
} from "@/lib/planificacion/planning-travel"
import { resolveTaskPlanningCoordinates } from "@/lib/planificacion/planning-utils"
import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type ValidationServiceInput = {
  tasks: readonly Task[]
  crew: Pick<
    Crew,
    | "id"
    | "name"
    | "operationalBaseName"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
  >
  crews: readonly Pick<Crew, "id" | "name">[]
  capacity: CrewCapacity
}

function readRawNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim())
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

/**
 * Collects advisory warnings. Never blocks planning.
 */
export function validateCrewPlanning(
  input: ValidationServiceInput
): PlanningWarning[] {
  const warnings: PlanningWarning[] = []
  const ordered = listOrderedTasksForCrewJourney(
    [...input.tasks],
    input.crew.id,
    [...input.crews]
  )

  if (!isCrewBaseGpsAvailable(input.crew)) {
    warnings.push({
      code: "MISSING_BASE_GPS",
      severity: "warning",
      message:
        "La Base Operativa de esta cuadrilla no posee coordenadas GPS.",
    })
  }

  if (ordered.length === 0) {
    warnings.push({
      code: "NO_TASKS",
      severity: "info",
      message: "La cuadrilla no posee tareas para esta jornada.",
    })
  }

  const withoutGps = ordered.filter(
    (task) => resolveTaskPlanningCoordinates(task) == null
  )
  if (withoutGps.length > 0) {
    warnings.push({
      code: "TASK_MISSING_GPS",
      severity: "warning",
      message:
        withoutGps.length === 1
          ? "Hay 1 OT sin coordenadas GPS."
          : `Hay ${withoutGps.length} OT sin coordenadas GPS.`,
    })
  }

  if (input.capacity.status === "overloaded") {
    warnings.push({
      code: "JOURNEY_EXCEEDED",
      severity: "warning",
      message: `La jornada supera la capacidad disponible en ${input.capacity.overtimeMinutes} minutos.`,
    })
  }

  let hasNegativeTravel = false
  for (const task of ordered) {
    const travel = readRawNumber(
      task.taskMetadata?.[PLANNING_TRAVEL_FROM_PREVIOUS_KEY]
    )
    const ret = readRawNumber(task.taskMetadata?.[PLANNING_RETURN_TO_BASE_KEY])
    if ((travel != null && travel < 0) || (ret != null && ret < 0)) {
      hasNegativeTravel = true
      break
    }
  }
  if (hasNegativeTravel) {
    warnings.push({
      code: "NEGATIVE_TRAVEL",
      severity: "warning",
      message: "Hay tiempos de traslado con valores negativos.",
    })
  }

  const inconsistent = ordered.filter((task) => {
    const raw = task.estimatedDuration?.trim() ?? ""
    if (!raw) {
      return false
    }
    return parseEstimatedDurationMinutes(task.estimatedDuration) <= 0
  })
  if (inconsistent.length > 0) {
    warnings.push({
      code: "INCONSISTENT_DURATION",
      severity: "warning",
      message:
        inconsistent.length === 1
          ? "Hay 1 OT con duración estimada inconsistente."
          : `Hay ${inconsistent.length} OT con duración estimada inconsistente.`,
    })
  }

  return warnings
}

export class ValidationService {
  validate(input: ValidationServiceInput): PlanningWarning[] {
    return validateCrewPlanning(input)
  }
}

export const validationService = new ValidationService()
