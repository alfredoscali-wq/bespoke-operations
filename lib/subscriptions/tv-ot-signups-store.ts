import "server-only"

import { BESPOKE_OT_TV_PADRON_SOURCE } from "@/lib/subscriptions/tv-ot-signups"
import type { TvOtPlanKind } from "@/lib/subscriptions/tv-ot-signups"

type WriteError = { code?: string; message: string } | null

type WriteResult = { error: WriteError }

export type TvOtProposalWrite = {
  companyId: string
  customerId: string
  taskId: string
  status: "pending_review" | "pending_required_data" | "incorporated" | "excluded" | "needs_review"
  tvKind: TvOtPlanKind | null
  abnetCustomerNumber?: string | null
  padronSource?: string | null
  padronSourceRow?: number | null
  incorporatedAt?: string | null
  incorporatedBy?: string | null
  excludedAt?: string | null
  excludedBy?: string | null
}

type ProposalRow = {
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<WriteResult>
      }
    }
  }
  insert: (values: Record<string, unknown>) => Promise<WriteResult>
}

function proposalTable(client: unknown) {
  return (client as { from: (table: string) => ProposalRow }).from("tv_ot_signup_proposals")
}

function proposalValues(input: TvOtProposalWrite): Record<string, unknown> {
  return {
    company_id: input.companyId,
    customer_id: input.customerId,
    task_id: input.taskId,
    status: input.status,
    tv_kind: input.tvKind,
    abnet_customer_number: input.abnetCustomerNumber ?? null,
    padron_source: input.padronSource ?? null,
    padron_source_row: input.padronSourceRow ?? null,
    incorporated_at: input.incorporatedAt ?? null,
    incorporated_by: input.incorporatedBy ?? null,
    excluded_at: input.excludedAt ?? null,
    excluded_by: input.excludedBy ?? null,
  }
}

export async function saveTvOtSignupProposal(
  client: unknown,
  input: TvOtProposalWrite & { exists: boolean }
): Promise<WriteError> {
  const values = proposalValues(input)
  if (!input.exists) {
    const inserted = await proposalTable(client).insert(values)
    return inserted.error
  }
  const updated = await proposalTable(client)
    .update(values)
    .eq("company_id", input.companyId)
    .eq("customer_id", input.customerId)
    .eq("task_id", input.taskId)
  return updated.error
}

export async function insertBespokeOtTvPadronRow(
  client: unknown,
  input: {
    companyId: string
    abnetCustomerNumber: string
    customerName: string
    planName: string
    tvAmount: number
    serviceType: string | null
    sourceRow: number
  }
): Promise<WriteError> {
  const inserted = await (
    client as {
      from: (table: string) => {
        insert: (values: Record<string, unknown>) => Promise<WriteResult>
      }
    }
  )
    .from("abnet_tv_padron_rows")
    .insert({
      company_id: input.companyId,
      abnet_customer_number: input.abnetCustomerNumber,
      customer_name: input.customerName,
      service_type: input.serviceType,
      plan_name: input.planName,
      status: "Pendiente",
      tv_amount: input.tvAmount,
      source: BESPOKE_OT_TV_PADRON_SOURCE,
      source_row: input.sourceRow,
    })
  return inserted.error
}

export async function nextBespokeOtTvSourceRow(
  client: unknown,
  companyId: string
): Promise<{ sourceRow: number; error: WriteError }> {
  const page = await (
    client as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              order: (
                column: string,
                options: { ascending: boolean }
              ) => {
                limit: (count: number) => Promise<{
                  data: { source_row: number }[] | null
                  error: WriteError
                }>
              }
            }
          }
        }
      }
    }
  )
    .from("abnet_tv_padron_rows")
    .select("source_row")
    .eq("company_id", companyId)
    .eq("source", BESPOKE_OT_TV_PADRON_SOURCE)
    .order("source_row", { ascending: false })
    .limit(1)
  if (page.error) return { sourceRow: 0, error: page.error }
  const current = page.data?.[0]?.source_row
  const sourceRow = typeof current === "number" && Number.isInteger(current) && current > 0 ? current + 1 : 1
  return { sourceRow, error: null }
}
