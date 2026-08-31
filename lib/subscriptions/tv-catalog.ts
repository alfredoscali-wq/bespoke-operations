import {
  emptyCatalogDraft,
  parseOptionalNonNegativeNumber,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogDraft } from "@/lib/isp/catalog-types"
import { TV_CATALOG_CATEGORY } from "@/lib/subscriptions/tv-plans"

export const TV_PLAN_NAME_REQUIRED_MESSAGE = "Indique el nombre comercial."
export const TV_PLAN_CODE_REQUIRED_MESSAGE = "Indique el código."
export const TV_PLAN_PRICE_INVALID_MESSAGE =
  "Indique un precio mensual mayor o igual a 0."
export const TV_PLAN_CODE_LOCKED_MESSAGE =
  "El código no se puede cambiar porque el plan ya está en uso."
export const TV_PLAN_NOT_TV_CATEGORY_MESSAGE =
  "Solo se pueden administrar planes de categoría TV."
export const TV_PLAN_INTERNET_FORBIDDEN_MESSAGE =
  "No se pueden crear planes de Internet desde TV & Suscripciones."

export type TvPlanWriteDraft = {
  name: string
  code: string
  monthlyPrice: string
  isActive: boolean
}

export function validateTvPlanWriteDraft(
  draft: TvPlanWriteDraft
): { valid: boolean; message?: string } {
  if (!draft.name.trim()) {
    return { valid: false, message: TV_PLAN_NAME_REQUIRED_MESSAGE }
  }
  if (!draft.code.trim()) {
    return { valid: false, message: TV_PLAN_CODE_REQUIRED_MESSAGE }
  }
  const price = parseOptionalNonNegativeNumber(draft.monthlyPrice)
  if (price == null) {
    return { valid: false, message: TV_PLAN_PRICE_INVALID_MESSAGE }
  }
  return { valid: true }
}

export function canChangeTvPlanCode(usedCount: number): boolean {
  return usedCount <= 0
}

export function tvPlanWriteDraftToCatalogDraft(
  draft: TvPlanWriteDraft
): IspCatalogDraft {
  return {
    ...emptyCatalogDraft(),
    code: draft.code.trim(),
    name: draft.name.trim(),
    category: TV_CATALOG_CATEGORY,
    customerType: "both",
    monthlyPrice: draft.monthlyPrice.trim(),
    isActive: draft.isActive,
    requiresConnection: false,
    billingMethod: "siro",
    billingPeriod: "monthly",
    includesTv: false,
    tvPlanCatalogId: "",
    allowedConnectionTypes: [],
  }
}

export function isTvOnlyCatalogWrite(category: string | null | undefined): boolean {
  return category?.trim().toLowerCase() === TV_CATALOG_CATEGORY
}
