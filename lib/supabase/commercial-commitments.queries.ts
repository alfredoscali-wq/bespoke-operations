import type { SupabaseClient } from "@supabase/supabase-js"

import {
  mapCommercialCommitmentRow,
  mapCreateCommercialCommitmentPayloadToInsert,
  mapUpdateCommercialCommitmentPayloadToUpdate,
} from "@/lib/supabase/commercial-commitments.mapper"
import type { Database } from "@/lib/supabase/database.types"
import type { CommercialCommitment } from "@/lib/types/commercial-commitments"
import type {
  CommercialCommitmentRepositoryResult,
  CreateCommercialCommitmentPayload,
  UpdateCommercialCommitmentPayload,
} from "@/lib/types/supabase/commercial-commitments"

export type SupabaseCommercialCommitmentsClient = SupabaseClient<Database>

function toError(
  message: string,
  code: "NOT_FOUND" | "VALIDATION" | "FORBIDDEN" | "UNKNOWN" = "UNKNOWN"
): CommercialCommitmentRepositoryResult<never> {
  return { data: null, error: { code, message } }
}

export async function insertCommercialCommitment(
  client: SupabaseCommercialCommitmentsClient,
  payload: CreateCommercialCommitmentPayload
): Promise<CommercialCommitmentRepositoryResult<CommercialCommitment>> {
  const { data, error } = await client
    .from("commercial_commitments")
    .insert(mapCreateCommercialCommitmentPayloadToInsert(payload))
    .select("*")
    .single()

  if (error || !data) {
    return toError(error?.message ?? "No se pudo crear el compromiso.")
  }

  return { data: mapCommercialCommitmentRow(data), error: null }
}

export async function patchCommercialCommitment(
  client: SupabaseCommercialCommitmentsClient,
  id: string,
  payload: UpdateCommercialCommitmentPayload
): Promise<CommercialCommitmentRepositoryResult<CommercialCommitment>> {
  const { data, error } = await client
    .from("commercial_commitments")
    .update(mapUpdateCommercialCommitmentPayloadToUpdate(payload))
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error || !data) {
    return toError(
      error?.message ?? "No se pudo actualizar el compromiso.",
      error ? "UNKNOWN" : "NOT_FOUND"
    )
  }

  return { data: mapCommercialCommitmentRow(data), error: null }
}

export async function fetchCommercialCommitmentsByActivityIds(
  client: SupabaseCommercialCommitmentsClient,
  companyId: string,
  activityIds: string[]
): Promise<CommercialCommitmentRepositoryResult<CommercialCommitment[]>> {
  if (activityIds.length === 0) {
    return { data: [], error: null }
  }

  const { data, error } = await client
    .from("commercial_commitments")
    .select("*")
    .eq("company_id", companyId)
    .in("activity_id", activityIds)
    .is("deleted_at", null)

  if (error) {
    return toError(error.message)
  }

  return {
    data: (data ?? []).map(mapCommercialCommitmentRow),
    error: null,
  }
}
