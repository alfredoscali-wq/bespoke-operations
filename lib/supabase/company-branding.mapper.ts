import type {
  CompanyBrandingRow,
  CompanyBrandingInsert,
} from "@/lib/supabase/database.aliases"
import type { CompanyBranding } from "@/lib/company-branding/types"
import {
  normalizeCompanyBrandingHex,
  normalizeCompanyBrandingLogoUrl,
} from "@/lib/company-branding/validate"

export function mapCompanyBrandingRow(
  row: CompanyBrandingRow
): CompanyBranding {
  return {
    companyId: row.company_id,
    logoUrl: normalizeCompanyBrandingLogoUrl(row.logo_url),
    primaryColor: normalizeCompanyBrandingHex(row.primary_color),
    secondaryColor: normalizeCompanyBrandingHex(row.secondary_color),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCompanyBrandingToUpsert(input: {
  companyId: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
}): CompanyBrandingInsert {
  const row: CompanyBrandingInsert = {
    company_id: input.companyId,
  }

  if (input.logoUrl !== undefined) {
    row.logo_url = normalizeCompanyBrandingLogoUrl(input.logoUrl)
  }
  if (input.primaryColor !== undefined) {
    row.primary_color = normalizeCompanyBrandingHex(input.primaryColor)
  }
  if (input.secondaryColor !== undefined) {
    row.secondary_color = normalizeCompanyBrandingHex(input.secondaryColor)
  }

  return row
}
