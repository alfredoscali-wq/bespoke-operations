"use client"

import { useCallback } from "react"

import {
  blockDemoWrite,
  DEMO_WRITE_BLOCKED_TASK_RESULT,
} from "@/lib/demo/demo-write-block"
import {
  enrichUpdateTaskPayloadWithResolvedLocation,
} from "@/lib/location/client/enrich-task-payload"
import { getTaskDetail } from "@/lib/data/tasks"
import {
  createBrowserTasksClient,
  updateTask as updateTaskInSupabase,
} from "@/lib/supabase/tasks.browser"
import { updateWorkOrderThroughAdminApi } from "@/lib/supabase/tasks-admin-api.client"
import { logOperationError } from "@/lib/operations/user-messages"
import { mapTaskToUpdatePayload } from "@/lib/supabase/tasks.mapper"
import {
  getWorkflowHistoryEntry,
  type TaskWorkflowAction,
} from "@/lib/tasks/task-status-workflow"
import { syncTaskProgress } from "@/lib/tasks/utils"
import { buildExecutionOrderPersistPlan } from "@/lib/planificacion/planning-execution-order"
import type { ExecutionOrderUpdate } from "@/lib/planificacion/planning-execution-order"
import {
  applyVencidaSyncFromApi,
  mergeVencidaStatusIntoTasks,
} from "@/lib/tasks/vencida-sync.client"
import {
  recordTaskMutationAudit,
} from "@/lib/audit/tasks-audit"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"

import { cacheDetail, getCachedDetail } from "../detail-cache"
import type { TaskMutationOptions, TaskMutationResult } from "../types"

type UseTasksUpdateParams = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  usesSupabase: boolean
  usesSupabaseRef: React.MutableRefObject<boolean>
  isReadOnly: boolean
  openRestrictedDialog: () => void
  setDetailVersion: React.Dispatch<React.SetStateAction<number>>
}

