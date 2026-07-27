import type {
  CommercialActivityStatus,
  CommercialActivityTypeCode,
} from "@/lib/commercial/activity-catalogs"
import type {
  CommercialActivityInsert,
  CommercialActivityRow,
  CommercialActivityTypeRow,
  CommercialActivityUpdate,
  Json,
} from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type {
  CommercialActivity,
  CommercialActivityListItem,
  CommercialActivityType,
} from "@/lib/types/commercial-activities"
import type {
  CreateCommercialActivityPayload,
  UpdateCommercialActivityPayload,
} from "@/lib/types/supabase/commercial-activities"

export function mapCommercialActivityTypeRow(
  row: CommercialActivityTypeRow
): CommercialActivityType {
  return {
    id: row.id,
    code: row.code as CommercialActivityTypeCode,
    label: row.label,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

export function mapCommercialActivityRow(
  row: CommercialActivityRow
): CommercialActivity {
  return {
    id: row.id,
    companyId: row.company_id,
    opportunityId: row.opportunity_id,
    activityTypeId: row.activity_type_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    status: row.status as CommercialActivityStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCommercialActivityListItem(
  row: CommercialActivityRow & {
    activity_type?: { code: string; label: string } | null
    employee?: { first_name: string; last_name: string } | null
  }
): CommercialActivityListItem {
  const base = mapCommercialActivityRow(row)
  const first = row.employee?.first_name?.trim() ?? ""
  const last = row.employee?.last_name?.trim() ?? ""
  const employeeName = `${first} ${last}`.trim() || null

  return {
    ...base,
    activityTypeCode: (row.activity_type?.code ??
      "nota") as CommercialActivityTypeCode,
    activityTypeLabel: row.activity_type?.label ?? "Actividad",
    employeeName,
  }
}

export function mapCreateCommercialActivityPayloadToInsert(
  payload: CreateCommercialActivityPayload & { activityTypeId: string }
): CommercialActivityInsert {
  const status = payload.status ?? "pending"
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    opportunity_id: payload.opportunityId,
    activity_type_id: payload.activityTypeId,
    employee_id: payload.employeeId ?? null,
    title: payload.title.trim(),
    description: payload.description?.trim() ?? "",
    scheduled_at: payload.scheduledAt ?? null,
    completed_at:
      payload.completedAt ??
      (status === "completed" ? new Date().toISOString() : null),
    status,
    metadata: (payload.metadata ?? {}) as Json,
    created_by: payload.createdBy ?? null,
  }
}

export function mapUpdateCommercialActivityPayloadToUpdate(
  payload: UpdateCommercialActivityPayload
): CommercialActivityUpdate {
  const update: CommercialActivityUpdate = {}

  if (payload.activityTypeId !== undefined) {
    update.activity_type_id = payload.activityTypeId
  }
  if (payload.employeeId !== undefined) update.employee_id = payload.employeeId
  if (payload.title !== undefined) update.title = payload.title.trim()
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.scheduledAt !== undefined) {
    update.scheduled_at = payload.scheduledAt
  }
  if (payload.completedAt !== undefined) {
    update.completed_at = payload.completedAt
  }
  if (payload.status !== undefined) {
    update.status = payload.status
    if (payload.status === "completed" && payload.completedAt === undefined) {
      update.completed_at = new Date().toISOString()
    }
    if (payload.status === "pending" && payload.completedAt === undefined) {
      update.completed_at = null
    }
  }
  if (payload.metadata !== undefined) {
    update.metadata = payload.metadata as unknown as Json
  }
  if (payload.updatedBy !== undefined) update.updated_by = payload.updatedBy

  return update
}
