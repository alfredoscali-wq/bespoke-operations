import {
  CATALOG_TECHNOLOGY_TO_OT,
  ISP_CATALOG_BILLING_METHODS,
  ISP_CATALOG_BILLING_PERIODS,
  ISP_CATALOG_CATEGORIES,
  ISP_CATALOG_CATEGORY_LABELS,
  ISP_CATALOG_CONNECTION_TYPE_LABELS,
  ISP_CATALOG_CONNECTION_TYPES,
  ISP_CATALOG_CUSTOMER_TYPES,
  ISP_CATALOG_SPEED_UNIT_LABELS,
  ISP_CATALOG_TECHNOLOGIES,
  ISP_CATALOG_TECHNOLOGY_LABELS,
  OT_TECHNOLOGY_TO_CATALOG,
  type IspCatalogCategory,
  type IspCatalogConnectionType,
  type IspCatalogCustomerType,
  type IspCatalogTechnology,
} from "@/lib/isp/catalog-constants"
import type {
  IspCatalogDraft,
  IspCatalogItem,
  IspCatalogListFilters,
  IspCatalogServiceSnapshot,
  IspCatalogTvPlan,
  IspOtPlanOption,
  IspTechnicalProfile,
  IspTechnicalProfileDraft,
} from "@/lib/isp/catalog-types"
import type { IspConnectionType, IspTechnology } from "@/lib/isp/constants"
import { isIspConnectionType } from "@/lib/isp/labels"
import type { WorkOrderTechnology } from "@/lib/tasks/commercial-plan"

export const ISP_CATALOG_NAME_REQUIRED_MESSAGE = "Indique el nombre comercial."
export const ISP_CATALOG_CODE_REQUIRED_MESSAGE = "Indique el código."
export const ISP_CATALOG_CODE_UNIQUE_MESSAGE =
  "Ya existe un servicio con este código."
export const ISP_CATALOG_NAME_UNIQUE_MESSAGE =
  "Ya existe un servicio con este nombre."
export const ISP_CATALOG_CATEGORY_REQUIRED_MESSAGE = "Indique la categoría."
export const ISP_CATALOG_CUSTOMER_TYPE_REQUIRED_MESSAGE =
  "Indique el tipo de cliente."
export const ISP_CATALOG_USED_CANNOT_DELETE_MESSAGE =
  "Este servicio está siendo utilizado y no puede eliminarse."
export const ISP_CATALOG_DELETE_CONFIRM_TITLE = "¿Eliminar este servicio?"
export const ISP_CATALOG_DELETE_CONFIRM_BODY =
  "Esta acción quitará el servicio del catálogo."
export const ISP_CATALOG_USED_DEACTIVATE_EXPLANATION =
  "Hay clientes, órdenes de trabajo u otras referencias vinculadas. Desactivarlo lo oculta para nuevas asignaciones; los clientes y abonos existentes no cambian. El plan TV asociado, si existe, no se modifica."
export const ISP_CATALOG_DEACTIVATE_ACTION_LABEL = "Desactivar servicio"
export const ISP_CATALOG_IN_USE_CODE = "IN_USE"
export const ISP_CATALOG_CROSS_COMPANY_MESSAGE =
  "No se puede usar un catálogo de otra empresa."
export const ISP_CATALOG_INACTIVE_HIDDEN_FROM_NEW_OT_MESSAGE =
  "Los servicios inactivos no aparecen en nuevas OT."
export const ISP_CATALOG_PROFILE_CROSS_COMPANY_MESSAGE =
  "El servicio no puede usar un perfil técnico de otra empresa."
export const ISP_CATALOG_PROFILE_NOT_FOUND_MESSAGE =
  "El servicio requiere un perfil técnico existente."
export const ISP_CATALOG_PROFILE_INACTIVE_MESSAGE =
  "El perfil técnico no está activo."
export const ISP_CATALOG_TV_PLAN_REQUIRED_MESSAGE =
  "Seleccione el plan TV."
export const ISP_CATALOG_TV_PLAN_NOT_FOUND_MESSAGE =
  "El componente TV requiere un plan TV existente."
export const ISP_CATALOG_TV_PLAN_CROSS_COMPANY_MESSAGE =
  "El servicio no puede usar un plan TV de otra empresa."
export const ISP_CATALOG_TV_PLAN_CATEGORY_MESSAGE =
  "El componente TV debe ser un plan de categoría TV."
export const ISP_CATALOG_TV_PLAN_INACTIVE_MESSAGE =
  "El plan TV no está activo."
export const ISP_CATALOG_TV_PLAN_SELF_MESSAGE =
  "El componente TV no puede referenciar el mismo servicio."
export const ISP_TECHNICAL_PROFILE_CODE_REQUIRED_MESSAGE =
  "Indique el código del perfil técnico."
