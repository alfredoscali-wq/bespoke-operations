import { createClient } from "@/lib/supabase/client"
import {
  fetchTvCatalogPlans,
  fetchTvCommercialServiceOptions,
  fetchTvDeskSummary,
  fetchTvSubscriberPage,
  type SupabaseTvClient,
  type TvRepositoryResult,
} from "@/lib/supabase/subscriptions.queries"
import type {
  TvCommercialServiceOption,
  TvListStatusFilter,
  TvSelectedCommercialFilter,
  TvSelectedPlanFilter,
  TvDeskSummary,
} from "@/lib/subscriptions/tv-plans"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import type {
  TvCatalogPlan,
  TvSubscriberListPage,
} from "@/lib/types/subscriptions"

export function createBrowserTvClient(): SupabaseTvClient {
  return createClient()
}

export async function listTvCatalogPlans(
  companyId: string,
  client: SupabaseTvClient = createBrowserTvClient()
): Promise<TvRepositoryResult<TvCatalogPlan[]>> {
  return fetchTvCatalogPlans(client, companyId)
}

export async function listTvDeskSummary(
  companyId: string,
  client: SupabaseTvClient = createBrowserTvClient()
): Promise<TvRepositoryResult<TvDeskSummary>> {
  return fetchTvDeskSummary(client, companyId)
}

export async function listTvCommercialServiceOptions(
  companyId: string,
  client: SupabaseTvClient = createBrowserTvClient()
): Promise<TvRepositoryResult<TvCommercialServiceOption[]>> {
  return fetchTvCommercialServiceOptions(client, companyId)
}

export async function listTvSubscribers(
  input: {
    companyId: string
    plans: TvCatalogPlan[]
    selectedPlan: TvSelectedPlanFilter
    selectedCommercialId?: TvSelectedCommercialFilter
    status: TvListStatusFilter
    search?: string
    page: number
    pageSize?: number
  },
  client: SupabaseTvClient = createBrowserTvClient()
): Promise<TvRepositoryResult<TvSubscriberListPage>> {
  return fetchTvSubscriberPage(client, input)
}

async function parseTvPlanResponse(
  response: Response
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const body = (await response.json()) as {
    success?: boolean
    item?: TvCatalogPlan
    message?: string
  }
  if (!response.ok || !body.success || !body.item) {
    return {
      data: null,
      error: {
        code: "HTTP",
        message: body.message ?? "No se pudo guardar el plan TV.",
      },
    }
  }
  return { data: body.item, error: null }
}

export async function createTvPlan(
  draft: TvPlanWriteDraft
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const response = await fetch("/api/subscriptions/tv-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  })
  return parseTvPlanResponse(response)
}

export async function updateTvPlan(
  id: string,
  draft: TvPlanWriteDraft
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const response = await fetch(`/api/subscriptions/tv-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  })
  return parseTvPlanResponse(response)
}

export async function setTvPlanActive(
  id: string,
  isActive: boolean
): Promise<TvRepositoryResult<TvCatalogPlan>> {
  const response = await fetch(`/api/subscriptions/tv-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  })
  return parseTvPlanResponse(response)
}
