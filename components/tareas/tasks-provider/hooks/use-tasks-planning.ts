"use client"

import { useCallback } from "react"

import { buildPlanningConfirmDispatchUpdates } from "@/lib/planificacion/planning-incremental"
import {
  buildCompactExecutionOrderUpdates,
  collectExecutionOrderScopeClearUpdates,
  collectExecutionOrderScopesFromTaskIds,
  mergeExecutionOrderUpdatesIntoTasks,
  type ExecutionOrderUpdate,
} from "@/lib/planificacion/planning-execution-order"
import { filterOperationalOrderScope } from "@/lib/planificacion/planning-operational-order-core"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { canPerformTaskAction } from "@/lib/tasks/task-status-workflow"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

import type { TaskMutationResult } from "../types"

type CrewRef = Pick<Crew, "id" | "name">

function resolveReopenExecutionOrder(
  task: Task,
  tasks: Task[],
  crews: CrewRef[]
): number | null {
  const crewId = resolveTaskCrewId(task, crews)
  if (!crewId) {
    return task.dispatchOrder ?? null
  }

  const scope = filterOperationalOrderScope(tasks, task.dueDate, crewId, crews)
  const taken = new Set(
    scope
      .filter((item) => item.id !== task.id)
      .map((item) =>
        item.status === "programada"
          ? item.executionOrder
          : item.dispatchOrder
      )
      .filter((order): order is number => order != null && order > 0)
      .map((order) => Math.floor(order))
  )

  const preferred = task.dispatchOrder ?? null
  if (preferred != null && !taken.has(Math.floor(preferred))) {
    return Math.floor(preferred)
  }

  let candidate = 1
  while (taken.has(candidate)) {
    candidate += 1
  }

  return candidate
}

type UseTasksPlanningParams = {
  tasks: Task[]
  updateTaskFields: (
    id: string,
    payload: import("@/lib/types/supabase/tasks").UpdateTaskPayload,
    workflowAction?: import("@/lib/tasks/task-status-workflow").TaskWorkflowAction,
    historyNote?: string,
    historyActor?: string,
    auditOptions?: {
      rescheduleInput?: import("@/lib/tasks/reschedule").TaskRescheduleInput
      suppressAudit?: boolean
    }
  ) => Promise<TaskMutationResult>
  applyExecutionOrderUpdates: (
    updates: ExecutionOrderUpdate[],
    crews?: CrewRef[]
  ) => Promise<TaskMutationResult>
}

async function compactExecutionOrderScopes(
  workingTasks: Task[],
  scopes: ReturnType<typeof collectExecutionOrderScopesFromTaskIds>,
  crews: CrewRef[],
  applyExecutionOrderUpdates: UseTasksPlanningParams["applyExecutionOrderUpdates"],
  excludeTaskIds: string[] = []
): Promise<
  | { success: true; tasks: Task[] }
  | { success: false; message: string }
> {
  let nextTasks = workingTasks

  for (const scope of scopes) {
    const updates = buildCompactExecutionOrderUpdates({
      tasks: nextTasks,
      dueDate: scope.dueDate,
      crewId: scope.crewId,
      crews,
      excludeTaskIds,
    })

    if (updates.length === 0) {
      continue
    }

    const result = await applyExecutionOrderUpdates(updates, crews)
    if (!result.success) {
      return { success: false as const, message: result.message ?? "No fue posible actualizar el orden de ejecución." }
    }

    nextTasks = mergeExecutionOrderUpdatesIntoTasks(nextTasks, updates)
  }

  return { success: true, tasks: nextTasks }
}

export function useTasksPlanning({
  tasks,
  updateTaskFields,
  applyExecutionOrderUpdates,
}: UseTasksPlanningParams) {
  const confirmPlanningTasks = useCallback(
    async (
      ids: string[],
      crews: CrewRef[] = []
    ): Promise<TaskMutationResult> => {
      if (ids.length === 0) {
        return {
          success: false,
          message: "No hay órdenes de trabajo programadas para confirmar.",
        }
      }

      for (const id of ids) {
        const task = tasks.find((item) => item.id === id)
        if (!task) {
          return { success: false, message: "Orden de trabajo no encontrada." }
        }

        const validation = canPerformTaskAction(task, "confirm-planning")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }
      }

      const affectedScopes = collectExecutionOrderScopesFromTaskIds(
        tasks,
        ids,
        crews
      )

      const preCompactResult = await compactExecutionOrderScopes(
        tasks,
        affectedScopes,
        crews,
        applyExecutionOrderUpdates
      )

      if (!preCompactResult.success) {
        return preCompactResult
      }

      let workingTasks = preCompactResult.tasks

      const dispatchUpdates = buildPlanningConfirmDispatchUpdates({
        tasks: workingTasks,
        confirmingTaskIds: ids,
        crews,
      })

      if (dispatchUpdates.length !== ids.length) {
        return {
          success: false,
          message:
            "No fue posible calcular el orden operativo para todas las órdenes de trabajo.",
        }
      }

      for (const update of dispatchUpdates) {
        const result = await updateTaskFields(
          update.taskId,
          {
            status: "asignada",
            dispatchOrder: update.dispatchOrder,
            executionOrder: null,
          },
          "confirm-planning",
          "Planificación confirmada para la jornada.",
          undefined,
          { suppressAudit: true }
        )

        if (!result.success) {
          return result
        }

        workingTasks = workingTasks.map((task) =>
          task.id === update.taskId
            ? {
                ...task,
                status: "asignada",
                dispatchOrder: update.dispatchOrder,
                executionOrder: null,
              }
            : task
        )
      }

      const postCompactResult = await compactExecutionOrderScopes(
        workingTasks,
        affectedScopes,
        crews,
        applyExecutionOrderUpdates
      )

      if (!postCompactResult.success) {
        return postCompactResult
      }

      return { success: true }
    },
    [tasks, updateTaskFields, applyExecutionOrderUpdates]
  )

  const reopenPlanningTasks = useCallback(
    async (
      ids: string[],
      crews: CrewRef[] = []
    ): Promise<TaskMutationResult> => {
      if (ids.length === 0) {
        return {
          success: false,
          message: "No hay órdenes de trabajo para reabrir la planificación.",
        }
      }

      for (const id of ids) {
        const task = tasks.find((item) => item.id === id)
        if (!task) {
          return { success: false, message: "Orden de trabajo no encontrada." }
        }

        const validation = canPerformTaskAction(task, "reopen-planning")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }
      }

      const reopenPlans = ids.map((id) => {
        const task = tasks.find((item) => item.id === id)
        if (!task) {
          return null
        }

        return {
          taskId: id,
          executionOrder: resolveReopenExecutionOrder(task, tasks, crews),
        }
      })

      if (reopenPlans.some((plan) => plan == null)) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const scopeClears = collectExecutionOrderScopeClearUpdates(tasks, ids, crews)

      for (const clear of scopeClears) {
        const result = await updateTaskFields(
          clear.taskId,
          { executionOrder: null },
          undefined,
          undefined,
          undefined,
          { suppressAudit: true }
        )

        if (!result.success) {
          return result
        }
      }

      for (const plan of reopenPlans) {
        const result = await updateTaskFields(
          plan!.taskId,
          {
            status: "programada",
            executionOrder: plan!.executionOrder,
            dispatchOrder: null,
          },
          "reopen-planning",
          "Planificación reabierta para replanificación.",
          undefined,
          { suppressAudit: true }
        )

        if (!result.success) {
          return result
        }
      }

      return { success: true }
    },
    [tasks, updateTaskFields]
  )

  return {
    confirmPlanningTasks,
    reopenPlanningTasks,
  }
}
