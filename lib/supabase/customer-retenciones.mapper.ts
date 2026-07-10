import type {
  CustomerRetencionInsert,
  CustomerRetencionRow,
  CustomerRetencionUpdate,
} from "@/lib/supabase/database.types"
import type {
  CustomerRetencion,
  CustomerRetencionMotivoBaja,
  CustomerRetencionResultado,
  CustomerRetencionStatus,
} from "@/lib/types/customer-retenciones"
import type {
  CreateCustomerRetencionPayload,
  DeriveCustomerRetencionToAdministrationPayload,
  FinalizeCustomerRetencionRetainedPayload,
  MarkCustomerRetencionReadyForRetiroPayload,
} from "@/lib/types/supabase/customer-retenciones"

function parseMotivoBaja(value: string): CustomerRetencionMotivoBaja {
  const allowed: CustomerRetencionMotivoBaja[] = [
    "precio_situacion_economica",
    "problemas_tecnicos",
    "problemas_reiterados_sin_solucion",
    "mala_atencion",
    "falta_de_respuesta",
    "cambio_de_proveedor",
    "mudanza",
    "ya_no_necesita_servicio",
    "otro",
  ]

  return allowed.includes(value as CustomerRetencionMotivoBaja)
    ? (value as CustomerRetencionMotivoBaja)
    : "otro"
}

function parseStatus(value: string): CustomerRetencionStatus {
  switch (value) {
    case "pendiente_administracion":
      return "pendiente_administracion"
    case "pendiente_retiro":
      return "pendiente_retiro"
    case "finalizada":
      return "finalizada"
    default:
      return "en_gestion"
  }
}

function parseResultado(value: string | null): CustomerRetencionResultado | null {
  if (
    value === "retenido" ||
    value === "persiste_baja" ||
    value === "no_retenido"
  ) {
    return value
  }

  return null
}

export function mapCustomerRetencionRowToCustomerRetencion(
  row: CustomerRetencionRow
): CustomerRetencion {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    assignedEmployeeId: row.assigned_employee_id,
    assignedByEmployeeId: row.assigned_by_employee_id,
    motivoBaja: parseMotivoBaja(row.motivo_baja),
    detail: row.detail,
    status: parseStatus(row.status),
    resultado: parseResultado(row.resultado),
    resolution: row.resolution,
    completedAt: row.completed_at,
    completedByEmployeeId: row.completed_by_employee_id,
    administrationPendingAt: row.administration_pending_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCustomerRetencionPayloadToInsert(
  payload: CreateCustomerRetencionPayload
): CustomerRetencionInsert {
  return {
    company_id: payload.companyId,
    customer_id: payload.customerId,
    assigned_employee_id: payload.assignedEmployeeId,
    assigned_by_employee_id: payload.assignedByEmployeeId,
    motivo_baja: payload.motivoBaja,
    detail: payload.detail.trim(),
    status: "en_gestion",
    resultado: null,
    resolution: null,
    completed_at: null,
    completed_by_employee_id: null,
    administration_pending_at: null,
  }
}

export function mapFinalizeCustomerRetencionRetainedPayloadToUpdate(
  payload: FinalizeCustomerRetencionRetainedPayload
): CustomerRetencionUpdate {
  return {
    status: payload.status,
    resultado: payload.resultado,
    resolution: payload.resolution.trim(),
    completed_at: payload.completedAt,
    completed_by_employee_id: payload.completedByEmployeeId,
    administration_pending_at: null,
  }
}

export function mapDeriveCustomerRetencionToAdministrationPayloadToUpdate(
  payload: DeriveCustomerRetencionToAdministrationPayload
): CustomerRetencionUpdate {
  return {
    status: payload.status,
    resultado: payload.resultado,
    resolution: payload.resolution.trim(),
    administration_pending_at: payload.administrationPendingAt,
    completed_at: null,
    completed_by_employee_id: null,
  }
}

export function mapMarkCustomerRetencionReadyForRetiroPayloadToUpdate(
  payload: MarkCustomerRetencionReadyForRetiroPayload
): CustomerRetencionUpdate {
  return {
    status: payload.status,
  }
}
