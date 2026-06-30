import { taskMatchesCrewId, resolveTaskCrewId } from "@/lib/tasks/crew-relation"
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

/**
 * Splits updates into two phases so UNIQUE (due_date, crew_id, execution_order)
 * is never violated during sequential client updates:
 * 1) clear affected rows (NULL is excluded from the unique index)
 * 2) assign final execution_order values
 */
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

function resolveTaskCreatedAtSortKey(task: Pick<Task, "createdAt">): string {
  return task.createdAt ?? ""
}

export function compareTasksForPlanningDisplay(
  left: Task,
  right: Task,
  crews: CrewRef[] = []
): number {
  const leftCrewId = resolveTaskCrewId(left, crews) ?? ""
  const rightCrewId = resolveTaskCrewId(right, crews) ?? ""

  const leftHasOrder = left.executionOrder != null && left.executionOrder > 0
  const rightHasOrder = right.executionOrder != null && right.executionOrder > 0

  if (leftCrewId && leftCrewId === rightCrewId) {
    if (leftHasOrder && rightHasOrder) {
      return left.executionOrder! - right.executionOrder!
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

    return compareTasksForPlanningDisplay(left, right, crews)
  })
}

export function filterTasksInExecutionScope(
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

export function sortTasksInExecutionSequence(
  tasks: Task[],
  crews: CrewRef[] = []
): Task[] {
  return [...tasks].sort((left, right) =>
    compareTasksForPlanningDisplay(left, right, crews)
  )
}

/** Reassign contiguous 1..n for ordered tasks in each crew+date group. Null orders stay null. */
export function recalculateExecutionOrder(
  tasks: Task[],
  crews: CrewRef[] = []
): ExecutionOrderUpdate[] {
  const updates: ExecutionOrderUpdate[] = []
  const groups = new Map<string, Task[]>()

  for (const task of tasks) {
    const crewId = resolveTaskCrewId(task, crews)
    if (!crewId) {
      if (task.executionOrder != null) {
        updates.push({ taskId: task.id, executionOrder: null })
      }
      continue
    }

    const key = `${task.dueDate}::${crewId}`
    const group = groups.get(key) ?? []
    group.push(task)
    groups.set(key, group)
  }

  for (const groupTasks of groups.values()) {
    const orderedTasks = sortTasksInExecutionSequence(groupTasks, crews).filter(
      (task) => task.executionOrder != null && task.executionOrder > 0
    )

    orderedTasks.forEach((task, index) => {
      const nextOrder = index + 1
      if (task.executionOrder !== nextOrder) {
        updates.push({ taskId: task.id, executionOrder: nextOrder })
      }
    })
  }

  return updates
}

export function recalculateExecutionOrderForScope(
  tasks: Task[],
  dueDate: string,
  crewId: string | null | undefined,
  crews: CrewRef[] = [],
  excludeTaskId?: string
): ExecutionOrderUpdate[] {
  if (!crewId) {
    return []
  }

  const scopeTasks = filterTasksInExecutionScope(tasks, dueDate, crewId, crews).filter(
    (task) => task.id !== excludeTaskId
  )

  return recalculateExecutionOrder(scopeTasks, crews)
}

export function resolveExecutionOrderAppendPosition(
  tasks: Task[],
  dueDate: string,
  crewId: string,
  crews: CrewRef[] = [],
  excludeTaskId?: string
): number {
  const mates = filterTasksInExecutionScope(tasks, dueDate, crewId, crews).filter(
    (task) => task.id !== excludeTaskId
  )

  const maxOrder = mates.reduce(
    (max, task) => Math.max(max, task.executionOrder ?? 0),
    0
  )

  return maxOrder + 1
}

export function buildExecutionOrderSwapUpdates(
  tasks: Task[],
  taskId: string,
  direction: "up" | "down",
  crews: CrewRef[] = []
): ExecutionOrderUpdate[] {
  const task = tasks.find((item) => item.id === taskId)
  if (!task) {
    return []
  }

  const crewId = resolveTaskCrewId(task, crews)
  if (!crewId) {
    return []
  }

  const scopeTasks = filterTasksInExecutionScope(
    tasks,
    task.dueDate,
    crewId,
    crews
  )
  const sorted = sortTasksInExecutionSequence(scopeTasks, crews)
  const currentIndex = sorted.findIndex((item) => item.id === taskId)

  if (currentIndex === -1) {
    return []
  }

  const targetIndex =
    direction === "up" ? currentIndex - 1 : currentIndex + 1

  if (targetIndex < 0 || targetIndex >= sorted.length) {
    return []
  }

  const reordered = [...sorted]
  const [moving] = reordered.splice(currentIndex, 1)
  reordered.splice(targetIndex, 0, moving)

  const updates: ExecutionOrderUpdate[] = []

  reordered.forEach((item, index) => {
    const nextOrder = index + 1
    if (item.executionOrder !== nextOrder) {
      updates.push({ taskId: item.id, executionOrder: nextOrder })
    }
  })

  return updates
}

export function resolveExecutionOrderOnCrewChange(input: {
  task: Task
  newCrewId: string | null
  allTasks: Task[]
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  const { task, newCrewId, allTasks, crews } = input
  const previousCrewId = resolveTaskCrewId(task, crews) ?? null
  const updates: ExecutionOrderUpdate[] = []

  if (previousCrewId === newCrewId) {
    return updates
  }

  if (previousCrewId) {
    updates.push(
      ...recalculateExecutionOrderForScope(
        allTasks,
        task.dueDate,
        previousCrewId,
        crews,
        task.id
      )
    )
  }

  if (newCrewId) {
    updates.push({
      taskId: task.id,
      executionOrder: resolveExecutionOrderAppendPosition(
        allTasks,
        task.dueDate,
        newCrewId,
        crews,
        task.id
      ),
    })
  } else {
    updates.push({ taskId: task.id, executionOrder: null })
  }

  return dedupeExecutionOrderUpdates(updates)
}

export function resolveExecutionOrderOnDateChange(input: {
  task: Task
  newDueDate: string
  allTasks: Task[]
  crews: CrewRef[]
}): ExecutionOrderUpdate[] {
  const { task, newDueDate, allTasks, crews } = input
  const crewId = resolveTaskCrewId(task, crews)

  if (!crewId || task.dueDate === newDueDate) {
    return []
  }

  const updates: ExecutionOrderUpdate[] = [
    ...recalculateExecutionOrderForScope(
      allTasks,
      task.dueDate,
      crewId,
      crews,
      task.id
    ),
    {
      taskId: task.id,
      executionOrder: resolveExecutionOrderAppendPosition(
        allTasks,
        newDueDate,
        crewId,
        crews,
        task.id
      ),
    },
  ]

  return dedupeExecutionOrderUpdates(updates)
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
  const task = tasks.find((item) => item.id === taskId)
  if (!task || !resolveTaskCrewId(task, crews)) {
    return { canMoveUp: false, canMoveDown: false }
  }

  const crewId = resolveTaskCrewId(task, crews)!
  const scopeTasks = filterTasksInExecutionScope(
    tasks,
    task.dueDate,
    crewId,
    crews
  )
  const sorted = sortTasksInExecutionSequence(scopeTasks, crews)
  const index = sorted.findIndex((item) => item.id === taskId)

  return {
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < sorted.length - 1,
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
