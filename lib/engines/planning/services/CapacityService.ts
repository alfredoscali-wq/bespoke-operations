/**
 * OPS 2.3B — CapacityService.
 * Pure planning math. No React. No Supabase.
 */

import type {
  CrewCapacity,
  CrewCapacityStatus,
} from "@/lib/engines/planning/contracts/CrewPlanningSummary"
import { planningRepository } from "@/lib/engines/planning/repositories/PlanningRepository"
import { resolveCrewOperationalBase } from "@/lib/crews/operational-config"
import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"
import { resolvePlanningDayDurationMinutes } from "@/lib/planificacion/planning-date-range"
import {
  listOrderedTasksForCrewJourney,
  resolveReturnToBaseMinutes,
  resolveTravelFromPreviousMinutes,
  sumTravelMinutesForOrderedTasks,
} from "@/lib/planificacion/planning-travel"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

const HIGH_LOAD_THRESHOLD = 85

export type CapacityServiceInput = {
  tasks: readonly Task[]
  crew: Pick<
    Crew,
    | "id"
    | "name"
    | "operationalBaseName"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
    | "habitualShiftMinutes"
  >
  crews: readonly Pick<Crew, "id" | "name">[]
  /** Effective jornada capacity (habitual or day override). */
  availableMinutes: number
  /** OPS 2.1A — when set, technical load uses daily duration share. */
  planningDate?: string
}

function resolveStatus(
  taskCount: number,
  occupancyPercent: number
): CrewCapacityStatus {
  if (taskCount === 0) {
    return "empty"
  }
  if (occupancyPercent > 100) {
    return "overloaded"
  }
  if (occupancyPercent >= HIGH_LOAD_THRESHOLD) {
    return "high_load"
  }
  return "normal"
}

function sumTechnicalMinutes(
  tasks: readonly Task[],
  planningDate?: string
): number {
  if (planningDate?.trim()) {
    const date = planningDate.trim()
    return tasks.reduce(
      (sum, task) => sum + resolvePlanningDayDurationMinutes(task, date),
      0
    )
  }

  return tasks.reduce(
    (sum, task) => sum + parseEstimatedDurationMinutes(task.estimatedDuration),
    0
  )
}

function sumTravelDistanceMeters(
  ordered: readonly Pick<Task, "id" | "taskMetadata">[]
): number {
  if (ordered.length === 0) {
    return 0
  }

  let total = 0
  for (const task of ordered) {
    total += planningRepository.readTravelFromPrevious(task.taskMetadata)
      .distanceMeters
  }

  const last = ordered[ordered.length - 1]
  // Prefer return distance on the last OT; fall back to any OT that still holds it.
  let returnDistance = planningRepository.readReturnToBase(last.taskMetadata)
    .distanceMeters
  if (returnDistance <= 0) {
    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      const candidate = planningRepository.readReturnToBase(
        ordered[index].taskMetadata
      ).distanceMeters
      if (candidate > 0) {
        returnDistance = candidate
        break
      }
    }
  }
  total += returnDistance
  return total
}

/**
 * Capacity for a single crew journey (selected crew only).
 */
export function calculateCrewCapacity(
  input: CapacityServiceInput
): CrewCapacity {
  const ordered = listOrderedTasksForCrewJourney(
    [...input.tasks],
    input.crew.id,
    [...input.crews]
  )

  const taskCount = ordered.length
  const technicalMinutes = sumTechnicalMinutes(ordered, input.planningDate)
  const travelMinutes =
    taskCount === 0 ? 0 : sumTravelMinutesForOrderedTasks(ordered)
  const departureMinutes =
    taskCount === 0 ? 0 : resolveTravelFromPreviousMinutes(ordered[0])
  const returnMinutes =
    taskCount === 0 ? 0 : resolveReturnToBaseMinutes(ordered)
  const travelDistanceMeters = sumTravelDistanceMeters(ordered)
  const totalMinutes = technicalMinutes + travelMinutes
  const availableMinutes = Math.max(0, Math.round(input.availableMinutes))
  const remainingMinutes = Math.max(0, availableMinutes - totalMinutes)
  const overtimeMinutes = Math.max(0, totalMinutes - availableMinutes)
  const occupancyPercent =
    availableMinutes <= 0
      ? totalMinutes > 0
        ? 100
        : 0
      : Math.round((totalMinutes / availableMinutes) * 100)

  return {
    taskCount,
    technicalMinutes,
    travelMinutes,
    departureMinutes,
    returnMinutes,
    travelDistanceMeters,
    totalMinutes,
    availableMinutes,
    remainingMinutes,
    overtimeMinutes,
    occupancyPercent,
    status: resolveStatus(taskCount, occupancyPercent),
  }
}

export function isCrewBaseGpsAvailable(
  crew: Pick<
    Crew,
    | "operationalBaseName"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
  >
): boolean {
  return resolveCrewOperationalBase(crew) != null
}

export class CapacityService {
  calculate(input: CapacityServiceInput): CrewCapacity {
    return calculateCrewCapacity(input)
  }
}

export const capacityService = new CapacityService()