export function useTasksUpdate({
  tasks,
  setTasks,
  usesSupabase,
  usesSupabaseRef,
  isReadOnly,
  openRestrictedDialog,
  setDetailVersion,
}: UseTasksUpdateParams) {
  const persistTaskUpdate = useCallback(async (task: Task) => {
    if (!usesSupabaseRef.current) return

    try {
      const client = createBrowserTasksClient()
      await updateTaskInSupabase(task.id, mapTaskToUpdatePayload(task), client)
    } catch {
      // Keep optimistic local state if persistence fails.
    }
  }, [usesSupabaseRef])

  const mergeTaskUpdate = useCallback((task: Task, payload: UpdateTaskPayload): Task => {
    return syncTaskProgress({
      ...task,
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
      ...(payload.supervisor !== undefined
        ? { supervisor: payload.supervisor }
        : {}),
      ...(payload.crew !== undefined ? { crew: payload.crew } : {}),
      ...(payload.crewId !== undefined ? { crewId: payload.crewId ?? undefined } : {}),
      ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
      ...(payload.scheduledTime !== undefined
        ? { scheduledTime: payload.scheduledTime }
        : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.projectId !== undefined
        ? { projectId: payload.projectId ?? undefined }
        : {}),
      ...(payload.projectCode !== undefined
        ? { projectCode: payload.projectCode }
        : {}),
      ...(payload.projectName !== undefined
        ? { projectName: payload.projectName }
        : {}),
      ...(payload.customerCompany !== undefined
        ? { customerCompany: payload.customerCompany ?? undefined }
        : {}),
      ...(payload.customerName !== undefined
        ? { customerName: payload.customerName ?? undefined }
        : {}),
      ...(payload.customerPhone !== undefined
        ? { customerPhone: payload.customerPhone ?? undefined }
        : {}),
      ...(payload.serviceAddress !== undefined
        ? { serviceAddress: payload.serviceAddress ?? undefined }
        : {}),
      ...(payload.latitude !== undefined
        ? { latitude: payload.latitude ?? undefined }
        : {}),
      ...(payload.longitude !== undefined
        ? { longitude: payload.longitude ?? undefined }
        : {}),
      ...(payload.sharedLocation !== undefined
        ? { sharedLocation: payload.sharedLocation ?? undefined }
        : {}),
      ...(payload.observationsForCrew !== undefined
        ? { observationsForCrew: payload.observationsForCrew ?? undefined }
        : {}),
      ...(payload.rejectionReason !== undefined
        ? { rejectionReason: payload.rejectionReason ?? undefined }
        : {}),
      ...(payload.workOrderNumber !== undefined
        ? { workOrderNumber: payload.workOrderNumber ?? undefined }
        : {}),
      ...(payload.estimatedDuration !== undefined
        ? { estimatedDuration: payload.estimatedDuration }
        : {}),
      ...(payload.checklist !== undefined ? { checklist: payload.checklist } : {}),
      ...(payload.operationalSteps !== undefined
        ? { operationalSteps: payload.operationalSteps }
        : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
      ...(payload.contractedPlan !== undefined
        ? { contractedPlan: payload.contractedPlan ?? undefined }
        : {}),
      ...(payload.amountToCollect !== undefined
        ? { amountToCollect: payload.amountToCollect ?? undefined }
        : {}),
      ...(payload.originalScheduledDate !== undefined
        ? { originalScheduledDate: payload.originalScheduledDate ?? undefined }
        : {}),
      ...(payload.originalScheduledTime !== undefined
        ? { originalScheduledTime: payload.originalScheduledTime ?? undefined }
        : {}),
      ...(payload.rescheduledBy !== undefined
        ? { rescheduledBy: payload.rescheduledBy ?? undefined }
        : {}),
      ...(payload.rescheduledAt !== undefined
        ? { rescheduledAt: payload.rescheduledAt ?? undefined }
        : {}),
      ...(payload.rescheduleReason !== undefined
        ? { rescheduleReason: payload.rescheduleReason ?? undefined }
        : {}),
      ...(payload.rescheduleNotes !== undefined
        ? { rescheduleNotes: payload.rescheduleNotes ?? undefined }
        : {}),
    })
  }, [])

  const updateTaskFields = useCallback(
    async (
      id: string,
      payload: UpdateTaskPayload,
      workflowAction?: TaskWorkflowAction,
      historyNote?: string,
      historyActor?: string,
      auditOptions?: {
        rescheduleInput?: TaskRescheduleInput
        suppressAudit?: boolean
      }
    ): Promise<TaskMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_TASK_RESULT
      }

      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (!usesSupabase) {
        return {
          success: false,
          message: "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
        }
      }

      try {
        const client = createBrowserTasksClient()
        const enrichedPayload =
          await enrichUpdateTaskPayloadWithResolvedLocation(payload)
        const result = await updateTaskInSupabase(id, enrichedPayload, client)

        if (result.data) {
          if (!auditOptions?.suppressAudit) {
            recordTaskMutationAudit({
              before: existing,
              after: result.data,
              payload: enrichedPayload,
              workflowAction,
              rescheduleInput: auditOptions?.rescheduleInput,
            })
          }

          if (workflowAction) {
            const detail = getCachedDetail(id) ?? getTaskDetail(result.data)
            const historyEntry = getWorkflowHistoryEntry(
              workflowAction,
              historyNote
            )

            cacheDetail(id, {
              ...detail,
              history: [
                {
                  id: `h-${Date.now()}`,
                  action: historyEntry.action,
                  description: historyEntry.description,
                  user: historyActor?.trim() || "Usuario",
                  timestamp: new Date().toISOString(),
                },
                ...detail.history,
              ],
            })
          }

          setTasks((current) => {
            const next = current.map((item) =>
              item.id === id ? result.data! : item
            )
            if (payload.dueDate !== undefined) {
              void applyVencidaSyncFromApi(next).then((syncedTasks) => {
                setTasks((latest) =>
                  mergeVencidaStatusIntoTasks(latest, syncedTasks)
                )
              })
            }
            return next
          })
          setDetailVersion((version) => version + 1)
          return { success: true, task: result.data }
        }

        if (result.error) {
          logOperationError("TASK UPDATE", result.error)
          return {
            success: false,
            message: result.error.message,
          }
        }
      } catch (error) {
        logOperationError("TASK UPDATE", error)
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
        }
      }

      return {
        success: false,
        message: "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
      }
    },
    [tasks, usesSupabase, isReadOnly, openRestrictedDialog, setDetailVersion, setTasks]
  )

  const editTask = useCallback(
    async (
      id: string,
      payload: UpdateTaskPayload,
      options?: TaskMutationOptions
    ): Promise<TaskMutationResult> => {
      const { status: _status, ...fieldsOnly } = payload

      if (options?.administration) {
        if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
          return DEMO_WRITE_BLOCKED_TASK_RESULT
        }

        const existing = tasks.find((item) => item.id === id)
        if (!existing) {
          return { success: false, message: "Orden de trabajo no encontrada." }
        }

        if (!usesSupabase) {
          return {
            success: false,
            message:
              "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
          }
        }

        try {
          const enrichedPayload =
            await enrichUpdateTaskPayloadWithResolvedLocation(fieldsOnly)
          const updatedTask = await updateWorkOrderThroughAdminApi(
            id,
            enrichedPayload
          )

          recordTaskMutationAudit({
            before: existing,
            after: updatedTask,
            payload: enrichedPayload,
          })

          setTasks((current) => {
            const next = current.map((item) =>
              item.id === id ? updatedTask : item
            )
            if (enrichedPayload.dueDate !== undefined) {
              void applyVencidaSyncFromApi(next).then((syncedTasks) => {
                setTasks((latest) =>
                  mergeVencidaStatusIntoTasks(latest, syncedTasks)
                )
              })
            }
            return next
          })
          setDetailVersion((version) => version + 1)
          return { success: true, task: updatedTask }
        } catch (error) {
          logOperationError("TASK ADMIN UPDATE", error)
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
          }
        }
      }

      return updateTaskFields(id, fieldsOnly)
    },
    [
      tasks,
      usesSupabase,
      isReadOnly,
      openRestrictedDialog,
      updateTaskFields,
      setDetailVersion,
      setTasks,
    ]
  )

  const applyExecutionOrderUpdates = useCallback(
    async (updates: ExecutionOrderUpdate[]): Promise<TaskMutationResult> => {
      const plan = buildExecutionOrderPersistPlan(updates, tasks)

      for (const phase of plan.phases) {
        for (const update of phase) {
          const result = await editTask(update.taskId, {
            executionOrder: update.executionOrder,
          })

          if (!result.success) {
            return result
          }
        }
      }

      return { success: true }
    },
    [tasks, editTask]
  )

  return {
    persistTaskUpdate,
    mergeTaskUpdate,
    updateTaskFields,
    editTask,
    applyExecutionOrderUpdates,
  }
}
