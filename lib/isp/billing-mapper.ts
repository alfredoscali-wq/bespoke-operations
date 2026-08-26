import {
  isIspBillingDocumentType,
  isIspBillingVatCondition,
  normalizeCuitDigits,
} from "@/lib/isp/billing-integrity"
import type {
  IspBillingCompanySettings,
  IspBillingCompanySettingsDraft,
  IspBillingDocumentSequence,
  IspBillingIntegration,
  IspBillingPointOfSale,
} from "@/lib/isp/billing-types"
import {
  ISP_BILLING_INTEGRATION_ENVIRONMENTS,
  ISP_BILLING_INTEGRATION_STATUSES,
  type IspBillingIntegrationEnvironment,
  type IspBillingIntegrationProvider,
  type IspBillingIntegrationStatus,
} from "@/lib/isp/billing-constants"
import type { Database } from "@/lib/supabase/database.types"

type SettingsRow =
  Database["public"]["Tables"]["isp_billing_company_settings"]["Row"]
type PosRow = Database["public"]["Tables"]["isp_billing_point_of_sales"]["Row"]
type SequenceRow =
  Database["public"]["Tables"]["isp_billing_document_sequences"]["Row"]
type IntegrationRow =
  Database["public"]["Tables"]["isp_billing_integrations"]["Row"]

function isIntegrationStatus(
  value: string
): value is IspBillingIntegrationStatus {
  return (ISP_BILLING_INTEGRATION_STATUSES as readonly string[]).includes(value)
}

function isIntegrationEnvironment(
  value: string | null
): value is IspBillingIntegrationEnvironment {
  return (
    value != null &&
    (ISP_BILLING_INTEGRATION_ENVIRONMENTS as readonly string[]).includes(value)
  )
}

export function mapBillingPointOfSaleRow(row: PosRow): IspBillingPointOfSale {
  return {
    id: row.id,
    companyId: row.company_id,
    number: row.number,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBillingSequenceRow(
  row: SequenceRow
): IspBillingDocumentSequence | null {
  if (!isIspBillingDocumentType(row.document_type)) return null
  return {
    id: row.id,
    companyId: row.company_id,
    pointOfSaleId: row.point_of_sale_id,
    documentType: row.document_type,
    nextNumber: row.next_number,
    issuedCount: row.issued_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBillingIntegrationRow(
  row: IntegrationRow
): IspBillingIntegration | null {
  const provider = row.provider
  if (provider !== "arca" && provider !== "siro") return null
  return {
    provider,
    status: isIntegrationStatus(row.status) ? row.status : "not_configured",
    environment: isIntegrationEnvironment(row.environment)
      ? row.environment
      : null,
    lastSyncAt: row.last_sync_at,
  }
}

export function mapBillingCompanySettings(input: {
  settings: SettingsRow
  pointOfSale: IspBillingPointOfSale | null
  sequences: IspBillingDocumentSequence[]
  integrations: IspBillingIntegration[]
}): IspBillingCompanySettings {
  return {
    id: input.settings.id,
    companyId: input.settings.company_id,
    legalName: input.settings.legal_name,
    taxId: input.settings.tax_id,
    vatCondition: isIspBillingVatCondition(input.settings.vat_condition)
      ? input.settings.vat_condition
      : null,
    taxAddress: input.settings.tax_address,
    city: input.settings.city,
    province: input.settings.province,
    postalCode: input.settings.postal_code,
    phone: input.settings.phone,
    email: input.settings.email,
    website: input.settings.website,
    logoUrl: input.settings.logo_url,
    active: input.settings.active,
    createdAt: input.settings.created_at,
    updatedAt: input.settings.updated_at,
    pointOfSale: input.pointOfSale,
    sequences: input.sequences,
    integrations: input.integrations,
  }
}

export function mapBillingDraftToSettingsInsert(
  companyId: string,
  draft: IspBillingCompanySettingsDraft
) {
  return {
    company_id: companyId,
    legal_name: draft.legalName.trim(),
    tax_id: normalizeCuitDigits(draft.taxId),
    vat_condition: draft.vatCondition || "responsable_inscripto",
    tax_address: draft.taxAddress.trim(),
    city: draft.city.trim(),
    province: draft.province.trim(),
    postal_code: draft.postalCode.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim(),
    website: draft.website.trim(),
    logo_url: draft.logoUrl.trim() || null,
    active: true,
  }
}

export function defaultIntegrations(
  providers: readonly IspBillingIntegrationProvider[] = ["arca", "siro"]
): IspBillingIntegration[] {
  return providers.map((provider) => ({
    provider,
    status: "not_configured" as const,
    environment: null,
    lastSyncAt: null,
  }))
}
