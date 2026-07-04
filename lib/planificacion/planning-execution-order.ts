import {
  buildOperationalOrderFieldUpdates,
  buildOperationalOrderRemovalFieldUpdates,
  compareOperationalOrderTasks,
  filterOperationalOrderScope,
  filterPlanningExecutionOrderScope,
  isOperationalOrderReorderable,
  resolveNextOperationalOrderProposal,
  resolveOperationalOrderValue,
  sortOperationalOrderScope,
} from "@/lib/planificacion/planning-operational-order-core"
import {
  collectFrozenPlanningRouteOrders,
} from "@/lib/planificacion/planning-dynamic"
import {
  dedupeDispatchOrderUpdates,
  type DispatchOrderUpdate,
} from "@/lib/planificacion/planning-dispatch-order"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

type CrewRef = Pick<Crew, "id" | "name">

export type ExecutionOrderUpdate = {
  taskId: string
  executionOrder: number | null
}

export type PlanningTaskUpdateBatch = {
  primaryTaskId: string
  primaryPayload: UpdateTaskPayload
  relatedUpdates: ExecutionOrderUpdate[]
}

export {
  isOperationalOrderReorderable,
  OPERATIONAL_ORDER_REORDERABLE_STATUSES,
  resolveOperationalOrderValue,
} from "@/lib/planificacion/planning-operational-order-core"

const CIRCLED_NUMBER_MAX = 20

export function formatPlanningExecutionOrderDisplay(
  order: number | null | undefined
): string | null {
  if (order == null || order <= 0 || !Number.isFinite(order)) {
    return null
  }

  const normalized = Math.floor(order)
  if (normalized >= 1 && normalized <= CIRCLED_NUMBER_MAX) {
    return String.fromCodePoint(0x2460 + normalized - 1)
  }

  return String(normalized)
}

export function resolveOperarioExecutionOrderHeader(
  order: number | null | undefined
): { heading: string; text: string } | null {
  const badge = formatPlanningExecutionOrderDisplay(order)
  if (!badge) {
    return null
  }

  const normalized = Math.floor(order!)
  if (normalized === 1) {
    return {
      heading: "Orden de trabajo",
      text: `${badge} Primera visita del día`,
    }
  }

  return {
    heading: "Orden de ejecución",
    text: badge,
  }
}

export type ExecutionOrderPersistPlan = {
  phases: ExecutionOrderUpdate[][]
}

export type DispatchOrderPersistPlan = {
  phases: DispatchOrderUpdate[][]
}

export function buildExecutionOrderPersistPlan(
  updates: ExecutionOrderUpdate[],
  tasks: Task[]
): ExecutionOrderPersistPlan {
  const deduped = dedupeExecutionOrderUpdates(updates)
  const changes = deduped.filter((update) => {
    const task = tasks.find((item) => item.id === update.taskId)
    return task?.executionOrder !== update.executionOrder
  })

  if (changes.length === 0) {
    return { phases: [] }
  }

  return {
    phases: [
      changes.map((update) => ({
        taskId: update.taskId,
        executionOrder: null,
      })),
      changes,
    ],
  }
}

export function buildDispatchOrderPersistPlan(
  updates: DispatchOrderUpdate[],
  tasks: Task[]
): DispatchOrderPersistPlan {
  const deduped = dedupeDispatchOrderUpdates(updates)
  const changes = deduped.filter((update) => {
    const task = tasks.find((item) => item.id === update.taskId)
    return task?.dispatchOrder !== update.dispatchOrder
  })

  if (changes.length === 0) {
    return { phases: [] }
  }

  return {
    phases: [
      changes.map((update) => ({
        taskId: update.taskId,
        dispatchOrder: null,
      })),
      changes,
    ],
  }
}

export function compareTasksForPlanningDisplay(
  left: Task,
  right: Task,
  crews: CrewRef[] = []
): number {
  return compareOperationalOrderTasks(left, right, crews)
}

export function sortTasksForPlanningList(
  tasks: Task[],
  crews: CrewRef[] = []
): Task[] {
  return [...tasks].sort((left, right) => {
    const leftCrewName =
      left.crew?.trim() ||
      crews.find((crew) => crew.id === resolveTaskCrewId(left, crews))?.name ||
      ""
    const rightCrewName =
      right.crew?.trim() ||
      crews.find((crew) => crew.id === resolveTaskCrewId(right, crews))?.name ||
      ""

    const byCrew = leftCrewName.localeCompare(rightCrewName, "es")
    if (byCrew !== 0) {
      return byCrew
    }

    return compareOperationalOrderTasks(left, right, crews)
  })
}

export function filterTasksInExecutionScope(
  tasks: Task[],
  dueDate: string,
  crewId: string | null | undefined,
  crews: CrewRef[] = []
): Task[] {
  return filterOperationalOrderScope(tasks, dueDate, crewId, crews)
}

