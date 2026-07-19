import {
  isCustomerAtencionNextStep,
  isCustomerAtencionStatus,
} from "@/lib/customer-atenciones/consultation"
import type {
  CustomerAtencionEventInsert,
  CustomerAtencionEventRow,
} from "@/lib/supabase/database.types"
import type {
  CustomerAtencionEvent,
  CustomerAtencionEventActionType,
} from "@/lib/types/customer-atencion-events"
import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"
import type { CreateCustomerAtencionEventPayload } from "@/lib/types/supabase/customer-atencion-events"

const EVENT_ACTION_TYPES = new Set<CustomerAtencionEventActionType>([
  "consulta_creada",
  "gestion_iniciada",
  "gestion_registrada",
  "consulta_pendiente",
  "consulta_resuelta",
  "proximo_paso_cambiado",
  "consulta_ot_vinculada",
  "gestion_liberada_por_inactividad",
])

function parseActionType(value: string): CustomerAtencionEventActionType {
  if (EVENT_ACTION_TYPES.has(value as CustomerAtencionEventActionType)) {
    return value as CustomerAtencionEventActionType
  }

  return "consulta_creada"
}

function parseOptionalStatus(
  value: string | null | undefined
): CustomerAtencionStatus | null {
  if (value && isCustomerAtencionStatus(value)) {
    return value
  }

  return null
}

function parseOptionalNextStep(
  value: string | null | undefined
): CustomerAtencionNextStep | null {
  if (value && isCustomerAtencionNextStep(value)) {
    return value
  }

  return null
}

export function mapCustomerAtencionEventRowToCustomerAtencionEvent(
  row: CustomerAtencionEventRow
): CustomerAtencionEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    customerAtencionId: row.customer_atencion_id,
    employeeId: row.employee_id,
    actionType: parseActionType(row.action_type),
    detail: row.detail,
    previousStatus: parseOptionalStatus(row.previous_status),
    newStatus: parseOptionalStatus(row.new_status),
    previousNextStep: parseOptionalNextStep(row.previous_next_step),
    newNextStep: parseOptionalNextStep(row.new_next_step),
    createdAt: row.created_at,
  }
}

export function mapCreateCustomerAtencionEventPayloadToInsert(
  payload: CreateCustomerAtencionEventPayload
): CustomerAtencionEventInsert {
  return {
    company_id: payload.companyId,
    customer_atencion_id: payload.customerAtencionId,
    employee_id: payload.employeeId,
    action_type: payload.actionType,
    detail: payload.detail?.trim() ? payload.detail.trim() : null,
    previous_status: payload.previousStatus ?? null,
    new_status: payload.newStatus ?? null,
    previous_next_step: payload.previousNextStep ?? null,
    new_next_step: payload.newNextStep ?? null,
  }
}

export function mapConsultaCreadaEventPayload(
  atencion: {
    companyId: string
    id: string
    attendedByEmployeeId: string
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
    createdAt: string
  }
): CreateCustomerAtencionEventPayload {
  return {
    companyId: atencion.companyId,
    customerAtencionId: atencion.id,
    employeeId: atencion.attendedByEmployeeId,
    actionType: "consulta_creada",
    previousStatus: null,
    newStatus: atencion.status,
    previousNextStep: null,
    newNextStep: atencion.nextStep ?? null,
  }
}
