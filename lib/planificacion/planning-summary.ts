/**
 * OPS 2.1 / 2.2 — centralized planning day load summary.
 * UI / dashboards / reports must use this instead of ad-hoc sums.
 */

import {
  parseEstimatedDurationMinutes,
  PLANNING_DEFAULT_AVAILABLE_MINUTES,
} from "@/lib/planificacion/planning-duration"
import { resolvePlanningDayDurationMinutes } from "@/lib/planificacion/planning-date-range"
import {
  listOrderedTasksForCrewJourney,
  sumTravelMinutesForOrderedTasks,
} from "@/lib/planificacion/planning-travel"
import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { resolveCrewHabitualShiftMinutes } from "@/lib/crews/operational-config"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export { PLANNING_DEFAULT_AVAILABLE_MINUTES } from "@/lib/planificacion/planning-duration"

export type PlanningSummaryStatus = "normal" | "exceeded"

export type PlanningSummary = {
  taskCount: number
  technicalMinutes: number
  travelMinutes: number
  totalMinutes: number
  availableMinutes: number
  overtimeMinutes: number
  utilizationPercent: number
  status: PlanningSummaryStatus
}

export type CalculatePlanningSummaryInput = {
  tasks: readonly Task[]
  /** Ordered tasks preferred; if omitted, tasks are sorted when crews provided. */
  crews?: readonly Pick<
    Crew,
    "id" | "name" | "habitualShiftMinutes"
  >[]
  /**
   * Explicit capacity override (e.g. planning-day override).
   * When omitted, uses crew habitual duration(s) or the platform default.
   */
  availableMinutes?: number
  /**
   * When true (default), travel is summed per crew journey (each has its own return).
   * When false, treats `tasks` as a single ordered journey.
   */
  groupByCrew?: boolean
  /**
   * OPS 2.1A — planning calendar day. When set, technical minutes use
   * resolvePlanningDayDurationMinutes (multi-day split). When omitted, falls
   * back to full estimated duration (legacy callers).
   */
  planningDate?: string
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
    (sum, task) =>
      sum + parseEstimatedDurationMinutes(task.estimatedDuration ?? ""),
    0
  )
}

function resolveSummaryAvailableMinutes(input: {
  availableMinutes?: number
  tasks: readonly Task[]
  crews: readonly Pick<Crew, "id" | "name" | "habitualShiftMinutes">[]
  groupByCrew: boolean
}): number {
  if (
    typeof input.availableMinutes === "number" &&
    Number.isFinite(input.availableMinutes) &&
    input.availableMinutes >= 0
  ) {
    return Math.round(input.availableMinutes)
  }

  if (input.crews.length === 0) {
    return PLANNING_DEFAULT_AVAILABLE_MINUTES
  }

  if (!input.groupByCrew) {
    return resolveCrewHabitualShiftMinutes(input.crews[0])
  }

  const crewRefs = [...input.crews]
  const crewIds = new Set<string>()
  for (const task of input.tasks) {
    const crewId = resolveTaskCrewId(task, crewRefs)
    if (crewId) {
      crewIds.add(crewId)
    }
  }

  if (crewIds.size === 0) {
    return PLANNING_DEFAULT_AVAILABLE_MINUTES
  }

  let total = 0
  for (const crewId of crewIds) {
    const crew = crewRefs.find((entry) => entry.id === crewId)
    if (crew) {
      total += resolveCrewHabitualShiftMinutes(crew)
    }
  }
  return total > 0 ? total : PLANNING_DEFAULT_AVAILABLE_MINUTES
}

function buildSummary(input: {
  taskCount: number
  technicalMinutes: number
  travelMinutes: number
  availableMinutes: number
}): PlanningSummary {
  const totalMinutes = input.technicalMinutes + input.travelMinutes
  const availableMinutes = Math.max(0, input.availableMinutes)
  const overtimeMinutes = Math.max(0, totalMinutes - availableMinutes)
  const utilizationPercent =
    availableMinutes <= 0
      ? totalMinutes > 0
        ? 100
        : 0
      : Math.round((totalMinutes / availableMinutes) * 100)

  return {
    taskCount: input.taskCount,
    technicalMinutes: input.technicalMinutes,
    travelMinutes: input.travelMinutes,
    totalMinutes,
    availableMinutes,
    overtimeMinutes,
    utilizationPercent,
    status: overtimeMinutes > 0 ? "exceeded" : "normal",
  }
}

/**
 * Calculates jornada load: technical work + travel + capacity.
 * Capacity: explicit override → crew habitual duration (OPS 2.2) → platform default.
 */
export function calculatePlanningSummary(
  input: CalculatePlanningSummaryInput
): PlanningSummary {
  const tasks = input.tasks
  const crews = [...(input.crews ?? [])]
  const groupByCrew = input.groupByCrew ?? true
  const availableMinutes = resolveSummaryAvailableMinutes({
    availableMinutes: input.availableMinutes,
    tasks,
    crews,
    groupByCrew,
  })

  if (tasks.length === 0) {
    return buildSummary({
      taskCount: 0,
      technicalMinutes: 0,
      travelMinutes: 0,
      availableMinutes,
    })
  }

  const technicalMinutes = sumTechnicalMinutes(tasks, input.planningDate)

  if (!groupByCrew || crews.length === 0) {
    const ordered = sortTasksByDispatchRoute([...tasks], crews)
    return buildSummary({
      taskCount: tasks.length,
      technicalMinutes,
      travelMinutes: sumTravelMinutesForOrderedTasks(ordered),
      availableMinutes,
    })
  }

  const crewIds = new Set<string>()
  for (const task of tasks) {
    const crewId = resolveTaskCrewId(task, crews)
    if (crewId) {
      crewIds.add(crewId)
    }
  }

  const unassigned = tasks.filter(
    (task) => resolveTaskCrewId(task, crews) == null
  )

  let travelMinutes = 0
  for (const crewId of crewIds) {
    const ordered = listOrderedTasksForCrewJourney([...tasks], crewId, crews)
    travelMinutes += sumTravelMinutesForOrderedTasks(ordered)
  }

  if (unassigned.length > 0) {
    const orderedUnassigned = sortTasksByDispatchRoute(
      [...unassigned],
      crews
    )
    travelMinutes += sumTravelMinutesForOrderedTasks(orderedUnassigned)
  }

  return buildSummary({
    taskCount: tasks.length,
    technicalMinutes,
    travelMinutes,
    availableMinutes,
  })
}
