/**
 * OPS 2.3A / 2.3A.1 — build journey segments and decide which legs to recalculate.
 *
 * Base GPS (`crews.operational_base_latitude/longitude` + name) already exists
 * from OPS 2.2. When missing, degrade: skip Base→OT and OT→Base; keep OT→OT.
 * OPS 2.3C can add map UX to capture base GPS — no new columns required for that.
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

export const MISSING_BASE_GPS_WARNING =
  "La Base Operativa de esta cuadrilla no posee coordenadas GPS. Se calcularon únicamente los traslados entre órdenes de trabajo."

export type JourneySegmentPlan = {
  segment: RouteSegment
  endpointsKey: string
  existing: PersistedTravelLeg
  needsRecalc: boolean
}

export type BuildCrewJourneySegmentsResult = {
  plans: JourneySegmentPlan[]
  /** Non-blocking advisory when base legs were skipped. */
  warning: string | null
  baseGpsAvailable: boolean
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
}): BuildCrewJourneySegmentsResult {
  const base = resolveCrewOperationalBase(input.crew)
  const baseGpsAvailable = base != null
  const warning = baseGpsAvailable ? null : MISSING_BASE_GPS_WARNING

  const ordered = listOrderedTasksForCrewJourney(
    input.tasks,
    input.crew.id,
    input.crews
  )

  if (ordered.length === 0) {
    return { plans: [], warning, baseGpsAvailable }
  }

  const plans: JourneySegmentPlan[] = []

  for (let index = 0; index < ordered.length; index += 1) {
    const task = ordered[index]
    const taskCoord = resolveTaskPlanningCoordinates(task)
    if (!taskCoord) {
      continue
    }

    // Without base GPS, skip Base → Primera OT (index 0); keep OT → OT.
    if (index === 0 && !base) {
      continue
    }

    const origin =
      index === 0
        ? ({
            latitude: base!.latitude,
            longitude: base!.longitude,
          } satisfies RouteCoordinate)
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
          index === 0 ? base!.name : resolvePlanningOtLabel(ordered[index - 1]),
        destinationLabel: resolvePlanningOtLabel(task),
      },
      endpointsKey,
      existing,
      needsRecalc,
    })
  }

  // Without base GPS, skip Última OT → Base.
  if (base) {
    const lastWithCoords = [...ordered]
      .reverse()
      .find((task) => resolveTaskPlanningCoordinates(task) != null)

    if (lastWithCoords) {
      const lastCoord = resolveTaskPlanningCoordinates(lastWithCoords)!
      const origin: RouteCoordinate = {
        latitude: lastCoord.latitude,
        longitude: lastCoord.longitude,
      }
      const baseCoord: RouteCoordinate = {
        latitude: base.latitude,
        longitude: base.longitude,
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
  }

  return { plans, warning, baseGpsAvailable }
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
