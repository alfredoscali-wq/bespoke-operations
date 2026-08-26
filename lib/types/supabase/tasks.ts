import type { WorkOrderCustomerCreateDraft } from "@/lib/tasks/work-order-customer-resolve"
import type {
  ChecklistItem,
  OperationalStep,
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/types/tasks"

export type CreateTaskPayload = Omit<Task, "id" | "progress" | "status"> & {
  companyId?: string
  progress?: number
  projectId?: string | null
  status?: TaskStatus
  idempotencyKey?: string | null
  createCustomerDraft?: WorkOrderCustomerCreateDraft | null
  atencionId?: string | null
  commercialSolicitudId?: string | null
}

export type InsertTaskResult = {
  task: Task
  taskId: string
  created: boolean
  idempotentReplay: boolean
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
  locationResolutionMethod?: string | null
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
  scheduledTime?: string | null
  originalScheduledDate?: string | null
  originalScheduledTime?: string | null
  rescheduledBy?: string | null
  rescheduledAt?: string | null
  rescheduleReason?: string | null
  rescheduleNotes?: string | null
  estimatedDuration: string
  checklist: ChecklistItem[]
  operationalSteps?: OperationalStep[]
  progress: number
  serviceType?: string | null
  locality?: string | null
  contractedPlan?: string | null
  serviceCatalogId?: string | null
  installationCost?: number | null
  amountToCollect?: number | null
  customerDni?: string | null
  paymentMethod?: string | null
  taskMetadata?: Record<string, unknown>
  rejectionReason?: string | null
  incidentReason?: string | null
  incidentObservation?: string | null
  incidentReportedAt?: string | null
  incidentReportedBy?: string | null
  cancellationReason?: string | null
  cancellationObservation?: string | null
  executionOrder?: number | null
  dispatchOrder?: number | null
}>

export type TasksRepositoryErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "DUPLICATE_EXECUTION_ORDER"
  | "TASK_EXECUTION_ORDER_CONFLICT"
  | "DUPLICATE_DISPATCH_ORDER"
  | "IDEMPOTENCY_PAYLOAD_CONFLICT"
  | "IDEMPOTENCY_OPERATION_DELETED"
  | "IDEMPOTENCY_KEY_INVALID"
  | "VALIDATION"
  | "WORKFLOW"
  | "ACTIVE_TASK"
  | "CONFLICT"
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
