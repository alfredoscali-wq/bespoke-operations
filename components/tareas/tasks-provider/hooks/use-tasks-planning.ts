"use client"

import { useCallback } from "react"

import { buildPlanningConfirmDispatchUpdates } from "@/lib/planificacion/planning-incremental"
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
}

export function useTasksPlanning({
  tasks,
  updateTaskFields,
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

      const dispatchUpdates = buildPlanningConfirmDispatchUpdates({
        tasks,
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
      }

      return { success: true }
    },
    [tasks, updateTaskFields]
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

        const executionOrder = resolveReopenExecutionOrder(task, tasks, crews)

        const result = await updateTaskFields(
          id,
          {
            status: "programada",
            executionOrder,
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
