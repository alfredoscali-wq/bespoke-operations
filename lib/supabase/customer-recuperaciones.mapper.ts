import type {
  CustomerRecuperacionInsert,
  CustomerRecuperacionRow,
} from "@/lib/supabase/database.types"
import type {
  CustomerRecuperacion,
  CustomerRecuperacionChannel,
  CustomerRecuperacionResultado,
  NewCustomerRecuperacionInput,
} from "@/lib/types/customer-recuperaciones"
import type { CreateCustomerRecuperacionPayload } from "@/lib/types/supabase/customer-recuperaciones"

function parseChannel(value: string): CustomerRecuperacionChannel {
  if (value === "telefono" || value === "whatsapp" || value === "otro") {
    return value
  }

  return "otro"
}

function parseResultado(value: string): CustomerRecuperacionResultado {
  const allowed: CustomerRecuperacionResultado[] = [
    "recuperado",
    "interesado",
    "no_interesado",
    "no_responde",
    "volver_a_contactar",
  ]

  return allowed.includes(value as CustomerRecuperacionResultado)
    ? (value as CustomerRecuperacionResultado)
    : "no_interesado"
}

export function mapCustomerRecuperacionRowToCustomerRecuperacion(
  row: CustomerRecuperacionRow
): CustomerRecuperacion {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    manualCustomerName: row.manual_customer_name,
    manualZone: row.manual_zone,
    manualPhone: row.manual_phone,
    performedByEmployeeId: row.performed_by_employee_id,
    channel: parseChannel(row.channel),
    offer: row.offer,
    observation: row.observation,
    resultado: parseResultado(row.resultado),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapNewCustomerRecuperacionInputToPayload(
  input: NewCustomerRecuperacionInput,
  companyId: string,
  performedByEmployeeId: string
): CreateCustomerRecuperacionPayload {
  if (input.mode === "existing") {
    return {
      companyId,
      customerId: input.customerId,
      manualCustomerName: null,
      manualZone: null,
      manualPhone: null,
      performedByEmployeeId,
      channel: input.channel,
      offer: input.offer.trim(),
      observation: input.observation.trim(),
      resultado: input.resultado,
    }
  }

  return {
    companyId,
    customerId: null,
    manualCustomerName: input.manualCustomerName.trim(),
    manualZone: input.manualZone.trim(),
    manualPhone: input.manualPhone.trim(),
    performedByEmployeeId,
    channel: input.channel,
    offer: input.offer.trim(),
    observation: input.observation.trim(),
    resultado: input.resultado,
  }
}

export function mapCreateCustomerRecuperacionPayloadToInsert(
  payload: CreateCustomerRecuperacionPayload
): CustomerRecuperacionInsert {
  return {
    company_id: payload.companyId,
    customer_id: payload.customerId ?? null,
    manual_customer_name: payload.manualCustomerName ?? null,
    manual_zone: payload.manualZone ?? null,
    manual_phone: payload.manualPhone ?? null,
    performed_by_employee_id: payload.performedByEmployeeId,
    channel: payload.channel,
    offer: payload.offer,
    observation: payload.observation,
    resultado: payload.resultado,
  }
}
