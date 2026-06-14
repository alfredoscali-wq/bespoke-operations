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
  createTaskFromInput,
  getTaskDetail,
  mockTasks,
} from "@/lib/data/tasks"
import {
  createBrowserTasksClient,
  createTask,
  listTasks,
  updateTask,
} from "@/lib/supabase/tasks.browser"
import { mapTaskToUpdatePayload } from "@/lib/supabase/tasks.mapper"
import {
  canMoveToStatus,
  syncTaskProgress,
} from "@/lib/tasks/utils"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskDetail, TaskStatus } from "@/lib/types/tasks"

type UpdateStatusResult = {
  success: boolean
  message?: string
}

type TasksContextValue = {
  tasks: Task[]
  isTasksReady: boolean
  usesSupabase: boolean
  detailVersion: number
  getTask: (id: string) => Task | undefined
  getDetail: (id: string) => TaskDetail | undefined
  addTask: (input: CreateTaskPayload) => Promise<Task>
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
          setTasks(mockTasks)
          setUsesSupabase(false)
          return
        }

        setTasks(result.data)
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setTasks(mockTasks)
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
      await updateTask(task.id, mapTaskToUpdatePayload(task), client)
    } catch {
      // Keep optimistic local state if persistence fails.
    }
  }, [])

  const addTask = useCallback(
    async (input: CreateTaskPayload): Promise<Task> => {
      if (usesSupabase) {
        try {
          const client = createBrowserTasksClient()
          const result = await createTask(input, client)

          if (result.data) {
            cacheDetail(result.data.id, getTaskDetail(result.data))
            setTasks((current) => [result.data!, ...current])
            return result.data
          }
        } catch {
          // Fall through to in-memory mock create for this session.
        }
      }

      const task = createTaskFromInput(input)
      cacheDetail(task.id, getTaskDetail(task))
      setTasks((current) => [task, ...current])
      return task
    },
    [usesSupabase]
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

      const updatedTask = syncTaskProgress({ ...task, status })

      setTasks((current) =>
        current.map((item) => (item.id === id ? updatedTask : item))
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

      void persistTaskUpdate(updatedTask)

      return { success: true }
    },
    [tasks, persistTaskUpdate]
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
      updateTaskStatus,
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
      updateTaskStatus,
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