export const ISP_TECHNICAL_PROFILE_NAME_REQUIRED_MESSAGE =
  "Indique el nombre del perfil técnico."
export const ISP_TECHNICAL_PROFILE_CODE_UNIQUE_MESSAGE =
  "Ya existe un perfil técnico con este código."

export const ISP_CATALOG_SUBSCRIBER_NETWORK_FIELDS = [
  "ipAddress",
  "ip_address",
  "pppoeUsername",
  "pppoe_username",
  "pppoePassword",
  "pppoe_password",
  "mac",
  "macAddress",
  "serialNumber",
  "serial_number",
] as const

export function isIspCatalogCategory(
  value: string
): value is IspCatalogCategory {
  return (ISP_CATALOG_CATEGORIES as readonly string[]).includes(value)
}

export function isIspCatalogCustomerType(
  value: string
): value is IspCatalogCustomerType {
  return (ISP_CATALOG_CUSTOMER_TYPES as readonly string[]).includes(value)
}

export function isIspCatalogTechnology(
  value: string
): value is IspCatalogTechnology {
  return (ISP_CATALOG_TECHNOLOGIES as readonly string[]).includes(value)
}

export function isIspCatalogConnectionType(
  value: string
): value is IspCatalogConnectionType {
  return (ISP_CATALOG_CONNECTION_TYPES as readonly string[]).includes(value)
}

export function catalogCategoryLabel(category: string): string {
  if (isIspCatalogCategory(category)) {
    return ISP_CATALOG_CATEGORY_LABELS[category]
  }
  return category.trim() || "—"
}

export function catalogTechnologyLabel(
  technology: string | null | undefined
): string {
  if (!technology) return "No aplica"
  if (isIspCatalogTechnology(technology)) {
    return ISP_CATALOG_TECHNOLOGY_LABELS[technology]
  }
  return technology
}

export function catalogConnectionTypeLabel(type: string): string {
  if (isIspCatalogConnectionType(type)) {
    return ISP_CATALOG_CONNECTION_TYPE_LABELS[type]
  }
  return type
}

export function formatCatalogSpeedUnit(unit?: string | null): string {
  const normalized = (unit ?? "mbps").trim().toLowerCase()
  return ISP_CATALOG_SPEED_UNIT_LABELS[normalized] ?? (unit?.trim() || "Mbps")
}

export function mapOtTechnologyToCatalog(
  technology: WorkOrderTechnology | ""
): IspCatalogTechnology | null {
  if (technology === "fiber" || technology === "wireless") {
    return OT_TECHNOLOGY_TO_CATALOG[technology]
  }
  return null
}

export function mapCatalogTechnologyToOt(
  technology: IspCatalogTechnology | null
): WorkOrderTechnology | "" {
  if (!technology) return ""
  return CATALOG_TECHNOLOGY_TO_OT[technology] ?? ""
}

export function mapCatalogTechnologyToIsp(
  technology: IspCatalogTechnology | null
): IspTechnology | "" {
  if (technology === "ftth" || technology === "wireless") return technology
  return ""
}

