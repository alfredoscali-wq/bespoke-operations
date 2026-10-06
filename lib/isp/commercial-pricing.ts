import { roundBillingMoney } from "@/lib/isp/billing-document-integrity"

export const ISP_COMMERCIAL_COMPONENT_TYPES = ["addon", "tv_upgrade"] as const
export type IspCommercialComponentType =
  (typeof ISP_COMMERCIAL_COMPONENT_TYPES)[number]

export const ISP_COMMERCIAL_ASSIGNMENT_STATUSES = ["active", "cancelled"] as const
export type IspCommercialAssignmentStatus =
  (typeof ISP_COMMERCIAL_ASSIGNMENT_STATUSES)[number]

/**
 * Evaluated against the base isp_service_catalog row and the TV plan
 * referenced by tv_plan_catalog_id. Price math does not read this object
 * and does not branch on component code.
 */
export type IspCommercialCompatibility = {
  category?: "internet"
  requiresIncludedTv?: boolean
  includedTvCode?: string
}

export type IspCommercialCatalogContext = {
  category: string | null
  includedTvCode: string | null
}

export type IspCommercialComponentAssignment = {
  unitPrice: number
  isRecurring: boolean
  status: IspCommercialAssignmentStatus
}

export type IspCommercialPriceInput = {
  listPrice: number | null
  components: readonly IspCommercialComponentAssignment[]
  discountPercent: number | null
}

export type IspCommercialPrice = {
  priceSubtotal: number
  discountAmount: number
  monthlyFee: number
}

export const ISP_COMMERCIAL_PRICE_MISSING_BASE =
  "El abono base no tiene precio de lista."
export const ISP_COMMERCIAL_COMPONENT_INACTIVE =
  "El componente comercial no está activo."
export const ISP_COMMERCIAL_COMPONENT_PRICE_MISSING =
  "El componente comercial no tiene precio y no se puede asignar."
export const ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE =
  "El componente comercial no aplica a este abono base."
export const ISP_COMMERCIAL_DISCOUNT_INVALID =
  "El porcentaje de descuento debe estar entre 0 y 100."

export function componentMatchesCatalog(
  compatibility: IspCommercialCompatibility,
  catalog: IspCommercialCatalogContext
): boolean {
  if (
    compatibility.category &&
    catalog.category?.trim().toLowerCase() !== compatibility.category
  ) {
    return false
  }

  const includedTvCode = catalog.includedTvCode?.trim() || null
  if (compatibility.requiresIncludedTv && !includedTvCode) {
    return false
  }

  if (compatibility.includedTvCode) {
    return (
      includedTvCode?.toLowerCase() ===
      compatibility.includedTvCode.trim().toLowerCase()
    )
  }

  return true
}

export function commercialComponentAssignmentError(input: {
  isActive: boolean
  monthlyPrice: number | null
  compatibility: IspCommercialCompatibility
  catalog: IspCommercialCatalogContext
}): string | null {
  if (!input.isActive) return ISP_COMMERCIAL_COMPONENT_INACTIVE
  if (input.monthlyPrice == null || input.monthlyPrice < 0) {
    return ISP_COMMERCIAL_COMPONENT_PRICE_MISSING
  }
  if (!componentMatchesCatalog(input.compatibility, input.catalog)) {
    return ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE
  }
  return null
}

export function calculateCommercialPrice(
  input: IspCommercialPriceInput
): IspCommercialPrice {
  if (input.listPrice == null || input.listPrice < 0) {
    throw new Error(ISP_COMMERCIAL_PRICE_MISSING_BASE)
  }

  const percent = input.discountPercent ?? 0
  if (percent < 0 || percent > 100) {
    throw new Error(ISP_COMMERCIAL_DISCOUNT_INVALID)
  }

  const componentsTotal = input.components.reduce((sum, component) => {
    if (component.status !== "active" || !component.isRecurring) return sum
    return sum + component.unitPrice
  }, 0)

  const priceSubtotal = roundBillingMoney(input.listPrice + componentsTotal)
  const discountAmount = roundBillingMoney((priceSubtotal * percent) / 100)
  const monthlyFee = roundBillingMoney(Math.max(0, priceSubtotal - discountAmount))

  return { priceSubtotal, discountAmount, monthlyFee }
}
