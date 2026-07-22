import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateContractorPayloadToInsert,
  mapContractorRowToContractor,
  mapUpdateContractorPayloadToUpdate,
} from "@/lib/supabase/contractors.mapper"
import type { Contractor } from "@/lib/types/contractors"
import type {
  CreateContractorPayload,
  ContractorsRepositoryResult,
  UpdateContractorPayload,
} from "@/lib/types/supabase/contractors"

export type SupabaseContractorsClient = SupabaseClient<Database>

const CONTRACTOR_SELECT = "*"

export function mapSupabaseContractorError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23505") {
    return {
      code: "DUPLICATE_TAX_ID" as const,
      message: "Ya existe un contratista con ese CUIT en la empresa.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchContractors(
  client: SupabaseContractorsClient,
  companyId: string
): Promise<ContractorsRepositoryResult<Contractor[]>> {
  const { data, error } = await client
    .from("contractors")
    .select(CONTRACTOR_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("legal_name", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseContractorError(error) }
  }

  return {
    data: (data ?? []).map(mapContractorRowToContractor),
    error: null,
  }
}

export async function fetchContractorById(
  client: SupabaseContractorsClient,
  id: string
): Promise<ContractorsRepositoryResult<Contractor>> {
  const { data, error } = await client
    .from("contractors")
    .select(CONTRACTOR_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseContractorError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Contratista no encontrado.",
      },
    }
  }

  return {
    data: mapContractorRowToContractor(data),
    error: null,
  }
}

export async function insertContractor(
  client: SupabaseContractorsClient,
  payload: CreateContractorPayload
): Promise<ContractorsRepositoryResult<Contractor>> {
  const { data, error } = await client
    .from("contractors")
    .insert(mapCreateContractorPayloadToInsert(payload))
    .select(CONTRACTOR_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseContractorError(error) }
  }

  return {
    data: mapContractorRowToContractor(data),
    error: null,
  }
}

export async function patchContractor(
  client: SupabaseContractorsClient,
  id: string,
  payload: UpdateContractorPayload
): Promise<ContractorsRepositoryResult<Contractor>> {
  const update = mapUpdateContractorPayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("contractors")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select(CONTRACTOR_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseContractorError(error) }
  }

  return {
    data: mapContractorRowToContractor(data),
    error: null,
  }
}

export async function softDeleteContractor(
  client: SupabaseContractorsClient,
  id: string
): Promise<ContractorsRepositoryResult<Contractor>> {
  const { data, error } = await client
    .from("contractors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(CONTRACTOR_SELECT)
    .single()

  if (error) {
    return { data: null, error: mapSupabaseContractorError(error) }
  }

  return {
    data: mapContractorRowToContractor(data),
    error: null,
  }
}
