import { resolveTaskCrewId, taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"

type CrewRef = Pick<Crew, "id" | "name">

export const OPERATIONAL_ORDER_REORDERABLE_STATUSES = [
  "programada",
] as const satisfies readonly TaskStatus[]

export function isOperationalOrderReorderable(
  task: Pick<Task, "status">
): boolean {
  return OPERATIONAL_ORDER_REORDERABLE_STATUSES.includes(
    task.status as (typeof OPERATIONAL_ORDER_REORDERABLE_STATUSES)[number]
  )
}

function normalizePositiveOrder(
  value: number | null | undefined
): number | null {
  if (value == null || value <= 0 || !Number.isFinite(value)) {
    return null
  }

  return Math.floor(value)
}

/** Planning lane: only programada OT carry execution_order. */
export function resolvePlanningExecutionOrder(
  task: Pick<Task, "status" | "executionOrder">
): number | null {
  if (task.status !== "programada") {
    return null
  }

  return normalizePositiveOrder(task.executionOrder)
}

/** Operations lane: assigned OT and beyond use dispatch_order only. */
export function resolveDispatchOperationalOrder(
  task: Pick<Task, "status" | "dispatchOrder">
): number | null {
  if (task.status === "programada") {
    return null
  }

  return normalizePositiveOrder(task.dispatchOrder)
}

export function resolveOperationalOrderValue(
  task: Pick<Task, "dispatchOrder" | "executionOrder"> &
    Partial<Pick<Task, "status">>
): number | null {
  if (task.status === "programada") {
    return resolvePlanningExecutionOrder({
      status: task.status,
      executionOrder: task.executionOrder,
    })
  }

  if (task.status != null) {
    return resolveDispatchOperationalOrder({
      status: task.status,
      dispatchOrder: task.dispatchOrder,
    })
  }

  return (
    normalizePositiveOrder(task.dispatchOrder) ??
    normalizePositiveOrder(task.executionOrder)
  )
}

function resolveTaskCreatedAtSortKey(task: Pick<Task, "createdAt">): string {
  return task.createdAt ?? ""
}

export function compareOperationalOrderTasks(
  left: Task,
  right: Task,
  crews: CrewRef[] = []
): number {
  const leftCrewId = resolveTaskCrewId(left, crews) ?? ""
  const rightCrewId = resolveTaskCrewId(right, crews) ?? ""

  const leftOrder = resolveOperationalOrderValue(left)
  const rightOrder = resolveOperationalOrderValue(right)
  const leftHasOrder = leftOrder != null
  const rightHasOrder = rightOrder != null

  if (leftCrewId && leftCrewId === rightCrewId) {
    if (leftHasOrder && rightHasOrder) {
      return leftOrder! - rightOrder!
    }
    if (leftHasOrder !== rightHasOrder) {
      return leftHasOrder ? -1 : 1
    }
  } else if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1
  }

  return resolveTaskCreatedAtSortKey(left).localeCompare(
    resolveTaskCreatedAtSortKey(right)
  )
}

export function sortOperationalOrderScope(
  tasks: Task[],
  crews: CrewRef[] = []
): Task[] {
  return [...tasks].sort((left, right) =>
    compareOperationalOrderTasks(left, right, crews)
  )
}

export function filterOperationalOrderScope(
  tasks: Task[],
  dueDate: string,
  crewId: string | null | undefined,
  crews: CrewRef[] = []
): Task[] {
  if (!crewId) {
    return []
  }

  return tasks.filter(
    (task) =>
      task.dueDate === dueDate &&
      taskMatchesCrewId(task, { id: crewId, name: "" })
  )
}

export function filterPlanningExecutionOrderScope(
  tasks: Task[],
  dueDate: string,
  crewId: string | null | undefined,
  crews: CrewRef[] = []
): Task[] {
  return filterOperationalOrderScope(tasks, dueDate, crewId, crews).filter(
    (task) => task.status === "programada"
  )
}

export function collectFrozenOperationalOrdersForScope(
  scope: Task[]
): Set<number> {
  const frozenOrders = new Set<number>()

  for (const task of scope) {
    if (isOperationalOrderReorderable(task)) {
      continue
    }

    const order = resolveOperationalOrderValue(task)
    if (order != null && order > 0) {
      frozenOrders.add(Math.floor(order))
    }
  }

  return frozenOrders
}

function buildAvailableOperationalOrderSlots(
  frozenOrders: Set<number>,
  reorderableCount: number,
  minimumSlot: number
): number[] {
  const slots: number[] = []
  let candidate = 1
  const targetCount = Math.max(reorderableCount, 0)
  const minimum = Math.max(Math.floor(minimumSlot), 1)

  while (slots.length < targetCount) {
    if (!frozenOrders.has(candidate)) {
      slots.push(candidate)
    }
    candidate += 1

    if (candidate > 10_000) {
      break
    }
  }

  if (slots.length === 0) {
    return [minimum]
  }

  return slots
}

