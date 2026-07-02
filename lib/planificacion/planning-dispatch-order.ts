import {
  buildOperationalOrderFieldUpdates,
  filterOperationalOrderScope,
  resolveNextOperationalOrderProposal,
  resolveOperationalOrderValue,
  sortOperationalOrderScope,
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
  const scope = filterOperationalOrderScope(tasks, dueDate, crewId, crews)

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

function applyDispatchUpdatesToTasks(
  tasks: Task[],
  updates: DispatchOrderUpdate[]
): Task[] {
  if (updates.length === 0) {
    return tasks
  }

  const byTaskId = new Map(updates.map((update) => [update.taskId, update]))

  return tasks.map((task) => {
    const update = byTaskId.get(task.id)
    if (!update) {
      return task
    }

    return {
      ...task,
      dispatchOrder: update.dispatchOrder ?? undefined,
    }
  })
}

export function buildDispatchOrderConfirmUpdates(
  tasks: Task[],
  taskIds: string[],
  crews: CrewRef[] = []
): DispatchOrderUpdate[] {
  const idSet = new Set(taskIds)
  const scoped = tasks.filter((task) => idSet.has(task.id))
  const groups = new Map<string, Task[]>()

  for (const task of scoped) {
    const crewId = resolveTaskCrewId(task, crews)
    if (!crewId) {
      continue
    }

    const key = `${task.dueDate}::${crewId}`
    const bucket = groups.get(key) ?? []
    bucket.push(task)
    groups.set(key, bucket)
  }

  const updates: DispatchOrderUpdate[] = []
  let virtualTasks = tasks

  for (const [key, confirmingTasks] of groups) {
    const [dueDate, crewId] = key.split("::")
    const orderedConfirming = sortOperationalOrderScope(confirmingTasks, crews)

    for (const confirmingTask of orderedConfirming) {
      const desiredOrder =
        resolveOperationalOrderValue(confirmingTask) ??
        resolveNextOperationalOrderProposal({
          tasks: virtualTasks,
          dueDate: dueDate!,
          crewId: crewId!,
          crews,
          excludeTaskId: confirmingTask.id,
        })

      const stepUpdates = buildDispatchOrderAssignmentUpdates({
        tasks: virtualTasks,
        dueDate: dueDate!,
        crewId: crewId!,
        taskId: confirmingTask.id,
        desiredOrder,
        crews,
      })

      updates.push(...stepUpdates)
      virtualTasks = applyDispatchUpdatesToTasks(virtualTasks, stepUpdates)
    }
  }

  for (const task of scoped) {
    if (!resolveTaskCrewId(task, crews) && task.dispatchOrder != null) {
      updates.push({ taskId: task.id, dispatchOrder: null })
    }
  }

  return dedupeDispatchOrderUpdates(updates)
}
