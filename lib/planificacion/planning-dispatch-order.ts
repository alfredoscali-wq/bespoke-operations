import {
  collectOccupiedDispatchOrdersForConfirm,
} from "@/lib/planificacion/planning-dynamic"
import {
  buildOperationalOrderFieldUpdates,
  filterOperationalOrderScope,
  resolvePlanningExecutionOrder,
} from "@/lib/planificacion/planning-operational-order-core"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

type CrewRef = Pick<Crew, "id" | "name">

export type DispatchOrderUpdate = {
  taskId: string
  dispatchOrder: number | null
}

export function dedupeDispatchOrderUpdates(
  updates: DispatchOrderUpdate[]
): DispatchOrderUpdate[] {
  const byTaskId = new Map<string, DispatchOrderUpdate>()
  for (const update of updates) {
    byTaskId.set(update.taskId, update)
  }
  return [...byTaskId.values()]
}

export function buildDispatchOrderAssignmentUpdates(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  taskId: string
  desiredOrder: number
  crews: CrewRef[]
}): DispatchOrderUpdate[] {
  const { tasks, dueDate, crewId, taskId, desiredOrder, crews } = input
  const scope = filterOperationalOrderScope(tasks, dueDate, crewId, crews).filter(
    (task) => task.status !== "programada"
  )

  return buildOperationalOrderFieldUpdates({
    scope,
    taskId,
    desiredGlobalOrder: desiredOrder,
    crews,
    readOrder: (task) => task.dispatchOrder ?? null,
    writeUpdate: (updateTaskId, order) => ({
      taskId: updateTaskId,
      dispatchOrder: order,
    }),
  })
}

/** Copies execution_order into dispatch_order for tasks entering the operations lane. */
function assignNextAvailableDispatchOrder(
  occupied: Set<number>,
  desiredOrder?: number | null
): number {
  if (desiredOrder != null && desiredOrder > 0) {
    const normalized = Math.floor(desiredOrder)
    if (!occupied.has(normalized)) {
      return normalized
    }
  }

  let candidate = 1
  while (occupied.has(candidate)) {
    candidate += 1
  }

  return candidate
}

/** Removes a task from its frozen operations route (clears dispatch_order only). */
export function buildDispatchOrderScopeLeaveUpdates(input: {
  task: Pick<Task, "id" | "dispatchOrder">
}): DispatchOrderUpdate[] {
  if (input.task.dispatchOrder == null || input.task.dispatchOrder <= 0) {
    return []
  }

  return [{ taskId: input.task.id, dispatchOrder: null }]
}

/** Assigns dispatch_order in the destination scope after due_date/crew_id are updated. */
export function buildDispatchOrderDestinationAssignmentUpdates(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  taskId: string
  crews: CrewRef[]
  desiredOrder?: number | null
}): DispatchOrderUpdate[] {
  const { tasks, dueDate, crewId, taskId, crews, desiredOrder } = input
  const routeScope = filterOperationalOrderScope(tasks, dueDate, crewId, crews).filter(
    (task) => task.status !== "programada"
  )
  const occupied = collectOccupiedDispatchOrdersForConfirm(routeScope, new Set([taskId]))

  return [
    {
      taskId,
      dispatchOrder: assignNextAvailableDispatchOrder(occupied, desiredOrder),
    },
  ]
}

export function buildDispatchOrderConfirmUpdates(
  tasks: Task[],
  taskIds: string[],
  _crews: CrewRef[] = []
): DispatchOrderUpdate[] {
  const updates: DispatchOrderUpdate[] = []

  for (const taskId of taskIds) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task || task.status !== "programada") {
      continue
    }

    const order = resolvePlanningExecutionOrder(task)
    if (order == null) {
      continue
    }

    updates.push({
      taskId,
      dispatchOrder: order,
    })
  }

  return dedupeDispatchOrderUpdates(updates)
}
