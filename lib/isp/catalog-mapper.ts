import {
  isIspCatalogCategory,
  isIspCatalogConnectionType,
  isIspCatalogCustomerType,
  isIspCatalogTechnology,
  parseOptionalNonNegativeNumber,
} from "@/lib/isp/catalog-integrity"
import type {
  IspCatalogDraft,
  IspCatalogItem,
  IspTechnicalProfile,
  IspTechnicalProfileDraft,
} from "@/lib/isp/catalog-types"
import type { Database } from "@/lib/supabase/database.types"

type IspServiceCatalogRow =
  Database["public"]["Tables"]["isp_service_catalog"]["Row"]
type IspServiceCatalogInsert =
  Database["public"]["Tables"]["isp_service_catalog"]["Insert"]
type IspTechnicalProfileRow =
  Database["public"]["Tables"]["isp_technical_profiles"]["Row"]
type IspTechnicalProfileInsert =
  Database["public"]["Tables"]["isp_technical_profiles"]["Insert"]

function mapAllowedConnectionTypes(
  value: unknown
): IspCatalogItem["allowedConnectionTypes"] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is IspCatalogItem["allowedConnectionTypes"][number] =>
      typeof item === "string" && isIspCatalogConnectionType(item)
  )
}

export function mapIspTechnicalProfileRow(
  row: IspTechnicalProfileRow
): IspTechnicalProfile {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    description: row.description,
    technology:
      row.technology && isIspCatalogTechnology(row.technology)
        ? row.technology
        : null,
    connectionType:
      row.connection_type && isIspCatalogConnectionType(row.connection_type)
        ? row.connection_type
        : null,
    downloadSpeed: row.download_speed,
    uploadSpeed: row.upload_speed,
    speedUnit: row.speed_unit || "mbps",
    coreName: row.core_name,
    coreProfileId: row.core_profile_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapTechnicalProfileDraftToInsert(
  companyId: string,
  draft: IspTechnicalProfileDraft
): IspTechnicalProfileInsert {
  return {
    company_id: companyId,
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    technology: draft.technology || null,
    connection_type: draft.connectionType || null,
    download_speed: parseOptionalNonNegativeNumber(draft.downloadSpeed),
    upload_speed: parseOptionalNonNegativeNumber(draft.uploadSpeed),
    speed_unit: draft.speedUnit.trim() || "mbps",
    core_name: draft.coreName.trim() || null,
    core_profile_id: draft.coreProfileId.trim() || null,
    is_active: draft.isActive,
  }
}

export function mapIspCatalogRow(
  row: IspServiceCatalogRow,
  usedCount = 0,
  technicalProfile: IspTechnicalProfile | null = null
): IspCatalogItem {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    externalCode: row.external_code,
    category: isIspCatalogCategory(row.category) ? row.category : row.category,
    customerType: isIspCatalogCustomerType(row.customer_type)
      ? row.customer_type
      : "both",
    description: row.description,
    isActive: row.is_active,
    technology: row.technology && isIspCatalogTechnology(row.technology)
      ? row.technology
      : null,
    downloadSpeedMbps: row.download_speed_mbps,
    uploadSpeedMbps: row.upload_speed_mbps,
    speedUnit: row.speed_unit || "mbps",
    monthlyPrice: row.monthly_price,
    currency: row.currency || "ARS",
    priceIsConfigurable: row.price_is_configurable,
    billingPeriod: row.billing_period === "monthly" ? "monthly" : "monthly",
    billingMethod: row.billing_method === "siro" ? "siro" : "siro",
    requiresConnection: row.requires_connection,
    allowedConnectionTypes: mapAllowedConnectionTypes(
      row.allowed_connection_types
    ),
    technicalProfileId: row.technical_profile_id,
    technicalProfile,
    otLabel: row.ot_label,
    legacyPlanCode: row.legacy_plan_code,
    isSeed: row.is_seed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usedCount,
  }
}

export function mapCatalogDraftToInsert(
  companyId: string,
  draft: IspCatalogDraft,
  technicalProfileId: string | null = null
): IspServiceCatalogInsert {
  return {
    company_id: companyId,
    code: draft.code.trim(),
    name: draft.name.trim(),
    category: draft.category.trim() || "other",
    customer_type: draft.customerType || "both",
    description: draft.description.trim() || null,
    is_active: draft.isActive,
    technology: draft.technology || null,
    download_speed_mbps: parseOptionalNonNegativeNumber(draft.downloadSpeedMbps),
    upload_speed_mbps: parseOptionalNonNegativeNumber(draft.uploadSpeedMbps),
    speed_unit: draft.speedUnit.trim() || "mbps",
    monthly_price: parseOptionalNonNegativeNumber(draft.monthlyPrice),
    currency: draft.currency.trim() || "ARS",
    price_is_configurable: draft.priceIsConfigurable,
    billing_period: draft.billingPeriod,
    billing_method: draft.billingMethod,
    requires_connection: draft.requiresConnection,
    allowed_connection_types: draft.requiresConnection
      ? draft.allowedConnectionTypes
      : [],
    technical_profile_id: technicalProfileId,
    ot_label: draft.otLabel.trim() || null,
  }
}
