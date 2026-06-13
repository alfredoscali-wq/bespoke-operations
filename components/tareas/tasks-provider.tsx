"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { getTaskDetail, mockTasks } from "@/lib/data/tasks"
import {
  canMoveToStatus,
  getChecklistProgress,
  syncTaskProgress,
} from "@/lib/tasks/utils"
import type { Task, TaskDetail, TaskStatus } from "@/lib/types/tasks"

type UpdateStatusResult = {
  success: boolean
  message?: string
}

type TasksContextValue = {
  tasks: Task[]
  detailVersion: number
  getTask: (id: string) => Task | undefined
  getDetail: (id: string) => TaskDetail | undefined
  updateTaskStatus: (id: string, status: TaskStatus) => UpdateStatusResult
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
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [detailVersion, setDetailVersion] = useState(0)

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

  const updateTaskStatus = useCallback(
    (id: string, status: TaskStatus): UpdateStatusResult => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Tarea no encontrada." }
      }

      const validation = canMoveToStatus(task, status)
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === id ? syncTaskProgress({ ...item, status }) : item
        )
      )

      const detail = detailCache.get(id)
      if (detail) {
        const statusLabels: Record<TaskStatus, string> = {
          pendiente: "Pendiente",
          asignada: "Asignada",
          "en-curso": "En Curso",
          finalizada: "Finalizada",
          "en-aprobacion": "En Aprobación",
          cerrada: "Cerrada",
        }

        cacheDetail(id, {
          ...detail,
          history: [
            {
              id: `h-${Date.now()}`,
              action: "Estado actualizado",
              description: `Estado cambiado a ${statusLabels[status]}.`,
              user: "Usuario",
              timestamp: new Date().toISOString(),
            },
            ...detail.history,
          ],
        })
        setDetailVersion((version) => version + 1)
      }

      return { success: true }
    },
    [tasks]
  )

  const toggleChecklistItem = useCallback((taskId: string, itemId: string) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task

        const checklist = task.checklist.map((item) =>
          item.id === itemId ? { ...item, completed: !item.completed } : item
        )

        return syncTaskProgress({ ...task, checklist })
      })
    )
  }, [])

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
      detailVersion,
      getTask,
      getDetail,
      updateTaskStatus,
      toggleChecklistItem,
      addComment,
      addEvidence,
    }),
    [tasks, detailVersion, getTask, getDetail, updateTaskStatus, toggleChecklistItem, addComment, addEvidence]
  )

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TasksContext)
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider")
  }
  return context
}

export { getChecklistProgress }
