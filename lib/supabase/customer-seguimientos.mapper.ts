import type {
  CustomerSeguimientoInsert,
  CustomerSeguimientoRow,
  CustomerSeguimientoUpdate,
} from "@/lib/supabase/database.types"
import type {
  CustomerSeguimiento,
  CustomerSeguimientoStatus,
} from "@/lib/types/customer-seguimientos"
import type {
  CreateCustomerSeguimientoPayload,
  UpdateCustomerSeguimientoCompletePayload,
} from "@/lib/types/supabase/customer-seguimientos"

function parseStatus(value: string): CustomerSeguimientoStatus {
  return value === "completado" ? "completado" : "pendiente"
}

function normalizeScheduledTime(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed.slice(0, 5)
}

export function mapCustomerSeguimientoRowToCustomerSeguimiento(
  row: CustomerSeguimientoRow
): CustomerSeguimiento {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    sourceAtencionId: row.source_atencion_id,
    previousSeguimientoId: row.previous_seguimiento_id,
    assignedEmployeeId: row.assigned_employee_id,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    observation: row.observation,
    status: parseStatus(row.status),
    completionAction: row.completion_action,
    completedAt: row.completed_at,
    completedByEmployeeId: row.completed_by_employee_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCustomerSeguimientoPayloadToInsert(
  payload: CreateCustomerSeguimientoPayload
): CustomerSeguimientoInsert {
  return {
    company_id: payload.companyId,
    customer_id: payload.customerId,
    source_atencion_id: payload.sourceAtencionId ?? null,
    previous_seguimiento_id: payload.previousSeguimientoId ?? null,
    assigned_employee_id: payload.assignedEmployeeId,
    scheduled_date: payload.scheduledDate,
    scheduled_time: normalizeScheduledTime(payload.scheduledTime),
    observation: payload.observation.trim(),
    status: "pendiente",
  }
}

export function mapUpdateCustomerSeguimientoCompletePayloadToUpdate(
  payload: UpdateCustomerSeguimientoCompletePayload
): CustomerSeguimientoUpdate {
  return {
    completion_action: payload.completionAction.trim(),
    completed_at: payload.completedAt,
    completed_by_employee_id: payload.completedByEmployeeId,
    status: payload.status,
  }
}
