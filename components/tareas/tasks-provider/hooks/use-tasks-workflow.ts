"use client"

import { useCallback } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { getTaskEvidencePhotoCount, getOperationalStepPhotoCounts } from "@/lib/supabase/task-photos.browser"
import {
  canPerformTaskAction,
  getTransitionForAction,
  getWorkflowActionForTargetStatus,
  resolveStatusAfterCrewAssignment,
  type TaskWorkflowAction,
} from "@/lib/tasks/task-status-workflow"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import { applyWorkOrderApprovalEffects } from "@/lib/tasks/work-order-approval-effects"
import {
  mergeTrabajoRealizadoIntoMetadata,
  validateTrabajoRealizado,
} from "@/lib/tasks/trabajo-realizado"
import { resolveOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import {
  buildApprovedOperationalEvent,
  buildAssignedOperationalEvent,
  buildChecklistCompletedOperationalEvent,
  buildPendingClosureOperationalEvent,
  buildRejectedOperationalEvent,
  buildStartedOperationalEvent,
  buildTrabajoRealizadoOperationalEvent,
} from "@/lib/tasks/operational-events"
import { recordTaskOperationalEvent } from "@/lib/supabase/operational-control.browser"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskStatus } from "@/lib/types/tasks"

import type { TaskMutationResult } from "../types"

type UseTasksWorkflowParams = {
  companyId: string
  tasks: Task[]
  updateTaskFields: (
    id: string,
    payload: UpdateTaskPayload,
    workflowAction?: TaskWorkflowAction,
    historyNote?: string,
    historyActor?: string,
    auditOptions?: {
      rescheduleInput?: import("@/lib/tasks/reschedule").TaskRescheduleInput
      suppressAudit?: boolean
    }
  ) => Promise<TaskMutationResult>
}

