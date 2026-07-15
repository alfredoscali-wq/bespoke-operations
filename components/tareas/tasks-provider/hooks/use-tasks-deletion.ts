"use client"

import { useCallback } from "react"

import {
  blockDemoWrite,
  DEMO_WRITE_BLOCKED_TASK_RESULT,
} from "@/lib/demo/demo-write-block"
import {
  buildCompactExecutionOrderUpdates,
} from "@/lib/planificacion/planning-execution-order"
import {
  createBrowserTasksClient,
  deleteTask as deleteTaskInSupabase,
} from "@/lib/supabase/tasks.browser"
import { deleteWorkOrderThroughAdminApi } from "@/lib/supabase/tasks-admin-api.client"
import {
  canSoftDeleteWorkOrder,
  WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { recordTaskDeleteAudit } from "@/lib/audit/tasks-audit"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

import { deleteCachedDetail } from "../detail-cache"
import type { TaskMutationOptions, TaskMutationResult } from "../types"

type UseTasksDeletionParams = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  usesSupabase: boolean
  isReadOnly: boolean
  openRestrictedDialog: () => void
  setDetailVersion: React.Dispatch<React.SetStateAction<number>>
  applyExecutionOrderUpdates: (
    updates: import("@/lib/planificacion/planning-execution-order").ExecutionOrderUpdate[]
  ) => Promise<TaskMutationResult>
}

export function useTasksDeletion({
  tasks,
  setTasks,
  usesSupabase,
  isReadOnly,
  openRestrictedDialog,
  setDetailVersion,
  applyExecutionOrderUpdates,
}: UseTasksDeletionParams) {
  const deleteTask = useCallback(
    async (
      id: string,
      options?: TaskMutationOptions
    ): Promise<TaskMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_TASK_RESULT
      }

      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const originCrewId = resolveTaskCrewId(existing)?.trim() || null
      const originDueDate = existing.dueDate?.trim() || null
      const shouldCompactOrigin =
        existing.status === "programada" && Boolean(originCrewId && originDueDate)

      if (options?.administration) {
        if (!usesSupabase) {
          return { success: false, message: TASK_DELETE_USER_MESSAGE }
        }

        try {
          await deleteWorkOrderThroughAdminApi(id)
        } catch (error) {
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : TASK_DELETE_USER_MESSAGE,
          }
        }

        setTasks((current) => current.filter((item) => item.id !== id))
        deleteCachedDetail(id)
        setDetailVersion((version) => version + 1)
        recordTaskDeleteAudit(existing, { administration: true })

        return { success: true }
      }

      if (!canSoftDeleteWorkOrder(existing.status)) {
        return {
          success: false,
          message: WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
        }
      }

      if (!usesSupabase) {
        return { success: false, message: TASK_DELETE_USER_MESSAGE }
      }

      try {
        const client = createBrowserTasksClient()
        const result = await deleteTaskInSupabase(id, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message ?? TASK_DELETE_USER_MESSAGE,
          }
        }
      } catch {
        return {
          success: false,
          message: TASK_DELETE_USER_MESSAGE,
        }
      }

      const remainingTasks = tasks.filter((item) => item.id !== id)

      if (shouldCompactOrigin && originCrewId && originDueDate) {
        const compactUpdates = buildCompactExecutionOrderUpdates({
          tasks: remainingTasks,
          dueDate: originDueDate,
          crewId: originCrewId,
        })

        if (compactUpdates.length > 0) {
          const compactResult = await applyExecutionOrderUpdates(compactUpdates)
          if (!compactResult.success) {
            return compactResult
          }
        }
      }

      setTasks((current) => current.filter((item) => item.id !== id))
      deleteCachedDetail(id)
      setDetailVersion((version) => version + 1)
      recordTaskDeleteAudit(existing)

      return { success: true }
    },
    [
      tasks,
      usesSupabase,
      isReadOnly,
      openRestrictedDialog,
      setDetailVersion,
      setTasks,
      applyExecutionOrderUpdates,
    ]
  )

  const removeTaskLocally = useCallback((id: string) => {
    setTasks((current) => current.filter((item) => item.id !== id))
    deleteCachedDetail(id)
    setDetailVersion((version) => version + 1)
  }, [setDetailVersion, setTasks])

  const removeTasksByCustomerId = useCallback((customerId: string) => {
    setTasks((current) => {
      for (const task of current) {
        if (task.customerId === customerId) {
          deleteCachedDetail(task.id)
        }
      }

      return current.filter((item) => item.customerId !== customerId)
    })
    setDetailVersion((version) => version + 1)
  }, [setDetailVersion, setTasks])

  return {
    deleteTask,
    removeTaskLocally,
    removeTasksByCustomerId,
  }
}
