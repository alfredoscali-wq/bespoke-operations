"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  getTaskDetail,
} from "@/lib/data/tasks"
import {
  createBrowserTasksClient,
  createTask,
  deleteTask as deleteTaskInSupabase,
  listTasks,
  updateTask as updateTaskInSupabase,
} from "@/lib/supabase/tasks.browser"
import { canArchiveTaskByStatus } from "@/lib/tasks/status-groups"
import { TASK_DELETE_USER_MESSAGE, TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE, logOperationError } from "@/lib/operations/user-messages"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import { mapTaskToUpdatePayload } from "@/lib/supabase/tasks.mapper"
import {
  canPerformTaskAction,
  getInitialTaskStatus,
  getTransitionForAction,
  getWorkflowActionForTargetStatus,
  getWorkflowHistoryEntry,
  resolveStatusAfterCrewAssignment,
  type TaskWorkflowAction,
} from "@/lib/tasks/task-status-workflow"
import {
  syncTaskProgress,
} from "@/lib/tasks/utils"
import type { CreateTaskPayload, UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskDetail, TaskStatus } from "@/lib/types/tasks"

type TaskMutationResult = {
  success: boolean
  message?: string
  task?: Task
}

type TasksContextValue = {
  tasks: Task[]
  isTasksReady: boolean
  usesSupabase: boolean
  detailVersion: number
  getTask: (id: string) => Task | undefined
  getDetail: (id: string) => TaskDetail | undefined
  addTask: (input: CreateTaskPayload) => Promise<Task>
  editTask: (id: string, payload: UpdateTaskPayload) => Promise<TaskMutationResult>
  changeTaskStatus: (id: string, targetStatus: TaskStatus) => Promise<TaskMutationResult>
  assignCrew: (
    id: string,
    crewId: string | null,
    crewName?: string,
    supervisor?: string
  ) => Promise<TaskMutationResult>
  deleteTask: (id: string) => Promise<TaskMutationResult>
  startTask: (id: string) => Promise<TaskMutationResult>
  submitTaskForApproval: (id: string) => Promise<TaskMutationResult>
  approveTask: (id: string) => Promise<TaskMutationResult>
  rejectTask: (id: string) => Promise<TaskMutationResult>
  closeTask: (id: string) => Promise<TaskMutationResult>
  cancelTask: (id: string) => Promise<TaskMutationResult>
  toggleChecklistItem: (taskId: string, itemId: string) => void
  addComment: (
    taskId: string,
    content: string,
    author?: string,
    role?: TaskDetail["comments"][number]["role"]
  ) => void
  addEvidence: (
    taskId: string,
    title: string,
    uploadedBy?: string
  ) => void
}

const TasksContext = createContext<TasksContextValue | null>(null)

const detailCache = new Map<string, TaskDetail>()

