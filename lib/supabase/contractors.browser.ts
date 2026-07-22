import { createClient } from "@/lib/supabase/client"
import {
  fetchContractorById,
  fetchContractors,
  insertContractor,
  patchContractor,
  softDeleteContractor,
  type SupabaseContractorsClient,
} from "@/lib/supabase/contractors.queries"
import type { Contractor } from "@/lib/types/contractors"
import type {
  CreateContractorPayload,
  ContractorsRepositoryResult,
  UpdateContractorPayload,
} from "@/lib/types/supabase/contractors"

export function createBrowserContractorsClient(): SupabaseContractorsClient {
  return createClient()
}

export async function listContractors(
  companyId: string,
  client: SupabaseContractorsClient = createBrowserContractorsClient()
): Promise<ContractorsRepositoryResult<Contractor[]>> {
  return fetchContractors(client, companyId)
}

export async function getContractorById(
  id: string,
  client: SupabaseContractorsClient = createBrowserContractorsClient()
): Promise<ContractorsRepositoryResult<Contractor>> {
  return fetchContractorById(client, id)
}

export async function createContractor(
  payload: CreateContractorPayload,
  client: SupabaseContractorsClient = createBrowserContractorsClient()
): Promise<ContractorsRepositoryResult<Contractor>> {
  return insertContractor(client, payload)
}

export async function updateContractor(
  id: string,
  payload: UpdateContractorPayload,
  client: SupabaseContractorsClient = createBrowserContractorsClient()
): Promise<ContractorsRepositoryResult<Contractor>> {
  return patchContractor(client, id, payload)
}

export async function deleteContractor(
  id: string,
  client: SupabaseContractorsClient = createBrowserContractorsClient()
): Promise<ContractorsRepositoryResult<Contractor>> {
  return softDeleteContractor(client, id)
}
