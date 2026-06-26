import type {
  CustomerInsert,
  CustomerRow,
  CustomerUpdate,
} from "@/lib/supabase/database.types"
import type { Customer, CustomerValidationStatus } from "@/lib/types/customers"
import type {
  CreateCustomerPayload,
  UpdateCustomerPayload,
} from "@/lib/types/supabase/customers"

function trimOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function parseValidationStatus(value: string | null | undefined): CustomerValidationStatus {
  return value === "review" ? "review" : "active"
}

export function mapCustomerRowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerNumber: row.customer_number,
    externalCustomerCode: row.external_customer_code ?? undefined,
    dni: row.dni ?? undefined,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    locality: row.locality ?? undefined,
    technology: row.technology ?? undefined,
    status: row.status,
    validationStatus: parseValidationStatus(row.validation_status),
    validatedBy: row.validated_by ?? undefined,
    validatedAt: row.validated_at ?? undefined,
    legacyClientState: row.legacy_client_state ?? undefined,
    legacyMigrationId: row.legacy_migration_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  }
}

export function mapCustomerInsert(
  payload: CreateCustomerPayload
): CustomerInsert {
  return {
    customer_number: payload.customerNumber.trim(),
    name: payload.name.trim(),
    external_customer_code: trimOptional(payload.externalCustomerCode),
    dni: trimOptional(payload.dni),
    phone: trimOptional(payload.phone),
    email: trimOptional(payload.email),
    address: trimOptional(payload.address),
    locality: trimOptional(payload.locality),
    technology: trimOptional(payload.technology),
    status: payload.status?.trim() || "activo",
    validation_status: payload.validationStatus ?? "active",
    legacy_client_state: trimOptional(payload.legacyClientState),
    legacy_migration_id: payload.legacyMigrationId ?? null,
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
  if (payload.externalCustomerCode !== undefined) {
    update.external_customer_code = trimOptional(payload.externalCustomerCode)
  }
  if (payload.dni !== undefined) {
    update.dni = trimOptional(payload.dni)
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
  if (payload.validationStatus !== undefined) {
    update.validation_status = payload.validationStatus
  }
  if (payload.validatedBy !== undefined) {
    update.validated_by = payload.validatedBy
  }
  if (payload.validatedAt !== undefined) {
    update.validated_at = payload.validatedAt
  }
  if (payload.legacyClientState !== undefined) {
    update.legacy_client_state = trimOptional(payload.legacyClientState)
  }
  if (payload.legacyMigrationId !== undefined) {
    update.legacy_migration_id = payload.legacyMigrationId
  }
  if (payload.deletedAt !== undefined) {
    update.deleted_at = payload.deletedAt
  }

  return update
}
