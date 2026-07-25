/**
 * OPS 2.1 — planning travel times (manual).
 * Stored on existing `task_metadata` — no new domain entities.
 *
 * OPS 2.2 may auto-fill the same keys; UI keeps reading via these helpers.
 */

import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export const PLANNING_TRAVEL_FROM_PREVIOUS_KEY =
  "travel_from_previous_minutes" as const
export const PLANNING_RETURN_TO_BASE_KEY = "return_to_base_minutes" as const

export const PLANNING_BASE_LABEL = "Base"

export type PlanningTravelField =
  | typeof PLANNING_TRAVEL_FROM_PREVIOUS_KEY
  | typeof PLANNING_RETURN_TO_BASE_KEY

export type PlanningJourneyTravelItem = {
  kind: "travel"
  id: string
  fromLabel: string
  toLabel: string
  minutes: number
  /** Task that owns the persisted minutes for this segment. */
  ownerTaskId: string
  field: PlanningTravelField
}

export type PlanningJourneyTaskItem = {
  kind: "task"
  task: Task
}

export type PlanningJourneyItem =
  | PlanningJourneyTravelItem
  | PlanningJourneyTaskItem

function readNonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed)
    }
  }
  return 0
}

export function resolveTravelFromPreviousMinutes(
  task: Pick<Task, "taskMetadata">
): number {
  return readNonNegativeInt(task.taskMetadata?.[PLANNING_TRAVEL_FROM_PREVIOUS_KEY])
}

export function resolveReturnToBaseMinutesOnTask(
  task: Pick<Task, "taskMetadata">
): number {
  return readNonNegativeInt(task.taskMetadata?.[PLANNING_RETURN_TO_BASE_KEY])
}

/**
 * Return leg for an ordered crew journey.
 * Prefers the last OT; falls back to any OT that still holds the value
 * (after reorder, before normalize).
 */
export function resolveReturnToBaseMinutes(
  orderedTasks: readonly Pick<Task, "taskMetadata">[]
): number {
  if (orderedTasks.length === 0) {
    return 0
  }

  const last = orderedTasks[orderedTasks.length - 1]
  const fromLast = resolveReturnToBaseMinutesOnTask(last)
  if (fromLast > 0 || last.taskMetadata?.[PLANNING_RETURN_TO_BASE_KEY] != null) {
    return fromLast
  }

  for (let index = orderedTasks.length - 2; index >= 0; index -= 1) {
    const value = resolveReturnToBaseMinutesOnTask(orderedTasks[index])
    if (
      value > 0 ||
      orderedTasks[index].taskMetadata?.[PLANNING_RETURN_TO_BASE_KEY] != null
    ) {
      return value
    }
  }

  return 0
}

export function mergeTravelFromPreviousMinutes(
  metadata: Record<string, unknown> | undefined,
  minutes: number
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [PLANNING_TRAVEL_FROM_PREVIOUS_KEY]: Math.max(0, Math.round(minutes)),
  }
}

export function mergeReturnToBaseMinutes(
  metadata: Record<string, unknown> | undefined,
  minutes: number
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [PLANNING_RETURN_TO_BASE_KEY]: Math.max(0, Math.round(minutes)),
  }
}

export function clearReturnToBaseMinutes(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) }
  delete next[PLANNING_RETURN_TO_BASE_KEY]
  return next
}

/** Persist return on the last OT; clear stray copies on earlier OTs. */
export function buildReturnToBaseMetadataUpdates(
  orderedTasks: readonly Task[],
  minutes: number
): { taskId: string; taskMetadata: Record<string, unknown> }[] {
  if (orderedTasks.length === 0) {
    return []
  }

  const normalized = Math.max(0, Math.round(minutes))
  const lastId = orderedTasks[orderedTasks.length - 1].id
  const updates: { taskId: string; taskMetadata: Record<string, unknown> }[] =
    []

  for (const task of orderedTasks) {
    if (task.id === lastId) {
      updates.push({
        taskId: task.id,
        taskMetadata: mergeReturnToBaseMinutes(task.taskMetadata, normalized),
      })
      continue
    }

    if (task.taskMetadata?.[PLANNING_RETURN_TO_BASE_KEY] != null) {
      updates.push({
        taskId: task.id,
        taskMetadata: clearReturnToBaseMinutes(task.taskMetadata),
      })
    }
  }

  return updates
}

export function resolvePlanningOtLabel(task: Pick<Task, "code">): string {
  return task.code?.trim() || "OT"
}

export function sumTravelMinutesForOrderedTasks(
  orderedTasks: readonly Pick<Task, "taskMetadata">[]
): number {
  if (orderedTasks.length === 0) {
    return 0
  }

  const legs = orderedTasks.reduce(
    (sum, task) => sum + resolveTravelFromPreviousMinutes(task),
    0
  )
  return legs + resolveReturnToBaseMinutes(orderedTasks)
}

function buildCrewJourneyItems(orderedTasks: Task[]): PlanningJourneyItem[] {
  if (orderedTasks.length === 0) {
    return []
  }

  const items: PlanningJourneyItem[] = []

  for (let index = 0; index < orderedTasks.length; index += 1) {
    const task = orderedTasks[index]
    const fromLabel =
      index === 0
        ? PLANNING_BASE_LABEL
        : resolvePlanningOtLabel(orderedTasks[index - 1])
    const toLabel = resolvePlanningOtLabel(task)

    items.push({
      kind: "travel",
      id: `travel-to-${task.id}`,
      fromLabel,
      toLabel,
      minutes: resolveTravelFromPreviousMinutes(task),
      ownerTaskId: task.id,
      field: PLANNING_TRAVEL_FROM_PREVIOUS_KEY,
    })
    items.push({ kind: "task", task })
  }

  const last = orderedTasks[orderedTasks.length - 1]
  items.push({
    kind: "travel",
    id: `travel-return-${last.id}`,
    fromLabel: resolvePlanningOtLabel(last),
    toLabel: PLANNING_BASE_LABEL,
    minutes: resolveReturnToBaseMinutes(orderedTasks),
    ownerTaskId: last.id,
    field: PLANNING_RETURN_TO_BASE_KEY,
  })

  return items
}

/**
 * Visual journey for the planning list.
 * Labels always follow current order; minutes stay on each OT until edited.
 */
export function buildPlanningJourneyItems(
  tasks: Task[],
  crews: Pick<Crew, "id" | "name">[] = []
): PlanningJourneyItem[] {
  const ordered = sortTasksByDispatchRoute(tasks, crews)
  if (ordered.length === 0) {
    return []
  }

  const items: PlanningJourneyItem[] = []
  let buffer: Task[] = []
  let bufferCrewKey: string | null = null

  function flush() {
    if (buffer.length > 0) {
      items.push(...buildCrewJourneyItems(buffer))
      buffer = []
    }
  }

  for (const task of ordered) {
    const crewKey = resolveTaskCrewId(task, crews) ?? `__no_crew__:${task.id}`
    if (buffer.length === 0) {
      buffer = [task]
      bufferCrewKey = crewKey
      continue
    }

    if (crewKey === bufferCrewKey) {
      buffer.push(task)
      continue
    }

    flush()
    buffer = [task]
    bufferCrewKey = crewKey
  }

  flush()
  return items
}

export function listOrderedTasksForCrewJourney(
  tasks: Task[],
  crewId: string,
  crews: Pick<Crew, "id" | "name">[]
): Task[] {
  const crewTasks = tasks.filter(
    (task) => resolveTaskCrewId(task, crews) === crewId
  )
  return sortTasksByDispatchRoute(crewTasks, crews)
}
