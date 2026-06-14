import type {
  ChecklistItem,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"

export type CreateTaskPayload = Omit<Task, "id" | "progress"> & {
  progress?: number
  projectId?: string | null
}

export type UpdateTaskPayload = Partial<{
  code: string
  title: string
  description: string
  projectId: string | null
  projectCode: string
  projectName: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  supervisor: string
  crew: string
  startDate: string
  dueDate: string
  estimatedDuration: string
  checklist: ChecklistItem[]
  progress: number
}>

export type TasksRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "VALIDATION"
  | "UNKNOWN"

export type TasksRepositoryResult<T> =
  | { data: T; error: null }
  | {
      data: null
      error: {
        code: TasksRepositoryErrorCode
        message: string
      }
    }
