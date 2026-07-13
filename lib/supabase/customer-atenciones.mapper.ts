import {
  deriveConsultationStatusFromResultado,
  deriveNextStepForNewConsultation,
  isCustomerAtencionNextStep,
  isCustomerAtencionStatus,
  resolveInitialConsultationStatusFromNextStep,
} from "@/lib/customer-atenciones/consultation"
import { DEFAULT_MOROSO_TRACKING_STATUS, isMorosoTrackingStatus } from "@/lib/customer-atenciones/moroso-flow"
import type {
  CustomerAtencionInsert,
  CustomerAtencionRow,
} from "@/lib/supabase/database.types"
import {
  CUSTOMER_ATENCION_DEFAULT_RESULTADO,
  type CustomerAtencion,
  type CustomerAtencionChannel,
  type CustomerAtencionMotivo,
  type CustomerAtencionNextStep,
  type CustomerAtencionResultado,
  type CustomerAtencionStatus,
  type MorosoTrackingStatus,
} from "@/lib/types/customer-atenciones"
import type { CreateCustomerAtencionPayload } from "@/lib/types/supabase/customer-atenciones"

function parseChannel(value: string): CustomerAtencionChannel {
  if (
    value === "telefono" ||
    value === "whatsapp" ||
    value === "presencial" ||
    value === "otro"
  ) {
    return value
  }

  return "otro"
}

function parseMotivo(value: string): CustomerAtencionMotivo {
  if (
    value === "consulta" ||
    value === "reclamo" ||
    value === "solicitud" ||
    value === "problema_tecnico" ||
    value === "facturacion" ||
    value === "baja" ||
    value === "retencion" ||
    value === "otro"
  ) {
    return value
  }

  return "otro"
}

function parseResultado(value: string): CustomerAtencionResultado {
  if (
    value === "resuelta" ||
    value === "requiere_seguimiento" ||
    value === "ot_creada"
  ) {
    return value
  }

  return CUSTOMER_ATENCION_DEFAULT_RESULTADO
}

function parseStatus(value: string | null | undefined): CustomerAtencionStatus {
  if (value && isCustomerAtencionStatus(value)) {
    return value
  }

  return "nueva"
}

function parseNextStep(
  value: string | null | undefined
): CustomerAtencionNextStep | null {
  if (value && isCustomerAtencionNextStep(value)) {
    return value
  }

  return null
}

function parseMorosoTrackingStatus(
  value: string | null | undefined
): MorosoTrackingStatus | null {
  if (value && isMorosoTrackingStatus(value)) {
    return value
  }

  return null
}

export function mapCustomerAtencionRowToCustomerAtencion(
  row: CustomerAtencionRow
): CustomerAtencion {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    attendedByEmployeeId: row.attended_by_employee_id,
    channel: parseChannel(row.channel),
    motivo: parseMotivo(row.motivo),
    detail: row.detail,
    resolution: row.resolution,
    resultado: parseResultado(row.resultado),
    status: parseStatus(row.status),
    nextStep: parseNextStep(row.next_step),
    morosoTrackingStatus: parseMorosoTrackingStatus(row.moroso_tracking_status),
    linkedTaskId: row.linked_task_id ?? null,
    linkedTaskCode: row.linked_task_code ?? null,
    otLinkedAt: row.ot_linked_at ?? null,
    otLinkedByEmployeeId: row.ot_linked_by_employee_id ?? null,
    activeManagementEmployeeId: row.active_management_employee_id,
    activeManagementStartedAt: row.active_management_started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCustomerAtencionPayloadToInsert(
  payload: CreateCustomerAtencionPayload
): CustomerAtencionInsert {
  const resultado = payload.resultado ?? CUSTOMER_ATENCION_DEFAULT_RESULTADO
  const status =
    payload.status ??
    (payload.nextStep
      ? resolveInitialConsultationStatusFromNextStep(payload.nextStep)
      : deriveConsultationStatusFromResultado(resultado))
  const nextStep =
    payload.nextStep !== undefined
      ? payload.nextStep
      : deriveNextStepForNewConsultation(resultado)

  return {
    company_id: payload.companyId,
    customer_id: payload.customerId,
    attended_by_employee_id: payload.attendedByEmployeeId,
    channel: payload.channel,
    motivo: payload.motivo,
    detail: payload.detail.trim(),
    resolution: payload.resolution.trim(),
    resultado,
    status,
    next_step: nextStep,
    moroso_tracking_status:
      nextStep === "derivar_admin_morosos" ? DEFAULT_MOROSO_TRACKING_STATUS : null,
    active_management_employee_id: null,
    active_management_started_at: null,
  }
}