export function sortTasksInExecutionSequence(
  tasks: Task[],
  crews: CrewRef[] = []
): Task[] {
  return sortOperationalOrderScope(tasks, crews)
}

export function buildOperationalOrderAssignmentUpdates(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  taskId: string
  desiredOrder: number
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  const { tasks, dueDate, crewId, taskId, desiredOrder, crews } = input
  const scope = filterPlanningExecutionOrderScope(
    tasks,
    dueDate,
    crewId,
    crews
  )
  const routeScope = filterOperationalOrderScope(
    tasks,
    dueDate,
    crewId,
    crews
  )

  return buildOperationalOrderFieldUpdates({
    scope,
    taskId,
    desiredGlobalOrder: desiredOrder,
    crews,
    readOrder: (task) => task.executionOrder ?? null,
    writeUpdate: (updateTaskId, order) => ({
      taskId: updateTaskId,
      executionOrder: order,
    }),
    collectFrozenOrders: () => collectFrozenPlanningRouteOrders(routeScope),
  })
}

export function buildOperationalOrderRemovalUpdates(input: {
  tasks: Task[]
  dueDate: string
  crewId: string
  removedTaskId: string
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  const routeScope = filterOperationalOrderScope(
    input.tasks,
    input.dueDate,
    input.crewId,
    input.crews
  )

  return buildOperationalOrderRemovalFieldUpdates({
    ...input,
    readOrder: (task) => task.executionOrder ?? null,
    writeUpdate: (updateTaskId, order) => ({
      taskId: updateTaskId,
      executionOrder: order,
    }),
    isClearable: (task) => isOperationalOrderReorderable(task),
    collectFrozenOrders: () => collectFrozenPlanningRouteOrders(routeScope),
  })
}

export { resolveNextOperationalOrderProposal }

export function resolveExecutionOrderAppendPosition(
  tasks: Task[],
  dueDate: string,
  crewId: string,
  crews: CrewRef[] = [],
  excludeTaskId?: string
): number {
  return resolveNextOperationalOrderProposal({
    tasks,
    dueDate,
    crewId,
    crews,
    excludeTaskId,
  })
}

export function buildExecutionOrderDragUpdates(
  tasks: Task[],
  draggedTaskId: string,
  targetTaskId: string,
  crews: CrewRef[] = []
): ExecutionOrderUpdate[] {
  if (draggedTaskId === targetTaskId) {
    return []
  }

  const draggedTask = tasks.find((item) => item.id === draggedTaskId)
  const targetTask = tasks.find((item) => item.id === targetTaskId)

  if (!draggedTask || !targetTask) {
    return []
  }

  if (!isOperationalOrderReorderable(draggedTask)) {
    return []
  }

  const draggedCrewId = resolveTaskCrewId(draggedTask, crews)
  const targetCrewId = resolveTaskCrewId(targetTask, crews)

  if (!draggedCrewId || draggedCrewId !== targetCrewId) {
    return []
  }

  if (draggedTask.dueDate !== targetTask.dueDate) {
    return []
  }

  const scopeTasks = filterPlanningExecutionOrderScope(
    tasks,
    draggedTask.dueDate,
    draggedCrewId,
    crews
  )
  const reorderable = sortOperationalOrderScope(
    scopeTasks.filter(isOperationalOrderReorderable),
    crews
  )
  const draggedIndex = reorderable.findIndex((item) => item.id === draggedTaskId)
  const targetIndex = reorderable.findIndex((item) => item.id === targetTaskId)

  if (draggedIndex === -1 || targetIndex === -1) {
    return []
  }

  return buildOperationalOrderAssignmentUpdates({
    tasks,
    dueDate: draggedTask.dueDate,
    crewId: draggedCrewId,
    taskId: draggedTaskId,
    desiredOrder: targetIndex + 1,
    crews,
  })
}

export function buildExecutionOrderSwapUpdates(
  tasks: Task[],
  taskId: string,
  direction: "up" | "down",
  crews: CrewRef[] = []
): ExecutionOrderUpdate[] {
  const task = tasks.find((item) => item.id === taskId)
  if (!task || !isOperationalOrderReorderable(task)) {
    return []
  }

  const crewId = resolveTaskCrewId(task, crews)
  if (!crewId) {
    return []
  }

  const scopeTasks = filterPlanningExecutionOrderScope(
    tasks,
    task.dueDate,
    crewId,
    crews
  )
  const reorderable = sortOperationalOrderScope(
    scopeTasks.filter(isOperationalOrderReorderable),
    crews
  )
  const currentIndex = reorderable.findIndex((item) => item.id === taskId)

  if (currentIndex === -1) {
    return []
  }

  const targetIndex =
    direction === "up" ? currentIndex - 1 : currentIndex + 1

  if (targetIndex < 0 || targetIndex >= reorderable.length) {
    return []
  }

  return buildOperationalOrderAssignmentUpdates({
    tasks,
    dueDate: task.dueDate,
    crewId,
    taskId,
    desiredOrder: targetIndex + 1,
    crews,
  })
}

export function resolveOperationalOrderOnCrewChange(input: {
  task: Task
  newCrewId: string | null
  newDueDate: string
  desiredOrder?: number | null
  allTasks: Task[]
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  const { task, newCrewId, newDueDate, desiredOrder, allTasks, crews } = input
  const previousCrewId = resolveTaskCrewId(task, crews) ?? null
  const updates: ExecutionOrderUpdate[] = []

  if (previousCrewId === newCrewId && task.dueDate === newDueDate) {
    return updates
  }

  if (previousCrewId) {
    updates.push(
      ...buildOperationalOrderRemovalUpdates({
        tasks: allTasks,
        dueDate: task.dueDate,
        crewId: previousCrewId,
        removedTaskId: task.id,
        crews,
      })
    )
  }

  if (newCrewId) {
    const nextOrder =
      desiredOrder ??
      resolveNextOperationalOrderProposal({
        tasks: allTasks,
        dueDate: newDueDate,
        crewId: newCrewId,
        crews,
        excludeTaskId: task.id,
      })

    updates.push(
      ...buildOperationalOrderAssignmentUpdates({
        tasks: allTasks,
        dueDate: newDueDate,
        crewId: newCrewId,
        taskId: task.id,
        desiredOrder: nextOrder,
        crews,
      })
    )
  } else {
    updates.push({ taskId: task.id, executionOrder: null })
  }

  return dedupeExecutionOrderUpdates(updates)
}

export function resolveExecutionOrderOnCrewChange(input: {
  task: Task
  newCrewId: string | null
  allTasks: Task[]
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  return resolveOperationalOrderOnCrewChange({
    ...input,
    newDueDate: input.task.dueDate,
  })
}

export function resolveOperationalOrderOnDateChange(input: {
  task: Task
  newDueDate: string
  desiredOrder?: number | null
  allTasks: Task[]
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  const { task, newDueDate, desiredOrder, allTasks, crews } = input
  const crewId = resolveTaskCrewId(task, crews)

  if (!crewId || task.dueDate === newDueDate) {
    return []
  }

  return resolveOperationalOrderOnCrewChange({
    task,
    newCrewId: crewId,
    newDueDate,
    desiredOrder,
    allTasks,
    crews,
  })
}

export function resolveExecutionOrderOnDateChange(input: {
  task: Task
  newDueDate: string
  allTasks: Task[]
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  return resolveOperationalOrderOnDateChange(input)
}

export function dedupeExecutionOrderUpdates(
  updates: ExecutionOrderUpdate[]
): ExecutionOrderUpdate[] {
  const byTaskId = new Map<string, ExecutionOrderUpdate>()
  for (const update of updates) {
    byTaskId.set(update.taskId, update)
  }
  return [...byTaskId.values()]
}

export function canMoveExecutionOrder(
  tasks: Task[],
  taskId: string,
  direction: "up" | "down",
  crews: CrewRef[] = []
): boolean {
  return buildExecutionOrderSwapUpdates(tasks, taskId, direction, crews).length > 0
}

export function resolveExecutionOrderMoveAvailability(
  tasks: Task[],
  taskId: string,
  crews: CrewRef[] = []
): { canMoveUp: boolean; canMoveDown: boolean } {
  return {
    canMoveUp:
      buildExecutionOrderSwapUpdates(tasks, taskId, "up", crews).length > 0,
    canMoveDown:
      buildExecutionOrderSwapUpdates(tasks, taskId, "down", crews).length > 0,
  }
}

export function toExecutionOrderPayloadUpdates(
  updates: ExecutionOrderUpdate[]
): Array<{ taskId: string; payload: UpdateTaskPayload }> {
  return updates.map((update) => ({
    taskId: update.taskId,
    payload: { executionOrder: update.executionOrder },
  }))
}

export function parseOperationalOrderInput(
  value: string
): { valid: true; order: number } | { valid: false; message: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { valid: false, message: "Indique el orden operativo." }
  }

  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      valid: false,
      message: "El orden operativo debe ser un entero mayor a cero.",
    }
  }

  return { valid: true, order: parsed }
}

export function resolveOperationalOrderFormDefault(input: {
  task: Task
  crewId: string
  dueDate: string
  allTasks: Task[]
  crews: CrewRef[]
}): string {
  const { task, crewId, dueDate, allTasks, crews } = input
  const existing = resolveOperationalOrderValue(task)

  if (existing != null && existing > 0) {
    return String(Math.floor(existing))
  }

  if (!crewId) {
    return ""
  }

  return String(
    resolveNextOperationalOrderProposal({
      tasks: allTasks,
      dueDate,
      crewId,
      crews,
      excludeTaskId: task.id,
    })
  )
}