function buildReorderableSequence(
  scope: Task[],
  taskId: string,
  desiredGlobalOrder: number,
  crews: CrewRef[]
): Task[] {
  const reorderable = scope.filter(isOperationalOrderReorderable)
  const movingTask = reorderable.find((task) => task.id === taskId)
  const others = sortOperationalOrderScope(
    reorderable.filter((task) => task.id !== taskId),
    crews
  )

  if (!movingTask) {
    return others
  }

  const frozenOrders = collectFrozenOperationalOrdersForScope(scope)
  const totalCount = frozenOrders.size + others.length + 1
  const targetOrder = Math.min(
    Math.max(Math.floor(desiredGlobalOrder), 1),
    Math.max(totalCount, 1)
  )
  const frozenBeforeTarget = [...frozenOrders].filter(
    (order) => order < targetOrder
  ).length
  const reorderableInsertIndex = Math.max(0, targetOrder - 1 - frozenBeforeTarget)

  const sequence = [...others]
  sequence.splice(reorderableInsertIndex, 0, movingTask)
  return sequence
}

export function buildOperationalOrderFieldUpdates<T extends { taskId: string }>(input: {
  scope: Task[]
  taskId: string
  desiredGlobalOrder: number
  crews: CrewRef[]
  readOrder: (task: Task) => number | null | undefined
  writeUpdate: (taskId: string, order: number | null) => T
}): T[] {
  const { scope, taskId, desiredGlobalOrder, crews, readOrder, writeUpdate } =
    input
  const reorderable = scope.filter(isOperationalOrderReorderable)

  if (!reorderable.some((task) => task.id === taskId)) {
    return []
  }

  const frozenOrders = collectFrozenOperationalOrdersForScope(scope)
  const sequence = buildReorderableSequence(
    scope,
    taskId,
    desiredGlobalOrder,
    crews
  )
  const slots = buildAvailableOperationalOrderSlots(
    frozenOrders,
    sequence.length,
    desiredGlobalOrder
  )
  const updates: T[] = []

  sequence.forEach((task, index) => {
    const nextOrder = slots[index] ?? slots[slots.length - 1]! + index + 1
    const currentOrder = readOrder(task)

    if (currentOrder !== nextOrder) {
      updates.push(writeUpdate(task.id, nextOrder))
    }
  })

  return updates
}

export function resolveNextOperationalOrderProposal(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  crews?: CrewRef[]
  excludeTaskId?: string
}): number {
  const { tasks, dueDate, crewId, crews = [], excludeTaskId } = input
  const mates = filterPlanningExecutionOrderScope(
    tasks,
    dueDate,
    crewId,
    crews
  ).filter((task) => task.id !== excludeTaskId)

  const maxOrder = mates.reduce(
    (max, task) => Math.max(max, task.executionOrder ?? 0),
    0
  )

  return maxOrder + 1
}

export function buildOperationalOrderRemovalFieldUpdates<T extends { taskId: string }>(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  removedTaskId: string
  crews: CrewRef[]
  readOrder: (task: Task) => number | null | undefined
  writeUpdate: (taskId: string, order: number | null) => T
  isClearable: (task: Task) => boolean
}): T[] {
  const {
    tasks,
    dueDate,
    crewId,
    removedTaskId,
    crews,
    readOrder,
    writeUpdate,
    isClearable,
  } = input
  const scope = filterPlanningExecutionOrderScope(tasks, dueDate, crewId, crews)
  const remaining = scope.filter(
    (task) =>
      task.id !== removedTaskId &&
      isOperationalOrderReorderable(task) &&
      readOrder(task) != null
  )

  const updates: T[] = []
  const removed = scope.find((task) => task.id === removedTaskId)

  if (removed && isClearable(removed) && readOrder(removed) != null) {
    updates.push(writeUpdate(removedTaskId, null))
  }

  if (remaining.length === 0) {
    return updates
  }

  const frozenOrders = collectFrozenOperationalOrdersForScope(scope)
  const sequence = sortOperationalOrderScope(remaining, crews)
  const slots = buildAvailableOperationalOrderSlots(
    frozenOrders,
    sequence.length,
    1
  )

  sequence.forEach((task, index) => {
    const nextOrder = slots[index]!
    if (readOrder(task) !== nextOrder) {
      updates.push(writeUpdate(task.id, nextOrder))
    }
  })

  return updates
}
