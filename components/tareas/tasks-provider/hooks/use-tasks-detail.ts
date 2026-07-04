"use client"

import { useCallback } from "react"

import { blockDemoWrite } from "@/lib/demo/demo-write-block"
import { getTaskDetail } from "@/lib/data/tasks"
import { getOperationalStepPhotoCounts } from "@/lib/supabase/task-photos.browser"
import {
  getOperationalStepsProgress,
  hasOperationalSteps,
  syncOperationalStepsWithPhotoCounts,
} from "@/lib/operational-steps/utils"
import { syncTaskProgress } from "@/lib/tasks/utils"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskDetail } from "@/lib/types/tasks"
import type { TaskWorkflowAction } from "@/lib/tasks/task-status-workflow"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"

import {
  cacheDetail,
  getCachedDetail,
  hasCachedDetail,
} from "../detail-cache"
import type { TaskMutationResult } from "../types"

type UseTasksDetailParams = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  isReadOnly: boolean
  openRestrictedDialog: () => void
  setDetailVersion: React.Dispatch<React.SetStateAction<number>>
  persistTaskUpdate: (task: Task) => Promise<void>
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
}

export function useTasksDetail({
  tasks,
  setTasks,
  isReadOnly,
  openRestrictedDialog,
  setDetailVersion,
  persistTaskUpdate,
  updateTaskFields,
}: UseTasksDetailParams) {
  const getTask = useCallback(
    (id: string) => tasks.find((task) => task.id === id),
    [tasks]
  )

  const getDetail = useCallback(
    (id: string) => {
      if (hasCachedDetail(id)) {
        return getCachedDetail(id)
      }

      const task = tasks.find((item) => item.id === id)
      if (!task) return undefined

      const detail = getTaskDetail(task)
      cacheDetail(id, detail)
      return detail
    },
    [tasks]
  )

  const toggleChecklistItem = useCallback(
    (taskId: string, itemId: string) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return
      }

      let updatedTask: Task | undefined

      setTasks((current) =>
        current.map((task) => {
          if (task.id !== taskId) return task

          const checklist = task.checklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          )

          updatedTask = syncTaskProgress({ ...task, checklist })
          return updatedTask
        })
      )

      if (updatedTask) {
        void persistTaskUpdate(updatedTask)
      }
    },
    [persistTaskUpdate, isReadOnly, openRestrictedDialog, setTasks]
  )

  const syncOperationalStepsProgress = useCallback(
    async (taskId: string, stepPhotoCounts: Record<string, number>) => {
      const task = tasks.find((item) => item.id === taskId)
      if (!task || !hasOperationalSteps(task)) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const operationalSteps = syncOperationalStepsWithPhotoCounts(
        task.operationalSteps ?? [],
        stepPhotoCounts
      )
      const progress = getOperationalStepsProgress(
        operationalSteps,
        stepPhotoCounts
      )

      return updateTaskFields(taskId, { operationalSteps, progress })
    },
    [tasks, updateTaskFields]
  )

  const updateOperationalStepObservation = useCallback(
    async (taskId: string, stepId: string, observation: string) => {
      const task = tasks.find((item) => item.id === taskId)
      if (!task || !hasOperationalSteps(task)) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const withObservation = (task.operationalSteps ?? []).map((step) =>
        step.id === stepId ? { ...step, observation } : step
      )

      const stepCountsResult = await getOperationalStepPhotoCounts(taskId)
      const stepPhotoCounts = stepCountsResult.data ?? {}

      const operationalSteps = syncOperationalStepsWithPhotoCounts(
        withObservation,
        stepPhotoCounts
      )
      const progress = getOperationalStepsProgress(
        operationalSteps,
        stepPhotoCounts
      )

      return updateTaskFields(taskId, { operationalSteps, progress })
    },
    [tasks, updateTaskFields]
  )

  const addComment = useCallback(
    (
      taskId: string,
      content: string,
      author = "Operario",
      role: TaskDetail["comments"][number]["role"] = "operario"
    ) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return
      }

      const task = tasks.find((item) => item.id === taskId)
      if (!task) return

      const detail = getCachedDetail(taskId) ?? getTaskDetail(task)

      cacheDetail(taskId, {
        ...detail,
        comments: [
          ...detail.comments,
          {
            id: `cm-${Date.now()}`,
            author,
            role,
            content,
            timestamp: new Date().toISOString(),
          },
        ],
      })
      setDetailVersion((version) => version + 1)
    },
    [tasks, isReadOnly, openRestrictedDialog, setDetailVersion]
  )

  const addEvidence = useCallback(
    (taskId: string, title: string, uploadedBy = "Operario") => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return
      }

      const task = tasks.find((item) => item.id === taskId)
      if (!task) return

      const detail = getCachedDetail(taskId) ?? getTaskDetail(task)

      cacheDetail(taskId, {
        ...detail,
        evidence: [
          {
            id: `ev-${Date.now()}`,
            title,
            type: "photo",
            uploadedBy,
            uploadedAt: new Date().toISOString(),
          },
          ...detail.evidence,
        ],
        history: [
          {
            id: `h-${Date.now()}`,
            action: "Foto cargada",
            description: title,
            user: uploadedBy,
            timestamp: new Date().toISOString(),
          },
          ...detail.history,
        ],
      })
      setDetailVersion((version) => version + 1)
    },
    [tasks, isReadOnly, openRestrictedDialog, setDetailVersion]
  )

  return {
    getTask,
    getDetail,
    toggleChecklistItem,
    syncOperationalStepsProgress,
    updateOperationalStepObservation,
    addComment,
    addEvidence,
  }
}