export function useTasksWorkflow({
  companyId,
  tasks,
  updateTaskFields,
}: UseTasksWorkflowParams) {
  const { sessionUser } = useAuth()

  const resolveActor = useCallback(
    () => resolveOperationalEventActor(sessionUser),
    [sessionUser]
  )

  const applyWorkflowTransition = useCallback(
    async (
      id: string,
      workflowAction: TaskWorkflowAction,
      options?: {
        evidenceCount?: number
        stepPhotoCounts?: Record<string, number>
        historyNote?: string
        trabajoRealizado?: string
      }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, workflowAction, {
        evidenceCount: options?.evidenceCount,
        stepPhotoCounts: options?.stepPhotoCounts,
      })
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction(workflowAction)
      const fields: UpdateTaskPayload = { status: to }
      const actor = resolveActor()

      if (
        workflowAction === "submit-for-approval" ||
        workflowAction === "approve"
      ) {
        fields.rejectionReason = ""
      }

      if (workflowAction === "submit-for-approval") {
        const trabajoValidation = validateTrabajoRealizado(
          options?.trabajoRealizado
        )
        if (!trabajoValidation.ok) {
          return { success: false, message: trabajoValidation.message }
        }

        fields.taskMetadata = mergeTrabajoRealizadoIntoMetadata(
          task.taskMetadata,
          trabajoValidation.value
        )
      }

      const result = await updateTaskFields(
        id,
        fields,
        workflowAction,
        options?.historyNote,
        actor.fullName
      )

      if (result.success && companyId) {
        if (workflowAction === "start") {
          void recordTaskOperationalEvent(
            buildStartedOperationalEvent({ companyId, task, actor, source: "web" })
          )
        } else if (workflowAction === "submit-for-approval") {
          void recordTaskOperationalEvent(
            buildChecklistCompletedOperationalEvent({
              companyId,
              task,
              actor,
              source: "web",
            })
          )
          if (options?.trabajoRealizado?.trim()) {
            void recordTaskOperationalEvent(
              buildTrabajoRealizadoOperationalEvent({
                companyId,
                task,
                actor,
                trabajoRealizado: options.trabajoRealizado,
                source: "web",
              })
            )
          }
          void recordTaskOperationalEvent(
            buildPendingClosureOperationalEvent({
              companyId,
              task,
              actor,
              source: "web",
            })
          )
        } else if (workflowAction === "approve") {
          void recordTaskOperationalEvent(
            buildApprovedOperationalEvent({ companyId, task, actor })
          )
        }
      }

      return result
    },
    [companyId, tasks, updateTaskFields, resolveActor]
  )

  const changeTaskStatus = useCallback(
    async (id: string, targetStatus: TaskStatus): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (targetStatus === task.status) {
        return { success: false, message: "La orden de trabajo ya está en ese estado." }
      }

      const action = getWorkflowActionForTargetStatus(task.status, targetStatus)
      if (!action) {
        return { success: false, message: "Transición no permitida." }
      }

      return applyWorkflowTransition(id, action)
    },
    [tasks, applyWorkflowTransition]
  )

  const startTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "start"),
    [applyWorkflowTransition]
  )

  const submitTaskForApproval = useCallback(
    async (id: string, options?: { trabajoRealizado?: string }) => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (hasOperationalSteps(task)) {
        const stepCountsResult = await getOperationalStepPhotoCounts(id)
        const stepPhotoCounts = stepCountsResult.data ?? {}

        return applyWorkflowTransition(id, "submit-for-approval", {
          stepPhotoCounts,
          trabajoRealizado: options?.trabajoRealizado,
        })
      }

      const evidenceResult = await getTaskEvidencePhotoCount(id)
      const evidenceCount = evidenceResult.data ?? 0

      return applyWorkflowTransition(id, "submit-for-approval", {
        evidenceCount,
        trabajoRealizado: options?.trabajoRealizado,
      })
    },
    [tasks, applyWorkflowTransition]
  )

  const approveTask = useCallback(
    async (id: string): Promise<TaskMutationResult> => {
      const result = await applyWorkflowTransition(id, "approve")

      if (result.success && result.task) {
        await applyWorkOrderApprovalEffects(result.task)
      }

      return result
    },
    [applyWorkflowTransition]
  )

  const rejectTask = useCallback(
    async (id: string, reason: string) => {
      const trimmedReason = reason.trim()
      if (!trimmedReason) {
        return {
          success: false,
          message: "Indique el motivo de rechazo.",
        }
      }

      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, "reject")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("reject")
      const actor = resolveActor()
      const result = await updateTaskFields(
        id,
        { status: to, rejectionReason: trimmedReason },
        "reject",
        `Motivo: ${trimmedReason}`,
        actor.fullName
      )

      if (result.success && companyId) {
        void recordTaskOperationalEvent(
          buildRejectedOperationalEvent({
            companyId,
            task,
            actor,
            reason: trimmedReason,
          })
        )
      }

      return result
    },
    [companyId, tasks, updateTaskFields, resolveActor]
  )

  const assignCrew = useCallback(
    async (
      id: string,
      crewId: string | null,
      crewName = "",
      supervisor = "",
      options?: { promoteToAssigned?: boolean }
    ): Promise<TaskMutationResult> => {
      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const payload: UpdateTaskPayload = {
        crewId,
        crew: crewName,
        supervisor: crewId ? supervisor : "",
      }
      const actor = resolveActor()

      const nextStatus = resolveStatusAfterCrewAssignment(
        existing.status,
        crewId,
        crewName,
        options
      )

      let result: TaskMutationResult

      if (nextStatus) {
        const validation = canPerformTaskAction(existing, "assign-crew")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }

        result = await updateTaskFields(
          id,
          { ...payload, status: nextStatus },
          "assign-crew",
          undefined,
          actor.fullName
        )
      } else {
        result = await updateTaskFields(
          id,
          payload,
          undefined,
          undefined,
          actor.fullName
        )
      }

      if (result.success && companyId && crewId) {
        void recordTaskOperationalEvent(
          buildAssignedOperationalEvent({
            companyId,
            task: existing,
            actor,
            crewName,
            supervisor,
          })
        )
      }

      return result
    },
    [companyId, tasks, updateTaskFields, resolveActor]
  )

  return {
    changeTaskStatus,
    startTask,
    submitTaskForApproval,
    approveTask,
    rejectTask,
    assignCrew,
  }
}
