import type { Json, TaskInsert, TaskRow, TaskUpdate } from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import { getInitialTaskStatus } from "@/lib/tasks/task-status-workflow"
import { normalizeTaskStatusFromDatabase } from "@/lib/tasks/task-archived-status"
import type { ChecklistItem, OperationalStep, Task } from "@/lib/types/tasks"
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

function parseOperationalSteps(value: unknown): OperationalStep[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (item): item is OperationalStep =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as OperationalStep).id === "string" &&
        typeof (item as OperationalStep).label === "string"
    )
    .map((item) => ({
      id: item.id,
      label: item.label,
      observation:
        typeof item.observation === "string" ? item.observation : "",
      completedAt:
        typeof item.completedAt === "string" ? item.completedAt : null,
      ...(item.stepKind === "text" || item.stepKind === "photo"
        ? { stepKind: item.stepKind }
        : {}),
      ...(typeof item.stepKey === "string" ? { stepKey: item.stepKey } : {}),
    }))
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
    locationResolutionMethod: row.location_resolution_method ?? undefined,
    observationsForCrew: row.observations_for_crew?.trim() || undefined,
    workOrderNumber: row.work_order_number ?? undefined,
    type: row.type,
    status: normalizeTaskStatusFromDatabase(row.status),
    priority: row.priority,
    supervisor: row.supervisor,
    crewId: row.crew_id ?? undefined,
    crew: row.crew,
    startDate: row.start_date,
    dueDate: row.due_date,
    scheduledTime: row.scheduled_time,
    originalScheduledDate: row.original_scheduled_date ?? undefined,
    originalScheduledTime: row.original_scheduled_time ?? undefined,
    rescheduledBy: row.rescheduled_by?.trim() || undefined,
    rescheduledAt: row.rescheduled_at,
    rescheduleReason: row.reschedule_reason?.trim() || undefined,
    rescheduleNotes: row.reschedule_notes?.trim() || undefined,
    estimatedDuration: row.estimated_duration,
    checklist: parseChecklist(row.checklist),
    operationalSteps: parseOperationalSteps(row.operational_steps),
    progress: row.progress,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    closedAt: row.closed_at,
    rejectionReason: row.rejection_reason?.trim() || undefined,
    incidentReason: row.incident_reason?.trim() || undefined,
    incidentObservation: row.incident_observation?.trim() || undefined,
    incidentReportedAt: row.incident_reported_at,
    incidentReportedBy: row.incident_reported_by?.trim() || undefined,
    cancellationReason: row.cancellation_reason?.trim() || undefined,
    cancellationObservation: row.cancellation_observation?.trim() || undefined,
    serviceType: row.service_type,
    locality: row.locality,
    contractedPlan: row.contracted_plan?.trim() || undefined,
    installationCost: mapNullableNumber(row.installation_cost),
    amountToCollect: mapNullableNumber(row.amount_to_collect),
    taskMetadata: parseTaskMetadata(row.task_metadata),
    executionOrder: row.execution_order ?? undefined,
    dispatchOrder: row.dispatch_order ?? undefined,
  }
}

export function mapCreatePayloadToInsert(payload: CreateTaskPayload): TaskInsert {
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
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
    location_resolution_method: payload.locationResolutionMethod ?? null,
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
    scheduled_time: payload.scheduledTime ?? null,
    estimated_duration: payload.estimatedDuration.trim(),
    checklist: payload.checklist,
    operational_steps: (payload.operationalSteps ?? []) as Json,
    progress: payload.progress ?? 0,
    service_type: payload.serviceType ?? null,
    locality: payload.locality ?? null,
    contracted_plan: payload.contractedPlan?.trim() || null,
    installation_cost: payload.installationCost ?? null,
    amount_to_collect: payload.amountToCollect ?? null,
    task_metadata: (payload.taskMetadata ?? {}) as Json,
    execution_order: payload.executionOrder ?? null,
    dispatch_order: payload.dispatchOrder ?? null,
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
  if (payload.locationResolutionMethod !== undefined) {
    update.location_resolution_method = payload.locationResolutionMethod
  }
  if (payload.sharedLocation !== undefined) {
    update.shared_location = payload.sharedLocation?.trim() || ""
  }
  if (payload.observationsForCrew !== undefined) {
    update.observations_for_crew = payload.observationsForCrew?.trim() || ""
  }
  if (payload.rejectionReason !== undefined) {
    update.rejection_reason = payload.rejectionReason?.trim() || ""
  }
  if (payload.incidentReason !== undefined) {
    update.incident_reason = payload.incidentReason?.trim() || ""
  }
  if (payload.incidentObservation !== undefined) {
    update.incident_observation = payload.incidentObservation?.trim() || ""
  }
  if (payload.incidentReportedAt !== undefined) {
    update.incident_reported_at = payload.incidentReportedAt
  }
  if (payload.incidentReportedBy !== undefined) {
    update.incident_reported_by = payload.incidentReportedBy?.trim() || ""
  }
  if (payload.cancellationReason !== undefined) {
    update.cancellation_reason = payload.cancellationReason?.trim() || ""
  }
  if (payload.cancellationObservation !== undefined) {
    update.cancellation_observation =
      payload.cancellationObservation?.trim() || ""
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
  if (payload.scheduledTime !== undefined) {
    update.scheduled_time = payload.scheduledTime
  }
  if (payload.originalScheduledDate !== undefined) {
    update.original_scheduled_date = payload.originalScheduledDate
  }
  if (payload.originalScheduledTime !== undefined) {
    update.original_scheduled_time = payload.originalScheduledTime
  }
  if (payload.rescheduledBy !== undefined) {
    update.rescheduled_by = payload.rescheduledBy?.trim() || ""
  }
  if (payload.rescheduledAt !== undefined) {
    update.rescheduled_at = payload.rescheduledAt
  }
  if (payload.rescheduleReason !== undefined) {
    update.reschedule_reason = payload.rescheduleReason?.trim() || ""
  }
  if (payload.rescheduleNotes !== undefined) {
    update.reschedule_notes = payload.rescheduleNotes?.trim() || ""
  }
  if (payload.estimatedDuration !== undefined) {
    update.estimated_duration = payload.estimatedDuration.trim()
  }
  if (payload.checklist !== undefined) update.checklist = payload.checklist
  if (payload.operationalSteps !== undefined) {
    update.operational_steps = payload.operationalSteps as Json
  }
  if (payload.progress !== undefined) update.progress = payload.progress
  if (payload.serviceType !== undefined) {
    update.service_type = payload.serviceType
  }
  if (payload.locality !== undefined) update.locality = payload.locality
  if (payload.contractedPlan !== undefined) {
    update.contracted_plan = payload.contractedPlan?.trim() || null
  }
  if (payload.installationCost !== undefined) {
    update.installation_cost = payload.installationCost
  }
  if (payload.amountToCollect !== undefined) {
    update.amount_to_collect = payload.amountToCollect
  }
  if (payload.taskMetadata !== undefined) {
    update.task_metadata = payload.taskMetadata as Json
  }
  if (payload.executionOrder !== undefined) {
    update.execution_order = payload.executionOrder
  }
  if (payload.dispatchOrder !== undefined) {
    update.dispatch_order = payload.dispatchOrder
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
