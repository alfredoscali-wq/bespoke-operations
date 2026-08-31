import type { IspCommercialStatus } from "@/lib/isp/constants"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export const TV_CATALOG_CATEGORY = "tv" as const

/** Seed codes from TV 1.0. New company plans are not limited to this list. */
export const TV_PLAN_CODES = {
  BASICO: "TV-BASICO",
  BASICO_FUTBOL: "TV-BASICO-FUTBOL",
  FULL: "TV-FULL",
} as const

export type TvPlanCode = (typeof TV_PLAN_CODES)[keyof typeof TV_PLAN_CODES]

export const TV_PLAN_CODE_LIST: readonly TvPlanCode[] = [
  TV_PLAN_CODES.BASICO,
  TV_PLAN_CODES.BASICO_FUTBOL,
  TV_PLAN_CODES.FULL,
]

export const TV_PLAN_NAMES: Record<TvPlanCode, string> = {
  [TV_PLAN_CODES.BASICO]: "TV Básico",
  [TV_PLAN_CODES.BASICO_FUTBOL]: "TV Básico + Pack Fútbol",
  [TV_PLAN_CODES.FULL]: "TV Full",
}

export const TV_PLAN_PRICES: Record<TvPlanCode, number> = {
  [TV_PLAN_CODES.BASICO]: 4500,
  [TV_PLAN_CODES.BASICO_FUTBOL]: 7500,
  [TV_PLAN_CODES.FULL]: 9900,
}

export const TV_KPI_ACTIVE_STATUS: IspCommercialStatus = "active"

export const DEFAULT_TV_LIST_PAGE_SIZE = 50

export const TV_KPI_TONES: readonly VisualTone[] = [
  "blue",
  "violet",
  "amber",
  "orange",
]

export type TvPlanDefinition = {
  code: TvPlanCode
  name: string
  monthlyPrice: number
}

export const TV_PLAN_DEFINITIONS: readonly TvPlanDefinition[] =
  TV_PLAN_CODE_LIST.map((code) => ({
    code,
    name: TV_PLAN_NAMES[code],
    monthlyPrice: TV_PLAN_PRICES[code],
  }))

export function isTvPlanCode(
  value: string | null | undefined
): value is TvPlanCode {
  return TV_PLAN_CODE_LIST.includes(value as TvPlanCode)
}

export function isTvCatalogCategory(
  category: string | null | undefined
): boolean {
  return category?.trim().toLowerCase() === TV_CATALOG_CATEGORY
}

