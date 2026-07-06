import type { Database } from "@/lib/supabase/database.types"
import type {
  CreateTaskIncidentEventInput,
  CreateTaskIncidentInput,
  CreateTaskIncidentPhotoInput,
  TaskIncident,
  TaskIncidentEvent,
  TaskIncidentPhoto,
  TaskIncidentStatus,
  UpdateTaskIncidentInput,
} from "@/lib/types/task-incidents"

export type TaskIncidentRow = Database["public"]["Tables"]["task_incidents"]["Row"]
export type TaskIncidentInsert =
  Database["public"]["Tables"]["task_incidents"]["Insert"]
export type TaskIncidentUpdate =
  Database["public"]["Tables"]["task_incidents"]["Update"]

export type TaskIncidentPhotoRow =
  Database["public"]["Tables"]["task_incident_photos"]["Row"]
export type TaskIncidentPhotoInsert =
  Database["public"]["Tables"]["task_incident_photos"]["Insert"]

export type TaskIncidentEventRow =
  Database["public"]["Tables"]["task_incident_events"]["Row"]
export type TaskIncidentEventInsert =
  Database["public"]["Tables"]["task_incident_events"]["Insert"]

function mapTaskIncidentStatus(value: string): TaskIncidentStatus {
  if (
    value === "REPORTADA" ||
    value === "EN_ANALISIS" ||
    value === "RESUELTA" ||
    value === "RECHAZADA"
  ) {
    return value
  }

  return "REPORTADA"
}

export function mapTaskIncidentRowToTaskIncident(row: TaskIncidentRow): TaskIncident {
  return {
    id: row.id,
    companyId: row.company_id,
    taskId: row.task_id,
    employeeId: row.employee_id,
    crewId: row.crew_id,
    incidentTypeId: row.incident_type_id,
    status: mapTaskIncidentStatus(row.status),
    comment: row.comment,
    canContinue: row.can_continue,
    requiresSupervisorAction: row.requires_supervisor_action,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapTaskIncidentPhotoRowToTaskIncidentPhoto(
  row: TaskIncidentPhotoRow
): TaskIncidentPhoto {
  return {
    id: row.id,
    incidentId: row.incident_id,
    storagePath: row.storage_path,
    thumbnailPath: row.thumbnail_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function mapTaskIncidentEventRowToTaskIncidentEvent(
  row: TaskIncidentEventRow
): TaskIncidentEvent {
  return {
    id: row.id,
    incidentId: row.incident_id,
    eventType: row.event_type,
    comment: row.comment,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export function mapCreateTaskIncidentInputToInsert(
  companyId: string,
  input: CreateTaskIncidentInput
): TaskIncidentInsert {
  return {
    company_id: companyId,
    task_id: input.taskId,
    employee_id: input.employeeId,
    crew_id: input.crewId ?? null,
    incident_type_id: input.incidentTypeId,
    status: input.status ?? "REPORTADA",
    comment: input.comment?.trim() || null,
    can_continue: input.canContinue ?? false,
    requires_supervisor_action: input.requiresSupervisorAction ?? true,
  }
}

export function mapUpdateTaskIncidentInputToUpdate(
  input: UpdateTaskIncidentInput
): TaskIncidentUpdate {
  const update: TaskIncidentUpdate = {}

  if (input.status !== undefined) {
    update.status = input.status
  }
  if (input.comment !== undefined) {
    update.comment = input.comment?.trim() || null
  }
  if (input.canContinue !== undefined) {
    update.can_continue = input.canContinue
  }
  if (input.requiresSupervisorAction !== undefined) {
    update.requires_supervisor_action = input.requiresSupervisorAction
  }
  if (input.resolvedBy !== undefined) {
    update.resolved_by = input.resolvedBy
  }
  if (input.resolvedAt !== undefined) {
    update.resolved_at = input.resolvedAt
  }
  if (input.deletedAt !== undefined) {
    update.deleted_at = input.deletedAt
  }

  return update
}

export function mapCreateTaskIncidentPhotoInputToInsert(
  input: CreateTaskIncidentPhotoInput
): TaskIncidentPhotoInsert {
  return {
    incident_id: input.incidentId,
    storage_path: input.storagePath.trim(),
    thumbnail_path: input.thumbnailPath?.trim() || null,
    file_name: input.fileName?.trim() || null,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes ?? null,
    created_by: input.createdBy,
  }
}

export function mapCreateTaskIncidentEventInputToInsert(
  input: CreateTaskIncidentEventInput
): TaskIncidentEventInsert {
  return {
    incident_id: input.incidentId,
    event_type: input.eventType.trim(),
    comment: input.comment?.trim() || null,
    created_by: input.createdBy,
  }
}