export function parseOptionalNonNegativeNumber(
  value: string | number | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  const trimmed = String(value ?? "").trim().replace(",", ".")
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function formatCatalogSpeedValue(
  value: number | null | undefined,
  unit?: string | null
): string {
  if (value == null) return "—"
  return `${value} ${formatCatalogSpeedUnit(unit)}`
}

export function formatCatalogSpeed(
  downloadSpeedMbps: number | null | undefined,
  uploadSpeedMbps?: number | null,
  unit?: string | null
): string {
  const unitLabel = formatCatalogSpeedUnit(unit)
  if (downloadSpeedMbps == null && uploadSpeedMbps == null) return ""
  const downloadLabel =
    downloadSpeedMbps == null ? "—" : String(downloadSpeedMbps)
  const uploadLabel = uploadSpeedMbps == null ? "—" : String(uploadSpeedMbps)
  return `${downloadLabel}/${uploadLabel} ${unitLabel}`
}

export function didCopyDownloadSpeedToUpload(input: {
  download: number | null | undefined
  upload: number | null | undefined
  copiedAutomatically?: boolean
}): boolean {
  if (!input.copiedAutomatically) return false
  if (input.download == null || input.upload == null) return false
  return input.download === input.upload
}

export function withIndependentDownloadSpeed<
  T extends { downloadSpeedMbps: string; uploadSpeedMbps: string },
>(draft: T, downloadSpeedMbps: string): T {
  return { ...draft, downloadSpeedMbps }
}

export function withIndependentUploadSpeed<
  T extends { downloadSpeedMbps: string; uploadSpeedMbps: string },
>(draft: T, uploadSpeedMbps: string): T {
  return { ...draft, uploadSpeedMbps }
}

export function looksLikeAutoCopiedSymmetricUpload(input: {
  download: number | null | undefined
  upload: number | null | undefined
}): boolean {
  if (input.download == null || input.upload == null) return false
  return input.download === input.upload
}

export function resolveCatalogCharacteristics(
  item: Pick<
    IspCatalogItem,
    | "technology"
    | "downloadSpeedMbps"
    | "uploadSpeedMbps"
    | "speedUnit"
    | "technicalProfile"
  >
): {
  technology: IspCatalogTechnology | null
  downloadSpeedMbps: number | null
  uploadSpeedMbps: number | null
  speedUnit: string
} {
  const profile = item.technicalProfile
  return {
    technology: profile?.technology ?? item.technology,
    downloadSpeedMbps: item.downloadSpeedMbps ?? profile?.downloadSpeed ?? null,
    uploadSpeedMbps: item.uploadSpeedMbps ?? profile?.uploadSpeed ?? null,
    speedUnit: item.speedUnit || profile?.speedUnit || "mbps",
  }
}

export function formatCatalogSpeedLabel(
  item: Pick<
    IspCatalogItem,
    | "downloadSpeedMbps"
    | "uploadSpeedMbps"
    | "speedUnit"
    | "technicalProfile"
  >
): string {
  const resolved = resolveCatalogCharacteristics({
    technology: null,
    ...item,
  })
  return (
    formatCatalogSpeed(
      resolved.downloadSpeedMbps,
      resolved.uploadSpeedMbps,
      resolved.speedUnit
    ) || "—"
  )
}

export function catalogItemToContractedPlanCode(
  item: Pick<IspCatalogItem, "legacyPlanCode" | "downloadSpeedMbps" | "otLabel" | "name">
): string {
  if (item.legacyPlanCode?.trim()) return item.legacyPlanCode.trim()
  if (item.downloadSpeedMbps != null) return `${item.downloadSpeedMbps}Mb`
  return item.otLabel?.trim() || item.name
}

export function catalogItemToOtLabel(
  item: Pick<IspCatalogItem, "otLabel" | "name" | "downloadSpeedMbps">
): string {
  if (item.otLabel?.trim()) return item.otLabel.trim()
  if (item.downloadSpeedMbps != null) return `${item.downloadSpeedMbps} Mb`
  return item.name
}

export function isCatalogItemVisibleInNewOt(
  item: Pick<IspCatalogItem, "isActive"> & { deletedAt?: string | null }
): boolean {
  return item.isActive && !item.deletedAt
}

export function isCatalogCompatibleWithOtTechnology(
  item: Pick<IspCatalogItem, "technology">,
  otTechnology: WorkOrderTechnology | ""
): boolean {
  const mapped = mapOtTechnologyToCatalog(otTechnology)
  if (!mapped) return false
  return item.technology === mapped
}

export function filterCatalogItemsForOt(
  items: IspCatalogItem[],
  otTechnology: WorkOrderTechnology | "",
  options?: { includeId?: string | null; activeOnly?: boolean }
): IspCatalogItem[] {
  return items.filter((item) => {
    if (options?.includeId && item.id === options.includeId) {
      return isCatalogCompatibleWithOtTechnology(item, otTechnology)
    }
    if (options?.activeOnly !== false && !isCatalogItemVisibleInNewOt(item)) {
      return false
    }
    return isCatalogCompatibleWithOtTechnology(item, otTechnology)
  })
}

export function connectionTypesForOnboarding(
  allowedConnectionTypes: readonly string[] | undefined
): IspConnectionType[] {
  if (!allowedConnectionTypes?.length) return []
  return allowedConnectionTypes.filter(isIspConnectionType)
}

export function toOtPlanOption(item: IspCatalogItem): IspOtPlanOption | null {
  const technology = mapCatalogTechnologyToOt(item.technology)
  if (!technology) return null
  return {
    catalogId: item.id,
    label: catalogItemToOtLabel(item),
    contractedPlanCode: catalogItemToContractedPlanCode(item),
    technology,
    downloadSpeedMbps: item.downloadSpeedMbps,
    monthlyPrice: item.monthlyPrice,
    allowedConnectionTypes: connectionTypesForOnboarding(
      item.allowedConnectionTypes
    ),
    requiresConnection: item.requiresConnection,
    isActive: item.isActive,
  }
}

export function buildOtPlanOptionsFromCatalog(
  items: IspCatalogItem[],
  otTechnology: WorkOrderTechnology | "",
  options?: { includeId?: string | null }
): IspOtPlanOption[] {
  return filterCatalogItemsForOt(items, otTechnology, {
    includeId: options?.includeId,
    activeOnly: true,
  })
    .map(toOtPlanOption)
    .filter((option): option is IspOtPlanOption => Boolean(option))
}

export function findCatalogItemForWorkOrder(
  items: IspCatalogItem[],
  input: {
    catalogId?: string | null
    otTechnology: WorkOrderTechnology | ""
    contractedPlan?: string | null
  }
): IspCatalogItem | null {
  if (input.catalogId) {
    const byId = items.find((item) => item.id === input.catalogId)
    if (byId) return byId
  }

  const plan = input.contractedPlan?.trim() ?? ""
  if (!plan) return null

  return (
    items.find((item) => {
      if (
        input.otTechnology &&
        !isCatalogCompatibleWithOtTechnology(item, input.otTechnology)
      ) {
        return false
      }

      return (
        catalogItemToContractedPlanCode(item) === plan ||
        catalogItemToOtLabel(item) === plan ||
        item.name === plan
      )
    }) ?? null
  )
}

export function findCatalogItemByCommercialCode(
  items: Pick<IspCatalogItem, "code" | "id">[],
  code: string
): Pick<IspCatalogItem, "code" | "id"> | null {
  const needle = code.trim().toLowerCase()
  if (!needle) return null
  return (
    items.find((item) => (item.code ?? "").trim().toLowerCase() === needle) ??
    null
  )
}

export function snapshotServiceFromCatalog(
  item: IspCatalogItem
): IspCatalogServiceSnapshot {
  const characteristics = resolveCatalogCharacteristics(item)
  const monthlyFee =
    item.monthlyPrice != null && item.monthlyPrice >= 0
      ? String(item.monthlyPrice)
      : ""
  return {
    catalogId: item.id,
    catalogCode: item.code ?? "",
    planName: item.name,
    technology: mapCatalogTechnologyToIsp(characteristics.technology),
    contractedSpeed: formatCatalogSpeed(
      characteristics.downloadSpeedMbps,
      characteristics.uploadSpeedMbps,
      characteristics.speedUnit
    ),
    downloadSpeed: characteristics.downloadSpeedMbps,
    uploadSpeed: characteristics.uploadSpeedMbps,
    speedUnit: characteristics.speedUnit,
    monthlyFee,
    listPrice: monthlyFee,
    monthlyCollectionMethod:
      item.billingMethod === "siro" ? "siro" : "pending",
    allowedConnectionTypes: connectionTypesForOnboarding(
      item.allowedConnectionTypes
    ),
    requiresConnection: item.requiresConnection,
    technicalProfileId: item.technicalProfileId,
  }
}

export function didCopyCatalogMonthlyPriceToOtAmount(input: {
  otAmountToCollect?: number | null
  catalogMonthlyPrice?: number | null
  copiedAutomatically?: boolean
}): boolean {
  if (!input.copiedAutomatically) return false
  if (input.otAmountToCollect == null || input.catalogMonthlyPrice == null) {
    return false
  }
  return input.otAmountToCollect === input.catalogMonthlyPrice
}

export function didCopyOtAmountToCatalogMonthlyPrice(input: {
  catalogMonthlyPrice?: number | null
  otAmountToCollect?: number | null
  copiedAutomatically?: boolean
}): boolean {
  return didCopyCatalogMonthlyPriceToOtAmount({
    otAmountToCollect: input.otAmountToCollect,
    catalogMonthlyPrice: input.catalogMonthlyPrice,
    copiedAutomatically: input.copiedAutomatically,
  })
}

export function canPhysicallyDeleteCatalogItem(input: {
  usedCount: number
}): { allowed: boolean; message?: string } {
  if (input.usedCount > 0) {
    return { allowed: false, message: ISP_CATALOG_USED_CANNOT_DELETE_MESSAGE }
  }
  return { allowed: true }
}

export type CatalogDeleteDecision = {
  mode: "delete"
  title: string
  description: string
}

export function resolveCatalogDeleteDecision(_input?: {
  blockingReferenceCount?: number
  isActive?: boolean
}): CatalogDeleteDecision {
  return {
    mode: "delete",
    title: ISP_CATALOG_DELETE_CONFIRM_TITLE,
    description: ISP_CATALOG_DELETE_CONFIRM_BODY,
  }
}

export class IspCatalogInUseError extends Error {
  readonly code = ISP_CATALOG_IN_USE_CODE
  readonly canDeactivate = true

  constructor(message = ISP_CATALOG_USED_CANNOT_DELETE_MESSAGE) {
    super(message)
    this.name = "IspCatalogInUseError"
  }
}

export function isIspCatalogInUseError(
  error: unknown
): error is IspCatalogInUseError {
  return error instanceof IspCatalogInUseError
}

export function assertCatalogCompanyMatch(input: {
  companyId: string
  catalogCompanyId?: string | null
}): { ok: boolean; message?: string } {
  if (!input.catalogCompanyId || input.catalogCompanyId === input.companyId) {
    return { ok: true }
  }
  return { ok: false, message: ISP_CATALOG_CROSS_COMPANY_MESSAGE }
}

export function assertCatalogCodeUnique(input: {
  companyId: string
  code: string
  existing: { id: string; companyId: string; code: string | null }[]
  currentId?: string | null
}): { ok: boolean; message?: string } {
  const needle = input.code.trim().toLowerCase()
  if (!needle) {
    return { ok: false, message: ISP_CATALOG_CODE_REQUIRED_MESSAGE }
  }
  const duplicate = input.existing.some(
    (item) =>
      item.companyId === input.companyId &&
      item.id !== input.currentId &&
      (item.code ?? "").trim().toLowerCase() === needle
  )
  if (duplicate) {
    return { ok: false, message: ISP_CATALOG_CODE_UNIQUE_MESSAGE }
  }
  return { ok: true }
}

export function assertTechnicalProfileForCatalog(input: {
  companyId: string
  selectedProfileId: string | null | undefined
  profile:
    | Pick<IspTechnicalProfile, "id" | "companyId" | "isActive">
    | null
    | undefined
  currentlyLinkedProfileId?: string | null
}): { ok: boolean; message?: string } {
  const selected = input.selectedProfileId?.trim() ?? ""
  if (!selected) return { ok: true }

  if (!input.profile || input.profile.id !== selected) {
    return { ok: false, message: ISP_CATALOG_PROFILE_NOT_FOUND_MESSAGE }
  }
  if (input.profile.companyId !== input.companyId) {
    return { ok: false, message: ISP_CATALOG_PROFILE_CROSS_COMPANY_MESSAGE }
  }
  if (
    !input.profile.isActive &&
    input.currentlyLinkedProfileId !== input.profile.id
  ) {
    return { ok: false, message: ISP_CATALOG_PROFILE_INACTIVE_MESSAGE }
  }
  return { ok: true }
}

export function canCatalogItemIncludeTv(
  category: string | null | undefined
): boolean {
  return (category ?? "").trim().toLowerCase() !== "tv"
}

export function resolvedTvPlanCatalogId(
  draft: Pick<IspCatalogDraft, "category" | "includesTv" | "tvPlanCatalogId">
): string | null {
  if (!canCatalogItemIncludeTv(draft.category)) return null
  if (!draft.includesTv) return null
  const id = draft.tvPlanCatalogId.trim()
  return id || null
}

export function catalogItemHasTvComponent(
  item: Pick<IspCatalogItem, "tvPlanCatalogId">
): boolean {
  return Boolean(item.tvPlanCatalogId)
}

export function catalogTvComponentListLabel(
  tvPlan: Pick<IspCatalogTvPlan, "name"> | null | undefined
): string {
  if (!tvPlan?.name.trim()) return "—"
  return tvPlan.name.replace(/^TV\s+/i, "").trim() || tvPlan.name
}

export function isSelectableTvCatalogPlan(
  item: Pick<IspCatalogItem, "id" | "category" | "isActive">,
  options: {
    currentCatalogId?: string | null
    selectedTvPlanId?: string | null
  } = {}
): boolean {
  if (item.category !== "tv") return false
  if (options.currentCatalogId && item.id === options.currentCatalogId) {
    return false
  }
  return item.isActive || item.id === (options.selectedTvPlanId ?? "")
}

export type CommercialTvComponentLookup = {
  commercialCatalogId: string
  commercialName: string
  commercialMonthlyPrice: number | null
  tvPlanCatalogId: string
  tvPlanCode: string | null
  tvPlanName: string
  tvMonthlyPrice: number | null
}

export function resolveCommercialTvComponent(input: {
  actorCompanyId: string
  commercial: Pick<
    IspCatalogItem,
    "id" | "companyId" | "name" | "monthlyPrice" | "tvPlanCatalogId"
  >
  tvPlan:
    | (Pick<
        IspCatalogTvPlan,
        "id" | "companyId" | "code" | "name" | "monthlyPrice"
      > & { category: string })
    | null
    | undefined
}): CommercialTvComponentLookup | null {
  if (input.commercial.companyId !== input.actorCompanyId) return null
  const tvPlanId = input.commercial.tvPlanCatalogId
  if (!tvPlanId) return null
  const plan = input.tvPlan
  if (!plan || plan.id !== tvPlanId) return null
  if (plan.companyId !== input.actorCompanyId) return null
  if (plan.category !== "tv") return null
  return {
    commercialCatalogId: input.commercial.id,
    commercialName: input.commercial.name,
    commercialMonthlyPrice: input.commercial.monthlyPrice,
    tvPlanCatalogId: plan.id,
    tvPlanCode: plan.code,
    tvPlanName: plan.name,
    tvMonthlyPrice: plan.monthlyPrice,
  }
}

export function formatCatalogMoney(
  value: number | null | undefined,
  currency = "ARS"
): string {
  if (value == null) return "—"
  const amount = `$ ${value.toLocaleString("es-AR", {
    maximumFractionDigits: 0,
  })}`
  return currency && currency !== "ARS" ? `${amount} ${currency}` : amount
}

export function assertTvPlanForCatalog(input: {
  companyId: string
  catalogId?: string | null
  selectedTvPlanId: string | null | undefined
  tvPlan:
    | (Pick<IspCatalogTvPlan, "id" | "companyId" | "isActive"> & {
        category: string
      })
    | null
    | undefined
  currentlyLinkedTvPlanId?: string | null
}): { ok: boolean; message?: string } {
  const selected = input.selectedTvPlanId?.trim() ?? ""
  if (!selected) return { ok: true }

  if (input.catalogId && selected === input.catalogId) {
    return { ok: false, message: ISP_CATALOG_TV_PLAN_SELF_MESSAGE }
  }

  if (!input.tvPlan || input.tvPlan.id !== selected) {
    return { ok: false, message: ISP_CATALOG_TV_PLAN_NOT_FOUND_MESSAGE }
  }
  if (input.tvPlan.companyId !== input.companyId) {
    return { ok: false, message: ISP_CATALOG_TV_PLAN_CROSS_COMPANY_MESSAGE }
  }
  if (input.tvPlan.category !== "tv") {
    return { ok: false, message: ISP_CATALOG_TV_PLAN_CATEGORY_MESSAGE }
  }
  if (
    !input.tvPlan.isActive &&
    input.currentlyLinkedTvPlanId !== input.tvPlan.id
  ) {
    return { ok: false, message: ISP_CATALOG_TV_PLAN_INACTIVE_MESSAGE }
  }
  return { ok: true }
}

export function suggestConnectionTypeFromCatalogAndOt(input: {
  technology: IspTechnology | ""
  installationIp?: string | null
  allowedConnectionTypes?: readonly string[]
}): IspConnectionType | "" {
  const allowed = connectionTypesForOnboarding(input.allowedConnectionTypes)
  const installationIp = input.installationIp?.trim() ?? ""
  const wirelessWithIp = input.technology === "wireless" && Boolean(installationIp)

  if (wirelessWithIp) {
    if (allowed.length === 0 || allowed.includes("static_ip")) {
      return "static_ip"
    }
    return ""
  }

  if (allowed.length === 1 && allowed[0] !== "pppoe") {
    return allowed[0]
  }

  return ""
}

export function filterConnectionTypesForCatalog(
  allowedConnectionTypes: readonly string[] | undefined,
  allTypes: readonly IspConnectionType[]
): IspConnectionType[] {
  if (!allowedConnectionTypes?.length) return [...allTypes]
  return allTypes.filter((type) => allowedConnectionTypes.includes(type))
}

export function matchesCatalogFilters(
  item: IspCatalogItem,
  filters: IspCatalogListFilters
): boolean {
  const search = filters.search?.trim().toLowerCase() ?? ""
  if (
    search &&
    !item.name.toLowerCase().includes(search) &&
    !(item.code ?? "").toLowerCase().includes(search) &&
    !(item.description ?? "").toLowerCase().includes(search) &&
    !(item.otLabel ?? "").toLowerCase().includes(search) &&
    !(item.technicalProfile?.code ?? "").toLowerCase().includes(search)
  ) {
    return false
  }

  if (
    filters.category &&
    filters.category !== "all" &&
    item.category !== filters.category
  ) {
    return false
  }

  if (
    filters.customerType &&
    filters.customerType !== "all" &&
    item.customerType !== filters.customerType
  ) {
    return false
  }

  if (filters.technology && filters.technology !== "all") {
    const technology = resolveCatalogCharacteristics(item).technology
    if (filters.technology === "none") {
      if (technology) return false
    } else if (technology !== filters.technology) {
      return false
    }
  }

  if (filters.status === "active" && !item.isActive) return false
  if (filters.status === "inactive" && item.isActive) return false

  return true
}

export function validateTechnicalProfileDraft(
  draft: IspTechnicalProfileDraft
): { valid: boolean; message?: string } {
  if (!draft.code.trim()) {
    return { valid: false, message: ISP_TECHNICAL_PROFILE_CODE_REQUIRED_MESSAGE }
  }
  if (!draft.name.trim()) {
    return { valid: false, message: ISP_TECHNICAL_PROFILE_NAME_REQUIRED_MESSAGE }
  }
  if (draft.technology && !isIspCatalogTechnology(draft.technology)) {
    return { valid: false, message: "Tecnología inválida." }
  }
  if (
    draft.connectionType &&
    !isIspCatalogConnectionType(draft.connectionType)
  ) {
    return { valid: false, message: "Tipo de conexión inválido." }
  }
  const download = parseOptionalNonNegativeNumber(draft.downloadSpeed)
  const upload = parseOptionalNonNegativeNumber(draft.uploadSpeed)
  if (draft.downloadSpeed.trim() && download == null) {
    return { valid: false, message: "Velocidad de bajada inválida." }
  }
  if (draft.uploadSpeed.trim() && upload == null) {
    return { valid: false, message: "Velocidad de subida inválida." }
  }
  return { valid: true }
}

export function validateCatalogDraft(
  draft: IspCatalogDraft
): { valid: boolean; message?: string } {
  if (!draft.code.trim()) {
    return { valid: false, message: ISP_CATALOG_CODE_REQUIRED_MESSAGE }
  }
  if (!draft.name.trim()) {
    return { valid: false, message: ISP_CATALOG_NAME_REQUIRED_MESSAGE }
  }
  if (!draft.category.trim()) {
    return { valid: false, message: ISP_CATALOG_CATEGORY_REQUIRED_MESSAGE }
  }
  if (!isIspCatalogCustomerType(draft.customerType)) {
    return { valid: false, message: ISP_CATALOG_CUSTOMER_TYPE_REQUIRED_MESSAGE }
  }
  if (draft.technology && !isIspCatalogTechnology(draft.technology)) {
    return { valid: false, message: "Tecnología inválida." }
  }
  if (
    !(ISP_CATALOG_BILLING_PERIODS as readonly string[]).includes(
      draft.billingPeriod
    )
  ) {
    return { valid: false, message: "Periodicidad inválida." }
  }
  if (
    !(ISP_CATALOG_BILLING_METHODS as readonly string[]).includes(
      draft.billingMethod
    )
  ) {
    return { valid: false, message: "Medio de cobranza inválido." }
  }

  const download = parseOptionalNonNegativeNumber(draft.downloadSpeedMbps)
  const upload = parseOptionalNonNegativeNumber(draft.uploadSpeedMbps)
  const price = parseOptionalNonNegativeNumber(draft.monthlyPrice)
  if (draft.downloadSpeedMbps.trim() && download == null) {
    return { valid: false, message: "Velocidad de bajada inválida." }
  }
  if (draft.uploadSpeedMbps.trim() && upload == null) {
    return { valid: false, message: "Velocidad de subida inválida." }
  }
  if (draft.monthlyPrice.trim() && price == null) {
    return { valid: false, message: "Precio mensual inválido." }
  }

  if (draft.requiresConnection) {
    const invalid = draft.allowedConnectionTypes.filter(
      (type) => !isIspCatalogConnectionType(type)
    )
    if (invalid.length > 0) {
      return { valid: false, message: "Tipo de conexión inválido." }
    }
  }

  if (draft.createTechnicalProfile) {
    return validateTechnicalProfileDraft(draft.technicalProfile)
  }

  if (canCatalogItemIncludeTv(draft.category) && draft.includesTv) {
    if (!draft.tvPlanCatalogId.trim()) {
      return { valid: false, message: ISP_CATALOG_TV_PLAN_REQUIRED_MESSAGE }
    }
  }

  return { valid: true }
}

export function objectHasSubscriberNetworkFields(value: object): boolean {
  return ISP_CATALOG_SUBSCRIBER_NETWORK_FIELDS.some((field) => field in value)
}

export function mapCatalogWriteError(error: {
  code?: string
  message?: string
}): string {
  const message = error.message ?? ""
  if (error.code === "23503") {
    return ISP_CATALOG_USED_CANNOT_DELETE_MESSAGE
  }
  if (error.code === "23505") {
    if (message.includes("isp_service_catalog_company_code")) {
      return ISP_CATALOG_CODE_UNIQUE_MESSAGE
    }
    if (message.includes("isp_technical_profiles_company_code")) {
      return ISP_TECHNICAL_PROFILE_CODE_UNIQUE_MESSAGE
    }
    if (message.includes("isp_service_catalog_company_name")) {
      return ISP_CATALOG_NAME_UNIQUE_MESSAGE
    }
    if (message.toLowerCase().includes("code")) {
      return ISP_CATALOG_CODE_UNIQUE_MESSAGE
    }
  }
  if (message.includes("perfil técnico de otra empresa")) {
    return ISP_CATALOG_PROFILE_CROSS_COMPANY_MESSAGE
  }
  if (message.includes("perfil técnico existente")) {
    return ISP_CATALOG_PROFILE_NOT_FOUND_MESSAGE
  }
  if (message.includes("plan TV de otra empresa")) {
    return ISP_CATALOG_TV_PLAN_CROSS_COMPANY_MESSAGE
  }
  if (message.includes("plan de categoría TV")) {
    return ISP_CATALOG_TV_PLAN_CATEGORY_MESSAGE
  }
  if (message.includes("plan TV existente")) {
    return ISP_CATALOG_TV_PLAN_NOT_FOUND_MESSAGE
  }
  if (message.includes("referenciar el mismo servicio")) {
    return ISP_CATALOG_TV_PLAN_SELF_MESSAGE
  }
  return message || "No se pudo guardar el servicio."
}

export function emptyTechnicalProfileDraft(): IspTechnicalProfileDraft {
  return {
    code: "",
    name: "",
    description: "",
    technology: "",
    connectionType: "",
    downloadSpeed: "",
    uploadSpeed: "",
    speedUnit: "mbps",
    coreName: "MikroTik",
    coreProfileId: "",
    isActive: true,
  }
}

export function technicalProfileToDraft(
  profile: IspTechnicalProfile
): IspTechnicalProfileDraft {
  return {
    code: profile.code,
    name: profile.name,
    description: profile.description ?? "",
    technology: profile.technology ?? "",
    connectionType: profile.connectionType ?? "",
    downloadSpeed:
      profile.downloadSpeed != null ? String(profile.downloadSpeed) : "",
    uploadSpeed: profile.uploadSpeed != null ? String(profile.uploadSpeed) : "",
    speedUnit: profile.speedUnit || "mbps",
    coreName: profile.coreName ?? "MikroTik",
    coreProfileId: profile.coreProfileId ?? "",
    isActive: profile.isActive,
  }
}

export function emptyCatalogDraft(): IspCatalogDraft {
  return {
    code: "",
    name: "",
    category: "internet",
    customerType: "residential",
    description: "",
    isActive: true,
    technology: "",
    downloadSpeedMbps: "",
    uploadSpeedMbps: "",
    speedUnit: "mbps",
    monthlyPrice: "",
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: [],
    technicalProfileId: "",
    createTechnicalProfile: false,
    technicalProfile: emptyTechnicalProfileDraft(),
    otLabel: "",
    includesTv: false,
    tvPlanCatalogId: "",
  }
}

export function catalogItemToDraft(item: IspCatalogItem): IspCatalogDraft {
  return {
    code: item.code ?? "",
    name: item.name,
    category: item.category,
    customerType: item.customerType,
    description: item.description ?? "",
    isActive: item.isActive,
    technology: item.technology ?? "",
    downloadSpeedMbps:
      item.downloadSpeedMbps != null ? String(item.downloadSpeedMbps) : "",
    uploadSpeedMbps:
      item.uploadSpeedMbps != null ? String(item.uploadSpeedMbps) : "",
    speedUnit: item.speedUnit || "mbps",
    monthlyPrice: item.monthlyPrice != null ? String(item.monthlyPrice) : "",
    currency: item.currency || "ARS",
    priceIsConfigurable: item.priceIsConfigurable,
    billingPeriod: item.billingPeriod,
    billingMethod: item.billingMethod,
    requiresConnection: item.requiresConnection,
    allowedConnectionTypes: item.allowedConnectionTypes,
    technicalProfileId: item.technicalProfileId ?? "",
    createTechnicalProfile: false,
    technicalProfile: item.technicalProfile
      ? technicalProfileToDraft(item.technicalProfile)
      : emptyTechnicalProfileDraft(),
    otLabel: item.otLabel ?? "",
    includesTv: Boolean(item.tvPlanCatalogId),
    tvPlanCatalogId: item.tvPlanCatalogId ?? "",
  }
}

export function applyTechnicalProfileToCatalogDraft(
  draft: IspCatalogDraft,
  profile: IspTechnicalProfile
): IspCatalogDraft {
  const nextTypes = [...draft.allowedConnectionTypes]
  if (
    profile.connectionType &&
    !nextTypes.includes(profile.connectionType)
  ) {
    nextTypes.push(profile.connectionType)
  }
  return {
    ...draft,
    technicalProfileId: profile.id,
    createTechnicalProfile: false,
    technicalProfile: technicalProfileToDraft(profile),
    technology: profile.technology ?? draft.technology,
    downloadSpeedMbps:
      profile.downloadSpeed != null
        ? String(profile.downloadSpeed)
        : draft.downloadSpeedMbps,
    uploadSpeedMbps:
      profile.uploadSpeed != null
        ? String(profile.uploadSpeed)
        : draft.uploadSpeedMbps,
    speedUnit: profile.speedUnit || draft.speedUnit,
    allowedConnectionTypes: nextTypes,
  }
}
