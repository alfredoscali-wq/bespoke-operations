import type { Json, TaskInsert, TaskRow, TaskUpdate } from "@/lib/supabase/database.types"
import { getInitialTaskStatus } from "@/lib/tasks/task-status-workflow"
import type { ChecklistItem, Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is ChecklistItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ChecklistItem).id === "string" &&
      typeof (item as ChecklistItem).label === "string" &&
      typeof (item as ChecklistItem).completed === "boolean" &&
      typeof (item as ChecklistItem).required === "boolean"
  )
}

function mapNullableNumber(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : Number(value)
}

function parseTaskMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

export function mapTaskRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    projectId: row.project_id ?? undefined,
    projectCode: row.project_code,
    projectName: row.project_name,
    customerCompany: row.customer_company ?? undefined,
    customerName: row.customer_name ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    customerId: row.customer_id ?? undefined,
    serviceAddress: row.service_address ?? undefined,
    latitude: mapNullableNumber(row.latitude),
    longitude: mapNullableNumber(row.longitude),
    sharedLocation: row.shared_location?.trim() || undefined,
    observationsForCrew: row.observations_for_crew?.trim() || undefined,
    workOrderNumber: row.work_order_number ?? undefined,
    type: row.type,
    status: row.status,
    priority: row.priority,
    supervisor: row.supervisor,
    crewId: row.crew_id ?? undefined,
    crew: row.crew,
    startDate: row.start_date,
    dueDate: row.due_date,
    estimatedDuration: row.estimated_duration,
    checklist: parseChecklist(row.checklist),
    progress: row.progress,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    closedAt: row.closed_at,
    serviceType: row.service_type,
    locality: row.locality,
    taskMetadata: parseTaskMetadata(row.task_metadata),
  }
}

export function mapCreatePayloadToInsert(payload: CreateTaskPayload): TaskInsert {
  return {
    code: payload.code.trim(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    project_id: payload.projectId ?? null,
    project_code: payload.projectCode.trim(),
    project_name: payload.projectName.trim(),
    customer_company: payload.customerCompany?.trim() || null,
    customer_name: payload.customerName?.trim() || null,
    customer_phone: payload.customerPhone?.trim() || null,
    customer_id: payload.customerId ?? null,
    service_address: payload.serviceAddress?.trim() || null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    shared_location: payload.sharedLocation?.trim() || "",
    observations_for_crew: payload.observationsForCrew?.trim() || "",
    work_order_number: payload.workOrderNumber?.trim() || null,
    type: payload.type,
    status:
      payload.status ??
      getInitialTaskStatus({ crewId: payload.crewId, crew: payload.crew }),
    priority: payload.priority ?? "media",
    supervisor: payload.supervisor.trim(),
    crew_id: payload.crewId ?? null,
    crew: payload.crew.trim(),
    start_date: payload.startDate,
    due_date: payload.dueDate,
    estimated_duration: payload.estimatedDuration.trim(),
    checklist: payload.checklist,
    progress: payload.progress ?? 0,
    service_type: payload.serviceType ?? null,
    locality: payload.locality ?? null,
    task_metadata: (payload.taskMetadata ?? {}) as Json,
  }
}

export function mapUpdatePayloadToUpdate(payload: UpdateTaskPayload): TaskUpdate {
  const update: TaskUpdate = {}

  if (payload.code !== undefined) update.code = payload.code.trim()
  if (payload.title !== undefined) update.title = payload.title.trim()
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.projectId !== undefined) update.project_id = payload.projectId
  if (payload.projectCode !== undefined) {
    update.project_code = payload.projectCode.trim()
  }
  if (payload.projectName !== undefined) {
    update.project_name = payload.projectName.trim()
  }
  if (payload.customerCompany !== undefined) {
    update.customer_company = payload.customerCompany?.trim() || null
  }
  if (payload.customerName !== undefined) {
    update.customer_name = payload.customerName?.trim() || null
  }
  if (payload.customerPhone !== undefined) {
    update.customer_phone = payload.customerPhone?.trim() || null
  }
  if (payload.customerId !== undefined) {
    update.customer_id = payload.customerId
  }
  if (payload.serviceAddress !== undefined) {
    update.service_address = payload.serviceAddress?.trim() || null
  }
  if (payload.latitude !== undefined) update.latitude = payload.latitude
  if (payload.longitude !== undefined) update.longitude = payload.longitude
  if (payload.sharedLocation !== undefined) {
    update.shared_location = payload.sharedLocation?.trim() || ""
  }
  if (payload.observationsForCrew !== undefined) {
    update.observations_for_crew = payload.observationsForCrew?.trim() || ""
  }
  if (payload.workOrderNumber !== undefined) {
    update.work_order_number = payload.workOrderNumber?.trim() || null
  }
  if (payload.type !== undefined) update.type = payload.type
  if (payload.status !== undefined) update.status = payload.status
  if (payload.priority !== undefined) update.priority = payload.priority
  if (payload.supervisor !== undefined) {
    update.supervisor = payload.supervisor.trim()
  }
  if (payload.crewId !== undefined) update.crew_id = payload.crewId
  if (payload.crew !== undefined) update.crew = payload.crew.trim()
  if (payload.startDate !== undefined) update.start_date = payload.startDate
  if (payload.dueDate !== undefined) update.due_date = payload.dueDate
  if (payload.estimatedDuration !== undefined) {
    update.estimated_duration = payload.estimatedDuration.trim()
  }
  if (payload.checklist !== undefined) update.checklist = payload.checklist
  if (payload.progress !== undefined) update.progress = payload.progress
  if (payload.serviceType !== undefined) {
    update.service_type = payload.serviceType
  }
  if (payload.locality !== undefined) update.locality = payload.locality
  if (payload.taskMetadata !== undefined) {
    update.task_metadata = payload.taskMetadata as Json
  }

  return update
}

export function mapTaskToUpdatePayload(task: Task): UpdateTaskPayload {
  return {
    status: task.status,
    progress: task.progress,
    checklist: task.checklist,
  }
}
