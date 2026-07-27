import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { mapCommercialCommitmentRow } from "@/lib/supabase/commercial-commitments.mapper"
import type { CommercialCommitmentStatus } from "@/lib/commercial/location"
import type { CommercialCommitment } from "@/lib/types/commercial-commitments"
import type { CommercialCommitmentRepositoryResult } from "@/lib/types/supabase/commercial-commitments"

export type SupabaseCommercialCommitmentsClient = SupabaseClient<Database>

function toError(
  message: string
): CommercialCommitmentRepositoryResult<never> {
  return { data: null, error: { code: "UNKNOWN", message } }
}

export async function fetchCommercialCommitmentsForDesk(
  client: SupabaseCommercialCommitmentsClient,
  companyId: string,
  options: {
    dueFrom?: string
    dueTo?: string
    dueBefore?: string
    statuses?: CommercialCommitmentStatus[]
    assignedEmployeeId?: string | null
    limit?: number
  } = {}
): Promise<CommercialCommitmentRepositoryResult<CommercialCommitment[]>> {
  let query = client
    .from("commercial_commitments")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("due_at", { ascending: true })

  if (options.dueFrom) query = query.gte("due_at", options.dueFrom)
  if (options.dueTo) query = query.lte("due_at", options.dueTo)
  if (options.dueBefore) query = query.lt("due_at", options.dueBefore)
  if (options.statuses?.length) query = query.in("status", options.statuses)
  if (options.assignedEmployeeId) {
    query = query.eq("assigned_employee_id", options.assignedEmployeeId)
  }
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) return toError(error.message)

  return {
    data: (data ?? []).map(mapCommercialCommitmentRow),
    error: null,
  }
}
