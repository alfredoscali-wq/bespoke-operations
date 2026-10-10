import { resolveCommercialListPrice } from "@/lib/isp/commercial-assignment"
import { calculateCommercialPrice } from "@/lib/isp/commercial-pricing"
import {
  commercialTvTier,
  PACK_FUTBOL_CODE,
  type CommercialTvTier,
} from "@/lib/subscriptions/pack-futbol"
import type {
  TvConditionFilter,
  TvPackFilter,
  TvTierFilter,
} from "@/lib/subscriptions/tv-plans"

export const TV_BASICO_INCLUDED_CODE = "TV-BASICO"
export const JUBILADO_CONDITION_CODE = "JUBILADO"
export const TV_DESK_ACTIVE_STATUS = "active"

export type TvCommercialComponentPrice = {
  unitPrice: number
  isRecurring: boolean
}

export function includedTvIsBasico(code: string | null | undefined): boolean {
  return code?.trim().toUpperCase() === TV_BASICO_INCLUDED_CODE
}

export function hasPackFutbol(codes: readonly string[]): boolean {
  return codes.some((code) => code.trim().toUpperCase() === PACK_FUTBOL_CODE)
}

export function isJubiladoCondition(code: string | null | undefined): boolean {
  return code?.trim().toUpperCase() === JUBILADO_CONDITION_CODE
}

export function classifyCommercialTvSubscription(input: {
  includedTvCode: string | null
  activeComponentCodes: readonly string[]
  conditionCode?: string | null
}): {
  tier: CommercialTvTier
  packFutbol: boolean
  jubilado: boolean
  represented: boolean
} {
  const tier = commercialTvTier({
    includedTvCode: input.includedTvCode,
    activeComponentCodes: input.activeComponentCodes,
  })
  const represented = tier === "basica" || tier === "full"
  return {
    tier,
    packFutbol: hasPackFutbol(input.activeComponentCodes),
    jubilado: isJubiladoCondition(input.conditionCode),
    represented,
  }
}

export function commercialDeskMonthlyFee(input: {
  listPrice: number | null
  catalogMonthlyPrice: number | null
  components: readonly TvCommercialComponentPrice[]
  discountPercent: number | null
}): number | null {
  const listPrice = resolveCommercialListPrice(
    input.listPrice,
    input.catalogMonthlyPrice
  )
  if (listPrice == null) return null
  return calculateCommercialPrice({
    listPrice,
    components: input.components.map((component) => ({
      unitPrice: component.unitPrice,
      isRecurring: component.isRecurring,
      status: "active" as const,
    })),
    discountPercent: input.discountPercent,
  }).monthlyFee
}

export function customerExternalNumber(
  code: string | null | undefined
): string | null {
  const trimmed = code?.trim() ?? ""
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return trimmed
  const normalized = String(Number(trimmed))
  return normalized === "0" ? null : normalized
}

export type TvCommercialDeskFact = {
  serviceId: string
  customerId: string
  tvTier: CommercialTvTier
  packFutbolActive: boolean
  jubilado: boolean
  commercialStatus: string
  commercialMonthlyFee: number | null
  commercialCatalogId?: string
  customerName?: string
  phone?: string
  locality?: string
  dni?: string
  customerNumber?: string
  externalCustomerNumber?: string | null
  commercialPlanName?: string
}

export type TvCommercialDeskSummary = {
  basicaCustomers: number
  fullCustomers: number
  packFutbolCustomers: number
  totalCustomers: number
  monthlyRevenue: number
}

export function uniqueCustomerCount(
  rows: readonly { customerId: string }[]
): number {
  return new Set(rows.map((row) => row.customerId)).size
}

export function summarizeTvCommercialDesk(
  rows: readonly TvCommercialDeskFact[]
): TvCommercialDeskSummary {
  const current = rows.filter(
    (row) =>
      row.commercialStatus === TV_DESK_ACTIVE_STATUS &&
      (row.tvTier === "basica" || row.tvTier === "full")
  )
  const monthlyRevenue = current.reduce((sum, row) => {
    if (row.commercialMonthlyFee == null) return sum
    return sum + row.commercialMonthlyFee
  }, 0)
  return {
    basicaCustomers: uniqueCustomerCount(
      current.filter((row) => row.tvTier === "basica")
    ),
    fullCustomers: uniqueCustomerCount(
      current.filter((row) => row.tvTier === "full")
    ),
    packFutbolCustomers: uniqueCustomerCount(
      current.filter((row) => row.packFutbolActive)
    ),
    totalCustomers: uniqueCustomerCount(current),
    monthlyRevenue,
  }
}

export function matchesTvCommercialDeskFilters(
  row: TvCommercialDeskFact,
  filters: {
    tvTier: TvTierFilter
    pack: TvPackFilter
    condition: TvConditionFilter
    selectedCommercialId: string
    status: string
    search: string
  }
): boolean {
  if (row.tvTier !== "basica" && row.tvTier !== "full") return false
  if (filters.tvTier !== "all" && row.tvTier !== filters.tvTier) return false
  if (filters.pack === "with_pack" && !row.packFutbolActive) return false
  if (filters.pack === "without_pack" && row.packFutbolActive) return false
  if (filters.condition === "jubilado" && !row.jubilado) return false
  if (filters.status !== "all" && row.commercialStatus !== filters.status) {
    return false
  }
  if (
    filters.selectedCommercialId !== "all" &&
    row.commercialCatalogId !== filters.selectedCommercialId
  ) {
    return false
  }
  const needle = filters.search.trim().toLowerCase()
  if (!needle) return true
  return [
    row.customerName ?? "",
    row.phone ?? "",
    row.locality ?? "",
    row.dni ?? "",
    row.customerNumber ?? "",
    row.externalCustomerNumber ?? "",
    row.commercialPlanName ?? "",
  ].some((value) => value.toLowerCase().includes(needle))
}
