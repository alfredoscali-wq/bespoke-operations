import type {
  ChecklistItem,
  OperationalStep,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"

export type CreateTaskPayload = Omit<Task, "id" | "progress" | "status"> & {
  progress?: number
  projectId?: string | null
  status?: TaskStatus
}

export type UpdateTaskPayload = Partial<{
  code: string
  title: string
  description: string
  projectId: string | null
  projectCode: string
  projectName: string
  customerCompany: string | null
  customerName: string | null
  customerPhone: string | null
  customerId?: string | null
  serviceAddress: string | null
  latitude: number | null
  longitude: number | null
  sharedLocation?: string | null
  observationsForCrew?: string | null
  workOrderNumber: string | null
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  supervisor: string
  crewId?: string | null
  crew: string
  startDate: string
  dueDate: string
  estimatedDuration: string
  checklist: ChecklistItem[]
  operationalSteps?: OperationalStep[]
  progress: number
  serviceType?: string | null
  locality?: string | null
  contractedPlan?: string | null
  installationCost?: number | null
  taskMetadata?: Record<string, unknown>
  rejectionReason?: string | null
  incidentReason?: string | null
  incidentObservation?: string | null
  incidentReportedAt?: string | null
  incidentReportedBy?: string | null
  cancellationReason?: string | null
  cancellationObservation?: string | null
}>

export type TasksRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "VALIDATION"
  | "ACTIVE_TASK"
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
