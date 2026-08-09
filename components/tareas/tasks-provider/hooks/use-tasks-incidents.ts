"use client"

import { useCallback } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { resolveProjectTaskRescheduleTargetStatus } from "@/lib/projects/project-task-reschedule"
import {
  assertProjectTaskIncidentResolvePayloadSafe,
  buildProjectTaskIncidentResolvePayload,
  canResolveProjectTaskIncidentFromPlanning,
  formatProjectTaskIncidentResolveHistoryNote,
  type ProjectTaskIncidentResolveInput,
} from "@/lib/projects/project-task-incident-resolve"
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
  clearOperationalOrdersForOverdueReschedule,
  validateTaskRescheduleInput,
  type TaskRescheduleInput,
} from "@/lib/tasks/reschedule"
import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import { resolveOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import {
  buildCancelOperationalEvent,
  buildRescheduleOperationalEvent,
  buildOverdueRescheduleOperationalEvent,
} from "@/lib/tasks/operational-motivos"
import {
  buildIncidentOperationalEvent,
  buildResumedOperationalEvent,
} from "@/lib/tasks/operational-events"
import { recordTaskOperationalEvent } from "@/lib/supabase/operational-control.browser"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

import type { TaskMutationResult } from "../types"

type UseTasksIncidentsParams = {
  companyId: string
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
  companyId,
  tasks,
  updateTaskFields,
  applyExecutionOrderUpdates,
}: UseTasksIncidentsParams) {
  const { sessionUser } = useAuth()

  const resolveActor = useCallback(
    (fallbackDisplayName?: string | null) =>
      resolveOperationalEventActor(sessionUser, fallbackDisplayName),
    [sessionUser]
  )

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

      const validation = canPerformTaskAction(task, "cancel")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("cancel")
      const motivoLabel = resolveIncidentReasonLabel(reason)
      const historyNote = [
        `Motivo: ${motivoLabel}`,
        observation ? `Observación: ${observation}` : null,
      ]
        .filter(Boolean)
        .join("\n")

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

      const actor = resolveActor(options?.actor)
      const result = await updateTaskFields(
        id,
        {
          status: to,
          cancellationReason: reason,
          cancellationObservation: observation,
        },
        "cancel",
        historyNote,
        actor.fullName
      )

      if (result.success && companyId) {
        void recordTaskOperationalEvent(
          buildCancelOperationalEvent({
            companyId,
            task,
            reason,
            observation,
            actor,
            motivoLabel,
          })
        )
      }

      return result
    },
    [
      companyId,
      tasks,
      updateTaskFields,
      applyExecutionOrderUpdates,
      resolveActor,
    ]
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
      const reasonLabel = resolveIncidentReasonLabel(reason)
      const historyNote = [
        `Motivo: ${reasonLabel}`,
        `Observación: ${observation}`,
      ].join("\n")
      const actor = resolveActor(reportedBy)

      const result = await updateTaskFields(
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
        actor.fullName
      )

      if (result.success && companyId) {
        void recordTaskOperationalEvent(
          buildIncidentOperationalEvent({
            companyId,
            task,
            actor,
            reasonLabel,
            observation,
          })
        )
      }

      return result
    },
    [companyId, tasks, updateTaskFields, resolveActor]
  )

  const resumeTaskFromIncident = useCallback(
    async (id: string, actorName?: string): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, "resume-from-incident")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("resume-from-incident")
      const actor = resolveActor(actorName)
      const result = await updateTaskFields(
        id,
        { status: to },
        "resume-from-incident",
        "La orden de trabajo volvió a En curso para continuar la ejecución.",
        actor.fullName
      )

      if (result.success && companyId) {
        void recordTaskOperationalEvent(
          buildResumedOperationalEvent({
            companyId,
            task,
            actor,
          })
        )
      }

      return result
    },
    [companyId, tasks, updateTaskFields, resolveActor]
  )

  const applyTaskReschedule = useCallback(
    async (
      id: string,
      workflowAction: Extract<
        TaskWorkflowAction,
        | "reschedule-from-incident"
        | "reschedule-from-overdue"
        | "reschedule-planning-return"
        | "reschedule-obra"
      >,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (
        workflowAction === "reschedule-planning-return" &&
        !hasActivePlanningReturn(task)
      ) {
        return {
          success: false,
          message: "La orden de trabajo no está marcada como devuelta por planificación.",
        }
      }

      const validation = canPerformTaskAction(task, workflowAction)
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const scheduleValidation = validateTaskRescheduleInput(
        {
          dueDate: input.dueDate,
          scheduledTime: input.scheduledTime,
          reason: input.reason,
        },
        { current: task }
      )

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
        workflowAction === "reschedule-obra"
          ? resolveProjectTaskRescheduleTargetStatus(task)
          : workflowAction === "reschedule-from-overdue"
            ? getInitialTaskStatus({
                crewId: input.crewId ?? task.crewId,
                crew: input.crew ?? task.crew,
              })
            : workflowAction === "reschedule-planning-return"
              ? "programada"
              : to

      // Obra reschedule never changes crew — only schedule fields.
      const rescheduleInput: TaskRescheduleInput =
        workflowAction === "reschedule-obra"
          ? {
              dueDate: input.dueDate,
              scheduledTime: input.scheduledTime,
              reason: input.reason,
              notes: input.notes,
              rescheduledBy,
            }
          : {
              ...input,
              rescheduledBy,
            }
      let updatePayload = buildTaskRescheduleUpdatePayload(
        task,
        rescheduleInput,
        targetStatus
      )

      // Vencida → programada: back to planning queue. Do not keep or reallocate
      // execution_order (unique crew+date+order would block the date change).
      if (workflowAction === "reschedule-from-overdue") {
        updatePayload = clearOperationalOrdersForOverdueReschedule(updatePayload)
      } else {
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

          const taskOrderUpdate = orderUpdates.find(
            (update) => update.taskId === id
          )
          if (taskOrderUpdate) {
            updatePayload.executionOrder = taskOrderUpdate.executionOrder
          }
        }
      }

      const actor = resolveActor(rescheduledBy)
      const historyNote =
        workflowAction === "reschedule-obra"
          ? [
              `Anterior: ${task.dueDate} ${task.scheduledTime?.trim() || "—"}.`,
              buildTaskRescheduleHistoryNote(rescheduleInput),
            ].join(" ")
          : buildTaskRescheduleHistoryNote(rescheduleInput)
      const result = await updateTaskFields(
        id,
        updatePayload,
        workflowAction,
        historyNote,
        actor.fullName,
        { rescheduleInput }
      )

      if (result.success && companyId) {
        void recordTaskOperationalEvent(
          workflowAction === "reschedule-from-overdue"
            ? buildOverdueRescheduleOperationalEvent({
                companyId,
                task,
                reschedule: rescheduleInput,
                actor,
              })
            : buildRescheduleOperationalEvent({
                companyId,
                task,
                reschedule: rescheduleInput,
                actor,
              })
        )
      }

      return result
    },
    [
      companyId,
      tasks,
      updateTaskFields,
      applyExecutionOrderUpdates,
      resolveActor,
    ]
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

  const reschedulePlanningReturnedTask = useCallback(
    async (
      id: string,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      return applyTaskReschedule(id, "reschedule-planning-return", input)
    },
    [applyTaskReschedule]
  )

  const rescheduleProjectTask = useCallback(
    async (
      id: string,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      return applyTaskReschedule(id, "reschedule-obra", input)
    },
    [applyTaskReschedule]
  )

  const resolveProjectTaskIncident = useCallback(
    async (
      id: string,
      input: ProjectTaskIncidentResolveInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (!canResolveProjectTaskIncidentFromPlanning(task)) {
        return {
          success: false,
          message:
            "Solo se pueden resolver incidencias de OT de Obra en estado incidencia.",
        }
      }

      const payload = buildProjectTaskIncidentResolvePayload(task, input)
      if (!assertProjectTaskIncidentResolvePayloadSafe(payload)) {
        return {
          success: false,
          message:
            "La resolución de incidencia de Obra no puede modificar orden de ruta ni identidad de obra.",
        }
      }

      const actor = resolveActor(input.actor)
      const historyNote = formatProjectTaskIncidentResolveHistoryNote(input, {
        actor: actor.fullName,
      })

      if (input.decision === "keep-incident") {
        return updateTaskFields(
          id,
          payload,
          undefined,
          historyNote,
          actor.fullName
        )
      }

      const validation = canPerformTaskAction(task, "resolve-obra-incident")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      return updateTaskFields(
        id,
        payload,
        "resolve-obra-incident",
        historyNote,
        actor.fullName
      )
    },
    [tasks, updateTaskFields, resolveActor]
  )

  return {
    cancelTask,
    reportTaskIncident,
    resumeTaskFromIncident,
    rescheduleTaskFromIncident,
    rescheduleTaskFromOverdue,
    reschedulePlanningReturnedTask,
    rescheduleProjectTask,
    resolveProjectTaskIncident,
  }
}
