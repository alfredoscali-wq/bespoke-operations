/**
 * OPS 2.3A — build journey segments and decide which legs to recalculate.
 */

import type {
  RouteCoordinate,
  RouteSegment,
} from "@/lib/engines/planning/contracts/RouteRequest"
import {
  buildTravelEndpointsKey,
  planningRepository,
  type PersistedTravelLeg,
} from "@/lib/engines/planning/repositories/PlanningRepository"
import { resolveCrewOperationalBase } from "@/lib/crews/operational-config"
import { resolveTaskPlanningCoordinates } from "@/lib/planificacion/planning-utils"
import {
  listOrderedTasksForCrewJourney,
  resolvePlanningOtLabel,
} from "@/lib/planificacion/planning-travel"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type JourneySegmentPlan = {
  segment: RouteSegment
  endpointsKey: string
  existing: PersistedTravelLeg
  needsRecalc: boolean
}

export function buildCrewJourneySegments(input: {
  tasks: Task[]
  crew: Pick<
    Crew,
    | "id"
    | "name"
    | "operationalBaseName"
    | "operationalBaseLatitude"
    | "operationalBaseLongitude"
  >
  crews: Pick<Crew, "id" | "name">[]
}): JourneySegmentPlan[] | { error: string } {
  const base = resolveCrewOperationalBase(input.crew)
  if (!base) {
    return {
      error:
        "La cuadrilla no tiene Base Operativa con coordenadas GPS configuradas.",
    }
  }

  const ordered = listOrderedTasksForCrewJourney(
    input.tasks,
    input.crew.id,
    input.crews
  )

  if (ordered.length === 0) {
    return []
  }

  const baseCoord: RouteCoordinate = {
    latitude: base.latitude,
    longitude: base.longitude,
  }
  const plans: JourneySegmentPlan[] = []

  for (let index = 0; index < ordered.length; index += 1) {
    const task = ordered[index]
    const taskCoord = resolveTaskPlanningCoordinates(task)
    if (!taskCoord) {
      continue
    }

    const origin =
      index === 0
        ? baseCoord
        : (() => {
            const previous = resolveTaskPlanningCoordinates(ordered[index - 1])
            return previous
              ? {
                  latitude: previous.latitude,
                  longitude: previous.longitude,
                }
              : null
          })()

    if (!origin) {
      continue
    }

    const destination: RouteCoordinate = {
      latitude: taskCoord.latitude,
      longitude: taskCoord.longitude,
    }
    const endpointsKey = buildTravelEndpointsKey(origin, destination)
    const existing = planningRepository.readTravelFromPrevious(task.taskMetadata)
    const needsRecalc = !planningRepository.shouldSkipRecalc(
      existing,
      endpointsKey
    )

    plans.push({
      segment: {
        id: `to-task:${task.id}`,
        kind: "to_task",
        ownerTaskId: task.id,
        origin,
        destination,
        originLabel:
          index === 0 ? base.name : resolvePlanningOtLabel(ordered[index - 1]),
        destinationLabel: resolvePlanningOtLabel(task),
      },
      endpointsKey,
      existing,
      needsRecalc,
    })
  }

  const lastWithCoords = [...ordered]
    .reverse()
    .find((task) => resolveTaskPlanningCoordinates(task) != null)

  if (lastWithCoords) {
    const lastCoord = resolveTaskPlanningCoordinates(lastWithCoords)!
    const origin: RouteCoordinate = {
      latitude: lastCoord.latitude,
      longitude: lastCoord.longitude,
    }
    const endpointsKey = buildTravelEndpointsKey(origin, baseCoord)
    const existing = planningRepository.readReturnToBase(
      lastWithCoords.taskMetadata
    )
    const needsRecalc = !planningRepository.shouldSkipRecalc(
      existing,
      endpointsKey
    )

    plans.push({
      segment: {
        id: `return:${lastWithCoords.id}`,
        kind: "return_to_base",
        ownerTaskId: lastWithCoords.id,
        origin,
        destination: baseCoord,
        originLabel: resolvePlanningOtLabel(lastWithCoords),
        destinationLabel: base.name,
      },
      endpointsKey,
      existing,
      needsRecalc,
    })
  }

  return plans
}

export function listAffectedSegmentIds(
  previousPlans: JourneySegmentPlan[],
  nextPlans: JourneySegmentPlan[]
): string[] {
  const prevKeys = new Map(
    previousPlans.map((plan) => [plan.segment.id, plan.endpointsKey] as const)
  )
  const affected: string[] = []

  for (const plan of nextPlans) {
    const previousKey = prevKeys.get(plan.segment.id)
    if (previousKey !== plan.endpointsKey) {
      affected.push(plan.segment.id)
    }
  }

  for (const prev of previousPlans) {
    if (!nextPlans.some((plan) => plan.segment.id === prev.segment.id)) {
      affected.push(prev.segment.id)
    }
  }

  return [...new Set(affected)]
}
