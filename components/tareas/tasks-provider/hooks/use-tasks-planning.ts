"use client"

import { useCallback } from "react"

import { buildPlanningConfirmDispatchUpdates } from "@/lib/planificacion/planning-incremental"
import { canPerformTaskAction } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"

import type { TaskMutationResult } from "../types"

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
    async (ids: string[]): Promise<TaskMutationResult> => {
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
    async (ids: string[]): Promise<TaskMutationResult> => {
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

        const dispatchOrder = task.dispatchOrder ?? null

        const result = await updateTaskFields(
          id,
          {
            status: "programada",
            executionOrder: dispatchOrder,
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
