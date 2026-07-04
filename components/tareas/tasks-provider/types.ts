import type { ExecutionOrderUpdate } from "@/lib/planificacion/planning-execution-order"
import type { CreateTaskPayload, UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskDetail, TaskStatus } from "@/lib/types/tasks"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"

export type TaskMutationResult = {
  success: boolean
  message?: string
  task?: Task
}

export type TaskMutationOptions = {
  administration?: boolean
}

export type TasksContextValue = {
  tasks: Task[]
  isTasksReady: boolean
  usesSupabase: boolean
  detailVersion: number
  getTask: (id: string) => Task | undefined
  getDetail: (id: string) => TaskDetail | undefined
  addTask: (input: CreateTaskPayload) => Promise<Task>
  editTask: (
    id: string,
    payload: UpdateTaskPayload,
    options?: TaskMutationOptions
  ) => Promise<TaskMutationResult>
  changeTaskStatus: (id: string, targetStatus: TaskStatus) => Promise<TaskMutationResult>
  assignCrew: (
    id: string,
    crewId: string | null,
    crewName?: string,
    supervisor?: string,
    options?: { promoteToAssigned?: boolean }
  ) => Promise<TaskMutationResult>
  deleteTask: (id: string, options?: TaskMutationOptions) => Promise<TaskMutationResult>
  removeTaskLocally: (id: string) => void
  removeTasksByCustomerId: (customerId: string) => void
  startTask: (id: string) => Promise<TaskMutationResult>
  submitTaskForApproval: (id: string) => Promise<TaskMutationResult>
  approveTask: (id: string) => Promise<TaskMutationResult>
  rejectTask: (id: string, reason: string) => Promise<TaskMutationResult>
  closeTask: (id: string) => Promise<TaskMutationResult>
  cancelTask: (
    id: string,
    options?: {
      reason: string
      observation: string
      actor?: string
    }
  ) => Promise<TaskMutationResult>
  confirmPlanningTasks: (
    ids: string[],
    crews?: Pick<import("@/lib/types/crews").Crew, "id" | "name">[]
  ) => Promise<TaskMutationResult>
  reopenPlanningTasks: (
    ids: string[],
    crews?: Pick<import("@/lib/types/crews").Crew, "id" | "name">[]
  ) => Promise<TaskMutationResult>
  applyExecutionOrderUpdates: (
    updates: ExecutionOrderUpdate[]
  ) => Promise<TaskMutationResult>
  reportTaskIncident: (
    id: string,
    input: {
      reason: string
      observation: string
      reportedBy: string
    }
  ) => Promise<TaskMutationResult>
  resumeTaskFromIncident: (
    id: string,
    actor?: string
  ) => Promise<TaskMutationResult>
  rescheduleTaskFromIncident: (
    id: string,
    input: TaskRescheduleInput & { actor?: string }
  ) => Promise<TaskMutationResult>
  rescheduleTaskFromOverdue: (
    id: string,
    input: TaskRescheduleInput & { actor?: string }
  ) => Promise<TaskMutationResult>
  toggleChecklistItem: (taskId: string, itemId: string) => void
  syncOperationalStepsProgress: (
    taskId: string,
    stepPhotoCounts: Record<string, number>
  ) => Promise<TaskMutationResult>
  updateOperationalStepObservation: (
    taskId: string,
    stepId: string,
    observation: string
  ) => Promise<TaskMutationResult>
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
  refreshTasksFromServer: () => Promise<TaskMutationResult>
}
