import { createClient } from "@/lib/supabase/client"
import {
  insertCommercialCommitment,
  type SupabaseCommercialCommitmentsClient,
} from "@/lib/supabase/commercial-commitments.queries"
import type { CommercialCommitment } from "@/lib/types/commercial-commitments"
import type {
  CommercialCommitmentRepositoryResult,
  CreateCommercialCommitmentPayload,
} from "@/lib/types/supabase/commercial-commitments"

export function createBrowserCommercialCommitmentsClient(): SupabaseCommercialCommitmentsClient {
  return createClient()
}

export async function createCommercialCommitment(
  payload: CreateCommercialCommitmentPayload,
  client: SupabaseCommercialCommitmentsClient = createBrowserCommercialCommitmentsClient()
): Promise<CommercialCommitmentRepositoryResult<CommercialCommitment>> {
  return insertCommercialCommitment(client, payload)
}
