import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import type { CompanyBranding } from "@/lib/company-branding/types"
import type { CompanyBrandingPatch } from "@/lib/company-branding/validate"
import {
  mapCompanyBrandingRow,
  mapCompanyBrandingToUpsert,
} from "@/lib/supabase/company-branding.mapper"

type BrandingClient = SupabaseClient<Database>

export async function fetchCompanyBranding(
  client: BrandingClient,
  companyId: string
): Promise<CompanyBranding | null> {
  const { data, error } = await client
    .from("company_branding")
    .select(
      "company_id, logo_url, primary_color, secondary_color, created_at, updated_at"
    )
    .eq("company_id", companyId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return mapCompanyBrandingRow(data)
}

export async function upsertCompanyBranding(
  client: BrandingClient,
  companyId: string,
  patch: CompanyBrandingPatch
): Promise<{ data: CompanyBranding | null; error: string | null }> {
  const current = await fetchCompanyBranding(client, companyId)
  const payload = mapCompanyBrandingToUpsert({
    companyId,
    logoUrl:
      patch.logoUrl !== undefined ? patch.logoUrl : current?.logoUrl ?? null,
    primaryColor:
      patch.primaryColor !== undefined
        ? patch.primaryColor
        : current?.primaryColor ?? null,
    secondaryColor:
      patch.secondaryColor !== undefined
        ? patch.secondaryColor
        : current?.secondaryColor ?? null,
  })

  const { data, error } = await client
    .from("company_branding")
    .upsert(payload, { onConflict: "company_id" })
    .select(
      "company_id, logo_url, primary_color, secondary_color, created_at, updated_at"
    )
    .single()

  if (error || !data) {
    return {
      data: null,
      error: error?.message ?? "No se pudo guardar la identidad de empresa.",
    }
  }

  return { data: mapCompanyBrandingRow(data), error: null }
}
