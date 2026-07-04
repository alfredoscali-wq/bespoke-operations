"use client"

import { useCallback } from "react"

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
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskStatus } from "@/lib/types/tasks"

import type { TaskMutationResult } from "../types"

type UseTasksWorkflowParams = {
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
  tasks,
  updateTaskFields,
}: UseTasksWorkflowParams) {
  const applyWorkflowTransition = useCallback(
    async (
      id: string,
      workflowAction: TaskWorkflowAction,
      options?: {
        evidenceCount?: number
        stepPhotoCounts?: Record<string, number>
        historyNote?: string
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

      if (
        workflowAction === "submit-for-approval" ||
        workflowAction === "approve"
      ) {
        fields.rejectionReason = ""
      }

      return updateTaskFields(
        id,
        fields,
        workflowAction,
        options?.historyNote
      )
    },
    [tasks, updateTaskFields]
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
    async (id: string) => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (hasOperationalSteps(task)) {
        const stepCountsResult = await getOperationalStepPhotoCounts(id)
        const stepPhotoCounts = stepCountsResult.data ?? {}

        return applyWorkflowTransition(id, "submit-for-approval", {
          stepPhotoCounts,
        })
      }

      const evidenceResult = await getTaskEvidencePhotoCount(id)
      const evidenceCount = evidenceResult.data ?? 0

      return applyWorkflowTransition(id, "submit-for-approval", {
        evidenceCount,
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
      return updateTaskFields(
        id,
        { status: to, rejectionReason: trimmedReason },
        "reject",
        `Motivo: ${trimmedReason}`
      )
    },
    [tasks, updateTaskFields]
  )

  const closeTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "close"),
    [applyWorkflowTransition]
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

      const nextStatus = resolveStatusAfterCrewAssignment(
        existing.status,
        crewId,
        crewName,
        options
      )

      if (nextStatus) {
        const validation = canPerformTaskAction(existing, "assign-crew")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }

        return updateTaskFields(
          id,
          { ...payload, status: nextStatus },
          "assign-crew"
        )
      }

      return updateTaskFields(id, payload)
    },
    [tasks, updateTaskFields]
  )

  return {
    changeTaskStatus,
    startTask,
    submitTaskForApproval,
    approveTask,
    rejectTask,
    closeTask,
    assignCrew,
  }
}
