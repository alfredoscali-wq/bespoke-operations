import type {
  CommercialCommitmentInsert,
  CommercialCommitmentRow,
  CommercialCommitmentUpdate,
} from "@/lib/supabase/database.aliases"
import type { Json } from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type {
  CommercialCommitmentPriority,
  CommercialCommitmentStatus,
} from "@/lib/commercial/location"
import type { CommercialCommitment } from "@/lib/types/commercial-commitments"
import type {
  CreateCommercialCommitmentPayload,
  UpdateCommercialCommitmentPayload,
} from "@/lib/types/supabase/commercial-commitments"

export function mapCommercialCommitmentRow(
  row: CommercialCommitmentRow
): CommercialCommitment {
  return {
    id: row.id,
    companyId: row.company_id,
    opportunityId: row.opportunity_id,
    activityId: row.activity_id,
    title: row.title,
    description: row.description,
    assignedEmployeeId: row.assigned_employee_id,
    dueAt: row.due_at,
    priority: row.priority as CommercialCommitmentPriority,
    status: row.status as CommercialCommitmentStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCommercialCommitmentPayloadToInsert(
  payload: CreateCommercialCommitmentPayload
): CommercialCommitmentInsert {
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    opportunity_id: payload.opportunityId,
    activity_id: payload.activityId ?? null,
    title: payload.title.trim(),
    description: payload.description?.trim() ?? "",
    assigned_employee_id: payload.assignedEmployeeId ?? null,
    due_at: payload.dueAt,
    priority: payload.priority ?? "media",
    status: payload.status ?? "pending",
    metadata: (payload.metadata ?? {}) as Json,
    created_by: payload.createdBy ?? null,
  }
}

export function mapUpdateCommercialCommitmentPayloadToUpdate(
  payload: UpdateCommercialCommitmentPayload
): CommercialCommitmentUpdate {
  const update: CommercialCommitmentUpdate = {}
  if (payload.title !== undefined) update.title = payload.title.trim()
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.assignedEmployeeId !== undefined) {
    update.assigned_employee_id = payload.assignedEmployeeId
  }
  if (payload.dueAt !== undefined) update.due_at = payload.dueAt
  if (payload.priority !== undefined) update.priority = payload.priority
  if (payload.status !== undefined) update.status = payload.status
  if (payload.metadata !== undefined) {
    update.metadata = payload.metadata as Json
  }
  if (payload.updatedBy !== undefined) update.updated_by = payload.updatedBy
  return update
}
