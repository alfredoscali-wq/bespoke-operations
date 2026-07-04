"use client"

import { useCallback } from "react"

import { resolveIncidentReasonLabel } from "@/lib/tasks/incidents"
import {
  canPerformTaskAction,
  getInitialTaskStatus,
  getTransitionForAction,
  type TaskWorkflowAction,
} from "@/lib/tasks/task-status-workflow"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import {
  buildOperationalOrderRemovalUpdates,
  isOperationalOrderReorderable,
  resolveOperationalOrderOnDateChange,
} from "@/lib/planificacion/planning-execution-order"
import {
  buildTaskRescheduleHistoryNote,
  buildTaskRescheduleUpdatePayload,
  validateTaskRescheduleInput,
  type TaskRescheduleInput,
} from "@/lib/tasks/reschedule"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

import type { TaskMutationResult } from "../types"

type UseTasksIncidentsParams = {
  tasks: Task[]
  updateTaskFields: (
    id: string,
    payload: UpdateTaskPayload,
    workflowAction?: TaskWorkflowAction,
    historyNote?: string,
    historyActor?: string,
    auditOptions?: {
      rescheduleInput?: TaskRescheduleInput
      suppressAudit?: boolean
    }
  ) => Promise<TaskMutationResult>
  applyExecutionOrderUpdates: (
    updates: import("@/lib/planificacion/planning-execution-order").ExecutionOrderUpdate[]
  ) => Promise<TaskMutationResult>
}

export function useTasksIncidents({
  tasks,
  updateTaskFields,
  applyExecutionOrderUpdates,
}: UseTasksIncidentsParams) {
  const cancelTask = useCallback(
    async (
      id: string,
      options?: {
        reason: string
        observation: string
        actor?: string
      }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const reason = options?.reason.trim() ?? ""
      const observation = options?.observation.trim() ?? ""

      if (!reason) {
        return { success: false, message: "Indique el motivo de cancelación." }
      }

      if (!observation) {
        return {
          success: false,
          message: "Indique la observación de cancelación.",
        }
      }

      const validation = canPerformTaskAction(task, "cancel")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("cancel")
      const historyNote = [
        `Motivo: ${resolveIncidentReasonLabel(reason)}`,
        `Observación: ${observation}`,
      ].join("\n")

      const crewId = resolveTaskCrewId(task)
      if (crewId && isOperationalOrderReorderable(task)) {
        const orderUpdates = buildOperationalOrderRemovalUpdates({
          tasks,
          dueDate: task.dueDate,
          crewId,
          removedTaskId: id,
          crews: [],
        })

        if (orderUpdates.length > 0) {
          const orderResult = await applyExecutionOrderUpdates(orderUpdates)
          if (!orderResult.success) {
            return orderResult
          }
        }
      }

      return updateTaskFields(
        id,
        {
          status: to,
          cancellationReason: reason,
          cancellationObservation: observation,
        },
        "cancel",
        historyNote,
        options?.actor
      )
    },
    [tasks, updateTaskFields, applyExecutionOrderUpdates]
  )

  const reportTaskIncident = useCallback(
    async (
      id: string,
      input: {
        reason: string
        observation: string
        reportedBy: string
      }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const reason = input.reason.trim()
      const observation = input.observation.trim()
      const reportedBy = input.reportedBy.trim()

      if (!reason) {
        return { success: false, message: "Seleccione un motivo de incidencia." }
      }

      if (!observation) {
        return {
          success: false,
          message: "Describa brevemente la situación.",
        }
      }

      const validation = canPerformTaskAction(task, "report-incident")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("report-incident")
      const historyNote = [
        `Motivo: ${resolveIncidentReasonLabel(reason)}`,
        `Observación: ${observation}`,
      ].join("\n")

      return updateTaskFields(
        id,
        {
          status: to,
          incidentReason: reason,
          incidentObservation: observation,
          incidentReportedAt: new Date().toISOString(),
          incidentReportedBy: reportedBy,
        },
        "report-incident",
        historyNote,
        reportedBy
      )
    },
    [tasks, updateTaskFields]
  )

  const resumeTaskFromIncident = useCallback(
    async (id: string, actor?: string): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, "resume-from-incident")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("resume-from-incident")
      return updateTaskFields(
        id,
        { status: to },
        "resume-from-incident",
        "La orden de trabajo volvió a En curso para continuar la ejecución.",
        actor
      )
    },
    [tasks, updateTaskFields]
  )

  const applyTaskReschedule = useCallback(
    async (
      id: string,
      workflowAction: Extract<
        TaskWorkflowAction,
        "reschedule-from-incident" | "reschedule-from-overdue"
      >,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, workflowAction)
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const scheduleValidation = validateTaskRescheduleInput({
        dueDate: input.dueDate,
        scheduledTime: input.scheduledTime,
        reason: input.reason,
      })

      if (!scheduleValidation.allowed) {
        return {
          success: false,
          message: scheduleValidation.message,
        }
      }

      const rescheduledBy = input.rescheduledBy.trim() || input.actor?.trim() || ""
      if (!rescheduledBy) {
        return {
          success: false,
          message: "No se pudo identificar al usuario que reprograma.",
        }
      }

      const { to } = getTransitionForAction(workflowAction)
      const targetStatus =
        workflowAction === "reschedule-from-overdue"
          ? getInitialTaskStatus({
              crewId: input.crewId ?? task.crewId,
              crew: input.crew ?? task.crew,
            })
          : to
      const rescheduleInput: TaskRescheduleInput = {
        ...input,
        rescheduledBy,
      }
      const updatePayload = buildTaskRescheduleUpdatePayload(
        task,
        rescheduleInput,
        targetStatus
      )

      const nextDueDate = updatePayload.dueDate ?? task.dueDate
      const nextCrewId =
        updatePayload.crewId !== undefined
          ? updatePayload.crewId
          : resolveTaskCrewId(task)

      if (
        nextDueDate !== task.dueDate &&
        nextCrewId &&
        isOperationalOrderReorderable(task)
      ) {
        const orderUpdates = resolveOperationalOrderOnDateChange({
          task,
          newDueDate: nextDueDate,
          allTasks: tasks,
          crews: [],
        })

        if (orderUpdates.length > 0) {
          const orderResult = await applyExecutionOrderUpdates(orderUpdates)
          if (!orderResult.success) {
            return orderResult
          }
        }

        const taskOrderUpdate = orderUpdates.find((update) => update.taskId === id)
        if (taskOrderUpdate) {
          updatePayload.executionOrder = taskOrderUpdate.executionOrder
        }
      }

      return updateTaskFields(
        id,
        updatePayload,
        workflowAction,
        buildTaskRescheduleHistoryNote(rescheduleInput),
        rescheduledBy,
        { rescheduleInput }
      )
    },
    [tasks, updateTaskFields, applyExecutionOrderUpdates]
  )

  const rescheduleTaskFromIncident = useCallback(
    async (
      id: string,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      return applyTaskReschedule(id, "reschedule-from-incident", input)
    },
    [applyTaskReschedule]
  )

  const rescheduleTaskFromOverdue = useCallback(
    async (
      id: string,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      return applyTaskReschedule(id, "reschedule-from-overdue", input)
    },
    [applyTaskReschedule]
  )

  return {
    cancelTask,
    reportTaskIncident,
    resumeTaskFromIncident,
    rescheduleTaskFromIncident,
    rescheduleTaskFromOverdue,
  }
}
