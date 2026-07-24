import { createClient } from "@/lib/supabase/client"
import {
  cancelTreasuryMovement,
  fetchTreasuryMovementById,
  fetchTreasuryMovements,
  hardDeleteTreasuryMovement,
  insertTreasuryMovement,
  patchTreasuryMovement,
  softDeleteTreasuryMovement,
  type SupabaseTreasuryClient,
  type TreasuryRepositoryResult,
} from "@/lib/supabase/treasury.queries"
import { TREASURY_RECEIPTS_BUCKET } from "@/lib/tesoreria/receipt-storage"
import type {
  CreateTreasuryMovementInput,
  TreasuryMovement,
  UpdateTreasuryMovementInput,
} from "@/lib/types/tesoreria"

export function createBrowserTreasuryClient(): SupabaseTreasuryClient {
  return createClient()
}

export async function listTreasuryMovements(
  companyId: string,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<TreasuryMovement[]>> {
  return fetchTreasuryMovements(client, companyId)
}

export async function getTreasuryMovementById(
  id: string,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  return fetchTreasuryMovementById(client, id)
}

export async function createTreasuryMovement(
  payload: CreateTreasuryMovementInput,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  return insertTreasuryMovement(client, payload)
}

export async function updateTreasuryMovement(
  id: string,
  payload: UpdateTreasuryMovementInput,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  return patchTreasuryMovement(client, id, payload)
}

export async function annulTreasuryMovement(
  id: string,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  return cancelTreasuryMovement(client, id)
}

export async function softRemoveTreasuryMovement(
  id: string,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<void>> {
  return softDeleteTreasuryMovement(client, id)
}

/**
 * Permanently deletes a movement (Administrador + RLS).
 * Also removes the receipt object from Storage when present.
 */
export async function permanentlyDeleteTreasuryMovement(
  id: string,
  client: SupabaseTreasuryClient = createBrowserTreasuryClient()
): Promise<TreasuryRepositoryResult<TreasuryMovement>> {
  const result = await hardDeleteTreasuryMovement(client, id)
  if (result.error || !result.data) {
    return result
  }

  const receiptPath = result.data.receiptUrl?.trim()
  if (receiptPath) {
    const { error: storageError } = await client.storage
      .from(TREASURY_RECEIPTS_BUCKET)
      .remove([receiptPath])

    if (storageError) {
      console.warn(
        "[Tesorería] Movimiento eliminado, pero el comprobante no se pudo borrar.",
        storageError.message
      )
    }
  }

  return result
}
