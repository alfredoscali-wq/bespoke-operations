import type {
  CustomerInsert,
  CustomerRow,
  CustomerUpdate,
} from "@/lib/supabase/database.types"
import type { Customer } from "@/lib/types/customers"
import type {
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from "@/lib/types/supabase/customers"

function trimOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export function mapCustomerRowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerNumber: row.customer_number,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    locality: row.locality ?? undefined,
    technology: row.technology ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCustomerInsert(
  payload: CreateCustomerPayload
): CustomerInsert {
  return {
    customer_number: payload.customerNumber.trim(),
    name: payload.name.trim(),
    phone: trimOptional(payload.phone),
    email: trimOptional(payload.email),
    address: trimOptional(payload.address),
    locality: trimOptional(payload.locality),
    technology: trimOptional(payload.technology),
    status: payload.status?.trim() || "activo",
  }
}

export function mapCustomerUpdate(
  payload: UpdateCustomerPayload
): CustomerUpdate {
  const update: CustomerUpdate = {}

  if (payload.customerNumber !== undefined) {
    update.customer_number = payload.customerNumber.trim()
  }
  if (payload.name !== undefined) {
    update.name = payload.name.trim()
  }
  if (payload.phone !== undefined) {
    update.phone = trimOptional(payload.phone)
  }
  if (payload.email !== undefined) {
    update.email = trimOptional(payload.email)
  }
  if (payload.address !== undefined) {
    update.address = trimOptional(payload.address)
  }
  if (payload.locality !== undefined) {
    update.locality = trimOptional(payload.locality)
  }
  if (payload.technology !== undefined) {
    update.technology = trimOptional(payload.technology)
  }
  if (payload.status !== undefined) {
    update.status = payload.status.trim()
  }

  return update
}
