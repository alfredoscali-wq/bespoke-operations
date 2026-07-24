import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isTreasuryCategoryForType,
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGINS,
  TREASURY_STATUSES,
} from "@/lib/tesoreria/categories"
import {
  mapCreateTreasuryMovementInput,
  mapTreasuryMovementRow,
  mapUpdateTreasuryMovementInput,
  type TreasuryMovementRow,
} from "@/lib/supabase/treasury.mapper"
import type { Database } from "@/lib/supabase/database.types"
import type {
  CreateTreasuryMovementInput,
  TreasuryMovement,
  UpdateTreasuryMovementInput,
} from "@/lib/types/tesoreria"

export type SupabaseTreasuryClient = SupabaseClient<Database>

export type TreasuryRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }

const MOVEMENT_SELECT = `
  *,
  employee:employees!treasury_movements_employee_id_fkey(
    id, first_name, last_name, preferred_name
  ),
  registered_by_employee:employees!treasury_movements_registered_by_fkey(
    id, first_name, last_name, preferred_name
  )
` as const

function mapError(error: { code?: string; message: string }) {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

function validateCreateInput(
  input: CreateTreasuryMovementInput
): string | null {
  if (!input.companyId.trim()) return "companyId es obligatorio."
  if (
    input.movementType !== TREASURY_MOVEMENT_TYPES.INCOME &&
    input.movementType !== TREASURY_MOVEMENT_TYPES.EXPENSE
  ) {
    return "Tipo de movimiento inválido."
  }
  if (!(Object.values(TREASURY_ORIGINS) as string[]).includes(input.origin)) {
    return "Origen inválido."
  }
  if (!isTreasuryCategoryForType(input.movementType, input.category)) {
    return "Categoría inválida para el tipo de movimiento."
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "El monto debe ser mayor a cero."
  }
  if (!input.movementDate.trim()) return "La fecha es obligatoria."
  return null
}

export async function fetchTreasuryMovements(
  client: SupabaseTreasuryClient,
  companyId: string
): Promise<TreasuryRepositoryResult<TreasuryMovement[]>> {
  const { data, error } = await client
    .from("treasury_movements")
    .select(MOVEMENT_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as unknown as TreasuryMovementRow[]).map(
      mapTreasuryMovementRow
    ),
    error: null,
  }
}

export async function fetchTreasuryMovementById(
  client: SupabaseTreasuryClient,
  id: string
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  const { data, error } = await client
    .from("treasury_movements")
    .select(MOVEMENT_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Movimiento no encontrado." },
    }
  }

  return {
    data: mapTreasuryMovementRow(data as unknown as TreasuryMovementRow),
    error: null,
  }
}

export async function insertTreasuryMovement(
  client: SupabaseTreasuryClient,
  input: CreateTreasuryMovementInput
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  const validationError = validateCreateInput(input)
  if (validationError) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validationError },
    }
  }

  const payload = mapCreateTreasuryMovementInput(input)
  const { data, error } = await client
    .from("treasury_movements")
    .insert(payload)
    .select(MOVEMENT_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: mapTreasuryMovementRow(data as unknown as TreasuryMovementRow),
    error: null,
  }
}

export async function patchTreasuryMovement(
  client: SupabaseTreasuryClient,
  id: string,
  input: UpdateTreasuryMovementInput
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  if (input.status && !(Object.values(TREASURY_STATUSES) as string[]).includes(input.status)) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "Estado inválido." },
    }
  }

  if (input.amount !== undefined && (!Number.isFinite(input.amount) || input.amount <= 0)) {
    return {
      data: null,
      error: { code: "VALIDATION", message: "El monto debe ser mayor a cero." },
    }
  }

  const payload = mapUpdateTreasuryMovementInput(input)
  const { data, error } = await client
    .from("treasury_movements")
    .update(payload)
    .eq("id", id)
    .is("deleted_at", null)
    .select(MOVEMENT_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: mapTreasuryMovementRow(data as unknown as TreasuryMovementRow),
    error: null,
  }
}

export async function softDeleteTreasuryMovement(
  client: SupabaseTreasuryClient,
  id: string
): Promise<TreasuryRepositoryResult<void>> {
  const { error } = await client
    .from("treasury_movements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: undefined as unknown as void, error: null }
}

/**
 * Permanent delete. RLS allows only Administrador.
 * Returns the deleted movement snapshot for Activity / UI updates.
 */
export async function hardDeleteTreasuryMovement(
  client: SupabaseTreasuryClient,
  id: string
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  const existing = await fetchTreasuryMovementById(client, id)
  if (existing.error || !existing.data) {
    return {
      data: null,
      error: existing.error ?? {
        code: "NOT_FOUND",
        message: "Movimiento no encontrado.",
      },
    }
  }

  const movement = existing.data
  const { error } = await client
    .from("treasury_movements")
    .delete()
    .eq("id", id)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: movement, error: null }
}

export async function cancelTreasuryMovement(
  client: SupabaseTreasuryClient,
  id: string
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  return patchTreasuryMovement(client, id, {
    status: TREASURY_STATUSES.CANCELLED,
  })
}