export function formatTvMoney(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function tvPlanRevenue(
  activeCount: number,
  monthlyPrice: number
): number {
  const count =
    Number.isFinite(activeCount) && activeCount > 0 ? activeCount : 0
  const price =
    Number.isFinite(monthlyPrice) && monthlyPrice >= 0 ? monthlyPrice : 0
  return count * price
}

export type TvPlanKpi = {
  code: string
  catalogId: string
  name: string
  monthlyPrice: number
  isActive: boolean
  activeCount: number
  monthlyRevenue: number
}

export type TvDeskSummary = {
  plans: TvPlanKpi[]
  totalActiveCustomers: number
  totalMonthlyRevenue: number
}

export function summarizeTvPlans(
  plans: ReadonlyArray<
    Pick<
      TvPlanKpi,
      "code" | "catalogId" | "name" | "monthlyPrice" | "activeCount"
    > & { isActive?: boolean }
  >
): TvDeskSummary {
  const normalized: TvPlanKpi[] = plans.map((plan) => {
    const activeCount =
      Number.isFinite(plan.activeCount) && plan.activeCount > 0
        ? plan.activeCount
        : 0
    const monthlyPrice =
      Number.isFinite(plan.monthlyPrice) && plan.monthlyPrice >= 0
        ? plan.monthlyPrice
        : 0
    return {
      code: plan.code,
      catalogId: plan.catalogId,
      name: plan.name,
      monthlyPrice,
      isActive: plan.isActive ?? true,
      activeCount,
      monthlyRevenue: tvPlanRevenue(activeCount, monthlyPrice),
    }
  })

  return {
    plans: normalized,
    totalActiveCustomers: normalized.reduce(
      (sum, plan) => sum + plan.activeCount,
      0
    ),
    totalMonthlyRevenue: normalized.reduce(
      (sum, plan) => sum + plan.monthlyRevenue,
      0
    ),
  }
}

export type TvListStatusFilter =
  | "active"
  | "pending_activation"
  | "suspended"
  | "cancelled"
  | "all"

export type TvSelectedPlanFilter = "all" | string

export type TvSelectedCommercialFilter = "all" | string

export type TvCommercialServiceOption = {
  id: string
  name: string
  tvPlanCatalogId: string
}

export const EMPTY_TV_DESK_FILTERS = {
  selectedPlan: "all" as const,
  selectedCommercialId: "all" as const,
  status: "all" as const,
  search: "",
}

export function uniqueTvCommercialIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

export function resolveTvListCommercialIds(input: {
  commercialIdsByTvPlan: ReadonlyMap<string, readonly string[]>
  selectedPlan: TvSelectedPlanFilter
  selectedCommercialId: TvSelectedCommercialFilter
}): string[] {
  const fromPlan =
    input.selectedPlan === "all"
      ? [...input.commercialIdsByTvPlan.values()].flat()
      : [...(input.commercialIdsByTvPlan.get(input.selectedPlan) ?? [])]
  const unique = uniqueTvCommercialIds(fromPlan)
  if (input.selectedCommercialId === "all") return unique
  return unique.filter((id) => id === input.selectedCommercialId)
}

export function commercialOptionsForPlan(
  options: readonly TvCommercialServiceOption[],
  selectedPlan: TvSelectedPlanFilter
): TvCommercialServiceOption[] {
  if (selectedPlan === "all") return [...options]
  return options.filter((option) => option.tvPlanCatalogId === selectedPlan)
}

export function hasTvDeskListFilters(input: {
  selectedPlan: TvSelectedPlanFilter
  selectedCommercialId: TvSelectedCommercialFilter
  status: TvListStatusFilter
  search: string
}): boolean {
  return (
    input.selectedPlan !== "all" ||
    input.selectedCommercialId !== "all" ||
    input.status !== "all" ||
    input.search.trim() !== ""
  )
}

export function formatTvListCount(total: number): string {
  const count = Number.isFinite(total) && total > 0 ? total : 0
  if (count === 1) return "Mostrando 1 cliente"
  return `Mostrando ${count} clientes`
}

export function tvDeskEmptyListMessage(input: {
  selectedPlanName: string | null
  hasFilters: boolean
}): string {
  if (input.selectedPlanName) {
    return `No hay clientes con ${input.selectedPlanName} que coincidan con los filtros seleccionados.`
  }
  if (input.hasFilters) {
    return "No hay clientes con TV que coincidan con los filtros seleccionados."
  }
  return "Aún no hay clientes con componente TV."
}

export function tvServiceBelongsToCompany(
  serviceCompanyId: string,
  actorCompanyId: string
): boolean {
  return serviceCompanyId === actorCompanyId
}

export function isCountableTvService(input: {
  companyId: string
  actorCompanyId: string
  tvPlanCatalogId: string | null | undefined
  commercialStatus: string | null | undefined
  deletedAt?: string | null
}): boolean {
  if (!tvServiceBelongsToCompany(input.companyId, input.actorCompanyId)) {
    return false
  }
  if (input.deletedAt) return false
  if (!input.tvPlanCatalogId) return false
  return input.commercialStatus === TV_KPI_ACTIVE_STATUS
}

export function serviceMatchesSelectedPlan(input: {
  tvPlanCatalogId: string | null | undefined
  selected: TvSelectedPlanFilter
}): boolean {
  if (input.selected === "all") return Boolean(input.tvPlanCatalogId)
  return input.tvPlanCatalogId === input.selected
}

export function matchesTvListSearch(
  row: {
    customerName: string
    phone: string
    locality: string
    dni: string
    customerNumber: string
    commercialPlanName?: string
    whatsapp?: string
  },
  search: string
): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return [
    row.customerName,
    row.phone,
    row.whatsapp ?? "",
    row.locality,
    row.dni,
    row.customerNumber,
    row.commercialPlanName ?? "",
  ].some((value) => value.toLowerCase().includes(needle))
}

export function tvKpiTone(index: number): VisualTone {
  return TV_KPI_TONES[index % TV_KPI_TONES.length] ?? "blue"
}