function cacheDetail(id: string, detail: TaskDetail) {
  detailCache.set(id, detail)
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isTasksReady, setIsTasksReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const [detailVersion, setDetailVersion] = useState(0)
  const usesSupabaseRef = useRef(false)

  useEffect(() => {
    usesSupabaseRef.current = usesSupabase
  }, [usesSupabase])

  useEffect(() => {
    let cancelled = false

    async function loadTasksFromSupabase() {
      try {
        const client = createBrowserTasksClient()
        const result = await listTasks(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          console.error("[TASKS LOAD]", result.error)
          setTasks([])
          setUsesSupabase(false)
          return
        }

        setTasks(result.data)
        setUsesSupabase(true)
      } catch (error) {
        if (!cancelled) {
          console.error("[TASKS LOAD]", error)
          setTasks([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsTasksReady(true)
        }
      }
    }

    void loadTasksFromSupabase()

    return () => {
      cancelled = true
    }
  }, [])

  const persistTaskUpdate = useCallback(async (task: Task) => {
    if (!usesSupabaseRef.current) return

    try {
      const client = createBrowserTasksClient()
      await updateTaskInSupabase(task.id, mapTaskToUpdatePayload(task), client)
    } catch {
      // Keep optimistic local state if persistence fails.
    }
  }, [])

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
      ...(payload.workOrderNumber !== undefined
        ? { workOrderNumber: payload.workOrderNumber ?? undefined }
        : {}),
      ...(payload.estimatedDuration !== undefined
        ? { estimatedDuration: payload.estimatedDuration }
        : {}),
      ...(payload.checklist !== undefined ? { checklist: payload.checklist } : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
    })
  }, [])

  const addTask = useCallback(
    async (input: CreateTaskPayload): Promise<Task> => {
      const status =
        input.status ??
        getInitialTaskStatus({ crewId: input.crewId, crew: input.crew })
      const payload: CreateTaskPayload = {
        ...input,
        status,
      }

      if (!usesSupabase) {
        throw new Error("No fue posible crear la tarea. Intente nuevamente.")
      }

      const client = createBrowserTasksClient()
      const result = await createTask(payload, client)

      if (!result.data) {
        logOperationError("TASK CREATE", result.error)
        throw new Error("No fue posible crear la tarea. Intente nuevamente.")
      }

      cacheDetail(result.data.id, getTaskDetail(result.data))
      setTasks((current) => [result.data!, ...current])
      return result.data
    },
    [usesSupabase]
  )

  const updateTaskFields = useCallback(
    async (
      id: string,
      payload: UpdateTaskPayload,
      workflowAction?: TaskWorkflowAction
    ): Promise<TaskMutationResult> => {
      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Tarea no encontrada." }
      }

      if (!usesSupabase) {
        return {
          success: false,
          message: "No fue posible actualizar la tarea. Intente nuevamente.",
        }
      }

      try {
        const client = createBrowserTasksClient()
        const result = await updateTaskInSupabase(id, payload, client)

        if (result.data) {
          if (workflowAction) {
            const detail = detailCache.get(id) ?? getTaskDetail(result.data)
            const historyEntry = getWorkflowHistoryEntry(workflowAction)

            cacheDetail(id, {
              ...detail,
              history: [
                {
                  id: `h-${Date.now()}`,
                  action: historyEntry.action,
                  description: historyEntry.description,
                  user: "Usuario",
                  timestamp: new Date().toISOString(),
                },
                ...detail.history,
              ],
            })
          }

          setTasks((current) =>
            current.map((item) => (item.id === id ? result.data! : item))
          )
          setDetailVersion((version) => version + 1)
          return { success: true, task: result.data }
        }

        if (result.error) {
          logOperationError("TASK UPDATE", result.error)
        }
      } catch (error) {
        logOperationError("TASK UPDATE", error)
      }

      return {
        success: false,
        message: "No fue posible actualizar la tarea. Intente nuevamente.",
      }
    },
    [tasks, usesSupabase]
  )

  const editTask = useCallback(
    async (id: string, payload: UpdateTaskPayload): Promise<TaskMutationResult> => {
      const { status: _status, ...fieldsOnly } = payload
      return updateTaskFields(id, fieldsOnly)
    },
    [updateTaskFields]
  )

  const applyWorkflowTransition = useCallback(
    async (
      id: string,
      workflowAction: TaskWorkflowAction
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Tarea no encontrada." }
      }

      const validation = canPerformTaskAction(task, workflowAction)
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction(workflowAction)
      return updateTaskFields(id, { status: to }, workflowAction)
    },
    [tasks, updateTaskFields]
  )

  const changeTaskStatus = useCallback(
    async (id: string, targetStatus: TaskStatus): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Tarea no encontrada." }
      }

      if (targetStatus === task.status) {
        return { success: false, message: "La tarea ya está en ese estado." }
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
    (id: string) => applyWorkflowTransition(id, "submit-for-approval"),
    [applyWorkflowTransition]
  )

  const approveTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "approve"),
    [applyWorkflowTransition]
  )

  const rejectTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "reject"),
    [applyWorkflowTransition]
  )

  const closeTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "close"),
    [applyWorkflowTransition]
  )

  const cancelTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "cancel"),
    [applyWorkflowTransition]
  )

  const assignCrew = useCallback(
    async (
      id: string,
      crewId: string | null,
      crewName = "",
      supervisor = ""
    ): Promise<TaskMutationResult> => {
      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Tarea no encontrada." }
      }

      const payload: UpdateTaskPayload = {
        crewId,
        crew: crewName,
        supervisor: crewId ? supervisor : "",
      }

      const nextStatus = resolveStatusAfterCrewAssignment(
        existing.status,
        crewId,
        crewName
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

  const deleteTask = useCallback(
    async (id: string): Promise<TaskMutationResult> => {
      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Tarea no encontrada." }
      }

      logDeleteTrace("provider.deleteTask", {
        entity: "task",
        id,
        code: existing.code,
      })

      if (!canArchiveTaskByStatus(existing.status)) {
        return {
          success: false,
          message: TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE,
        }
      }

      if (!usesSupabase) {
        return { success: false, message: TASK_DELETE_USER_MESSAGE }
      }

      try {
        const client = createBrowserTasksClient()
        const result = await deleteTaskInSupabase(id, client)

        if (result.error) {
          console.error("[TASK DELETE]", result.error)
          return {
            success: false,
            message: result.error.message ?? TASK_DELETE_USER_MESSAGE,
          }
        }
      } catch (error) {
        console.error("[TASK DELETE]", error)
        return {
          success: false,
          message: TASK_DELETE_USER_MESSAGE,
        }
      }

      setTasks((current) => current.filter((item) => item.id !== id))
      detailCache.delete(id)
      setDetailVersion((version) => version + 1)

      return { success: true }
    },
    [tasks, usesSupabase]
  )

  const getTask = useCallback(
    (id: string) => tasks.find((task) => task.id === id),
    [tasks]
  )

  const getDetail = useCallback(
    (id: string) => {
      if (detailCache.has(id)) {
        return detailCache.get(id)
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
    [persistTaskUpdate]
  )

  const addComment = useCallback(
    (
      taskId: string,
      content: string,
      author = "Operario",
      role: TaskDetail["comments"][number]["role"] = "operario"
    ) => {
      const task = tasks.find((item) => item.id === taskId)
      if (!task) return

      const detail = detailCache.get(taskId) ?? getTaskDetail(task)

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
    [tasks]
  )

  const addEvidence = useCallback(
    (taskId: string, title: string, uploadedBy = "Operario") => {
      const task = tasks.find((item) => item.id === taskId)
      if (!task) return

      const detail = detailCache.get(taskId) ?? getTaskDetail(task)

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
    [tasks]
  )

  const value = useMemo(
    () => ({
      tasks,
      isTasksReady,
      usesSupabase,
      detailVersion,
      getTask,
      getDetail,
      addTask,
      editTask,
      changeTaskStatus,
      assignCrew,
      deleteTask,
      startTask,
      submitTaskForApproval,
      approveTask,
      rejectTask,
      closeTask,
      cancelTask,
      toggleChecklistItem,
      addComment,
      addEvidence,
    }),
    [
      tasks,
      isTasksReady,
      usesSupabase,
      detailVersion,
      getTask,
      getDetail,
      addTask,
      editTask,
      changeTaskStatus,
      assignCrew,
      deleteTask,
      startTask,
      submitTaskForApproval,
      approveTask,
      rejectTask,
      closeTask,
      cancelTask,
      toggleChecklistItem,
      addComment,
      addEvidence,
    ]
  )

  return (
    <TasksContext.Provider value={value}>
      {isTasksReady ? children : null}
    </TasksContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TasksContext)
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider")
  }
  return context
}

export { getChecklistProgress } from "@/lib/tasks/utils"
