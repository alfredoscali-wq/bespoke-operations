import {
  planningRepository,
} from "@/lib/engines/planning/repositories/PlanningRepository"
import {
  buildCrewJourneySegments,
  type JourneySegmentPlan,
} from "@/lib/engines/planning/services/recalculate-journey-travel"
import {
  getSharedRouteService,
  type RouteService,
} from "@/lib/engines/planning/services/RouteService"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type TravelMetadataUpdate = {
  taskId: string
  taskMetadata: Record<string, unknown>
}

export type RecalculateJourneyTravelResult = {
  ok: true
  updates: TravelMetadataUpdate[]
  recalculatedCount: number
  skippedManualCount: number
  failedCount: number
  plans: JourneySegmentPlan[]
  warning: string | null
  baseGpsAvailable: boolean
}

/**
 * Recalculates only segments that need it (not MANUAL with same endpoints).
 * Failures never throw — planning stays usable.
 * Missing base GPS degrades to OT→OT only (OPS 2.3A.1).
 */
export async function recalculateCrewJourneyTravel(input: {
  tasks: Task[]
  crew: Crew
  crews: Pick<Crew, "id" | "name">[]
  routeService?: RouteService
  /** When set, only these segment ids are forced (still respects MANUAL skip). */
  forceSegmentIds?: string[] | null
}): Promise<RecalculateJourneyTravelResult> {
  const built = buildCrewJourneySegments({
    tasks: input.tasks,
    crew: input.crew,
    crews: input.crews,
  })

  const force = new Set(input.forceSegmentIds ?? [])
  const routeService = input.routeService ?? getSharedRouteService()
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]))
  const metadataByTaskId = new Map<string, Record<string, unknown>>()

  function getMeta(taskId: string): Record<string, unknown> {
    if (!metadataByTaskId.has(taskId)) {
      const task = tasksById.get(taskId)
      metadataByTaskId.set(taskId, { ...(task?.taskMetadata ?? {}) })
    }
    return metadataByTaskId.get(taskId)!
  }

  let recalculatedCount = 0
  let skippedManualCount = 0
  let failedCount = 0

  // Normalize return metadata onto the current last return owner only.
  const returnPlan = built.plans.find(
    (plan) => plan.segment.kind === "return_to_base"
  )
  if (returnPlan) {
    for (const task of input.tasks) {
      if (task.id === returnPlan.segment.ownerTaskId) {
        continue
      }
      const existing = planningRepository.readReturnToBase(task.taskMetadata)
      if (
        existing.endpointsKey != null ||
        existing.minutes > 0 ||
        task.taskMetadata?.return_to_base_minutes != null
      ) {
        metadataByTaskId.set(
          task.id,
          planningRepository.clearReturnToBase(getMeta(task.id))
        )
      }
    }
  }

  for (const plan of built.plans) {
    const needs =
      plan.needsRecalc ||
      (force.size > 0 && force.has(plan.segment.id))

    if (!needs) {
      skippedManualCount += 1
      // Stamp endpoints for legacy MANUAL without fingerprint (no provider call).
      if (
        plan.existing.source === "MANUAL" &&
        plan.existing.endpointsKey == null &&
        plan.existing.minutes > 0
      ) {
        const ownerId = plan.segment.ownerTaskId
        const currentMeta = getMeta(ownerId)
        if (plan.segment.kind === "to_task") {
          metadataByTaskId.set(
            ownerId,
            planningRepository.mergeTravelFromPrevious(currentMeta, {
              minutes: plan.existing.minutes,
              distanceMeters: plan.existing.distanceMeters,
              source: "MANUAL",
              origin: plan.segment.origin,
              destination: plan.segment.destination,
            })
          )
        } else {
          metadataByTaskId.set(
            ownerId,
            planningRepository.mergeReturnToBase(currentMeta, {
              minutes: plan.existing.minutes,
              distanceMeters: plan.existing.distanceMeters,
              source: "MANUAL",
              origin: plan.segment.origin,
              destination: plan.segment.destination,
            })
          )
        }
      }
      continue
    }

    // Endpoint changed while MANUAL → invalidate and recalculate automatic.
    const result = await routeService.getRoute({
      origin: plan.segment.origin,
      destination: plan.segment.destination,
      requestId: plan.segment.id,
    })

    if (result.status !== "ok") {
      failedCount += 1
      console.warn("[planning/route] segment_failed", {
        segmentId: plan.segment.id,
        status: result.status,
        message: result.message,
      })
      continue
    }

    const ownerId = plan.segment.ownerTaskId
    const currentMeta = getMeta(ownerId)

    if (plan.segment.kind === "to_task") {
      metadataByTaskId.set(
        ownerId,
        planningRepository.mergeTravelFromPrevious(currentMeta, {
          minutes: result.minutes,
          distanceMeters: result.distanceMeters,
          source: "AUTOMATIC",
          origin: plan.segment.origin,
          destination: plan.segment.destination,
        })
      )
    } else {
      metadataByTaskId.set(
        ownerId,
        planningRepository.mergeReturnToBase(currentMeta, {
          minutes: result.minutes,
          distanceMeters: result.distanceMeters,
          source: "AUTOMATIC",
          origin: plan.segment.origin,
          destination: plan.segment.destination,
        })
      )
    }

    recalculatedCount += 1
  }

  const updates: TravelMetadataUpdate[] = [...metadataByTaskId.entries()].map(
    ([taskId, taskMetadata]) => ({ taskId, taskMetadata })
  )

  return {
    ok: true,
    updates,
    recalculatedCount,
    skippedManualCount,
    failedCount,
    plans: built.plans,
    warning: built.warning,
    baseGpsAvailable: built.baseGpsAvailable,
  }
}
