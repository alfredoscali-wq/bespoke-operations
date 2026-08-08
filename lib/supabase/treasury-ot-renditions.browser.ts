import { createClient } from "@/lib/supabase/client"
import {
  confirmTreasuryOtRendition,
  ensureTreasuryOtRenditionForTask,
  fetchTreasuryOtRenditions,
  type SupabaseTreasuryOtRenditionsClient,
  type TreasuryOtRenditionRepositoryResult,
} from "@/lib/supabase/treasury-ot-renditions.queries"
import type {
  ConfirmOtRenditionInput,
  TreasuryOtRendition,
} from "@/lib/types/treasury-ot-renditions"

export function createBrowserTreasuryOtRenditionsClient(): SupabaseTreasuryOtRenditionsClient {
  return createClient()
}

export async function listTreasuryOtRenditions(
  companyId: string,
  client: SupabaseTreasuryOtRenditionsClient = createBrowserTreasuryOtRenditionsClient()
): Promise<TreasuryOtRenditionRepositoryResult<TreasuryOtRendition[]>> {
  return fetchTreasuryOtRenditions(client, companyId)
}

export async function ensureOtCashRenditionForTask(
  taskId: string,
  client: SupabaseTreasuryOtRenditionsClient = createBrowserTreasuryOtRenditionsClient()
): Promise<TreasuryOtRenditionRepositoryResult<string | null>> {
  return ensureTreasuryOtRenditionForTask(client, taskId)
}

export async function confirmOtCashRendition(
  rendition: TreasuryOtRendition,
  input: ConfirmOtRenditionInput & {
    companyId: string
    confirmedBy: string | null
    confirmedByName: string
  },
  client: SupabaseTreasuryOtRenditionsClient = createBrowserTreasuryOtRenditionsClient()
): Promise<
  TreasuryOtRenditionRepositoryResult<{
    rendition: TreasuryOtRendition
    movementId: string
  }>
> {
  return confirmTreasuryOtRendition(client, rendition, input)
}
