import {
  collectFrozenPlanningRouteOrders,
  isTaskReopenableForPlanning,
} from "@/lib/planificacion/planning-dynamic"
import {
  filterOperationalOrderScope,
  resolveDispatchOperationalOrder,
  sortOperationalOrderScope,
} from "@/lib/planificacion/planning-operational-order-core"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

type CrewRef = Pick<Crew, "id" | "name">

export type PlanningConfirmMode = "incremental" | "replan"

export type PlanningConfirmDispatchUpdate = {
  taskId: string
  dispatchOrder: number
}

type PlanningConfirmGroup = {
  dueDate: string
  crewId: string
  taskIds: string[]
}

function buildDispatchSlotsSkippingFrozen(
  frozenOrders: Set<number>,
  count: number
): number[] {
  const slots: number[] = []
  let candidate = 1

  while (slots.length < count) {
    if (!frozenOrders.has(candidate)) {
      slots.push(candidate)
    }
    candidate += 1

    if (candidate > 10_000) {
      break
    }
  }

  return slots.length > 0 ? slots : [1]
}

function groupConfirmingTasksByCrew(
  tasks: Task[],
  confirmingTaskIds: string[],
  crews: CrewRef[] = []
): PlanningConfirmGroup[] {
  const idSet = new Set(confirmingTaskIds)
  const groups = new Map<string, PlanningConfirmGroup>()

  for (const taskId of confirmingTaskIds) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) {
      continue
    }

    const crewId = resolveTaskCrewId(task, crews)
    if (!crewId) {
      continue
    }

    const key = `${task.dueDate}::${crewId}`
    const existing = groups.get(key)

    if (existing) {
      existing.taskIds.push(taskId)
      continue
    }

    groups.set(key, {
      dueDate: task.dueDate,
      crewId,
      taskIds: [taskId],
    })
  }

  return [...groups.values()]
}

function listConfirmingProgramadaTasks(
  tasks: Task[],
  taskIds: string[],
  crews: CrewRef[] = []
): Task[] {
  const idSet = new Set(taskIds)

  return sortOperationalOrderScope(
    tasks.filter(
      (task) => idSet.has(task.id) && task.status === "programada"
    ),
    crews
  )
}

function resolveMaxDispatchOrderForRoute(routeScope: Task[]): number {
  return routeScope.reduce(
    (max, task) => Math.max(max, resolveDispatchOperationalOrder(task) ?? 0),
    0
  )
}

/**
 * Planificar incremental: solo OT programadas nuevas; conserva dispatch existente
 * y asigna dispatch_order al final según el mayor valor vigente en la cuadrilla.
 */
export function buildIncrementalPlanificarUpdates(input: {
  tasks: Task[]
  confirmingTaskIds: string[]
  crews?: CrewRef[]
}): PlanningConfirmDispatchUpdate[] {
  const { tasks, confirmingTaskIds, crews = [] } = input
  const updates: PlanningConfirmDispatchUpdate[] = []

  for (const group of groupConfirmingTasksByCrew(
    tasks,
    confirmingTaskIds,
    crews
  )) {
    const routeScope = filterOperationalOrderScope(
      tasks,
      group.dueDate,
      group.crewId,
      crews
    )
    const confirming = listConfirmingProgramadaTasks(
      tasks,
      group.taskIds,
      crews
    )
    const maxDispatch = resolveMaxDispatchOrderForRoute(routeScope)

    confirming.forEach((task, index) => {
      updates.push({
        taskId: task.id,
        dispatchOrder: maxDispatch + index + 1,
      })
    })
  }

  return updates
}

/**
 * Replanificar: regenera dispatch_order del conjunto reconstruido (programadas),
 * respetando execution_order y slots congelados por OT en curso.
 */
export function buildReplanificarConfirmUpdates(input: {
  tasks: Task[]
  confirmingTaskIds: string[]
  crews?: CrewRef[]
}): PlanningConfirmDispatchUpdate[] {
  const { tasks, confirmingTaskIds, crews = [] } = input
  const updates: PlanningConfirmDispatchUpdate[] = []

  for (const group of groupConfirmingTasksByCrew(
    tasks,
    confirmingTaskIds,
    crews
  )) {
    const routeScope = filterOperationalOrderScope(
      tasks,
      group.dueDate,
      group.crewId,
      crews
    )
    const confirming = listConfirmingProgramadaTasks(
      tasks,
      group.taskIds,
      crews
    )
    const frozenOrders = collectFrozenPlanningRouteOrders(routeScope)
    const slots = buildDispatchSlotsSkippingFrozen(
      frozenOrders,
      confirming.length
    )

    confirming.forEach((task, index) => {
      updates.push({
        taskId: task.id,
        dispatchOrder: slots[index] ?? slots[slots.length - 1]! + index + 1,
      })
    })
  }

  return updates
}

export function resolvePlanningConfirmModeForGroup(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  confirmingTaskIds: string[]
  crews?: CrewRef[]
}): PlanningConfirmMode {
  const { tasks, dueDate, crewId, confirmingTaskIds, crews = [] } = input
  const idSet = new Set(confirmingTaskIds)
  const routeScope = filterOperationalOrderScope(
    tasks,
    dueDate,
    crewId,
    crews
  )

  const hasPlannedNotBeingConfirmed = routeScope.some(
    (task) => isTaskReopenableForPlanning(task) && !idSet.has(task.id)
  )

  if (hasPlannedNotBeingConfirmed) {
    return "incremental"
  }

  const programadaInCrew = routeScope.filter((task) => task.status === "programada")

  if (
    programadaInCrew.length === confirmingTaskIds.length &&
    programadaInCrew.every((task) => idSet.has(task.id))
  ) {
    return "replan"
  }

  return "incremental"
}

export function buildPlanningConfirmDispatchUpdates(input: {
  tasks: Task[]
  confirmingTaskIds: string[]
  crews?: CrewRef[]
}): PlanningConfirmDispatchUpdate[] {
  const { tasks, confirmingTaskIds, crews = [] } = input
  const updates: PlanningConfirmDispatchUpdate[] = []

  for (const group of groupConfirmingTasksByCrew(
    tasks,
    confirmingTaskIds,
    crews
  )) {
    const mode = resolvePlanningConfirmModeForGroup({
      tasks,
      dueDate: group.dueDate,
      crewId: group.crewId,
      confirmingTaskIds: group.taskIds,
      crews,
    })

    const groupUpdates =
      mode === "replan"
        ? buildReplanificarConfirmUpdates({
            tasks,
            confirmingTaskIds: group.taskIds,
            crews,
          })
        : buildIncrementalPlanificarUpdates({
            tasks,
            confirmingTaskIds: group.taskIds,
            crews,
          })

    updates.push(...groupUpdates)
  }

  return updates
}
