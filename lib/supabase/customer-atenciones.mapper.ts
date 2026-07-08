import type {
  CustomerAtencionInsert,
  CustomerAtencionRow,
} from "@/lib/supabase/database.types"
import {
  CUSTOMER_ATENCION_DEFAULT_RESULTADO,
  type CustomerAtencion,
  type CustomerAtencionChannel,
  type CustomerAtencionMotivo,
  type CustomerAtencionResultado,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCustomerAtencionPayloadToInsert(
  payload: CreateCustomerAtencionPayload
): CustomerAtencionInsert {
  return {
    company_id: payload.companyId,
    customer_id: payload.customerId,
    attended_by_employee_id: payload.attendedByEmployeeId,
    channel: payload.channel,
    motivo: payload.motivo,
    detail: payload.detail.trim(),
    resolution: payload.resolution.trim(),
    resultado: payload.resultado ?? CUSTOMER_ATENCION_DEFAULT_RESULTADO,
  }
}
