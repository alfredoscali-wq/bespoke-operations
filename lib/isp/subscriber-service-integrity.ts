import {
  connectionTypesForOnboarding,
  filterConnectionTypesForCatalog,
  formatCatalogSpeed,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem, IspTechnicalProfile } from "@/lib/isp/catalog-types"
import {
  ISP_CONNECTION_TYPES,
  type IspCommercialStatus,
  type IspConnectionType,
  type IspTechnicalStatus,
} from "@/lib/isp/constants"
import {
  ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE,
  canCreateIspGraph,
  validateConnectionFields,
} from "@/lib/isp/integrity"
import type { IspConnection, IspConnectionDraft } from "@/lib/isp/types"

export const ISP_DEFAULT_COMMERCIAL_STATUS: IspCommercialStatus =
  "pending_activation"
export const ISP_DEFAULT_TECHNICAL_STATUS: IspTechnicalStatus =
  "pending_provision"
export const ISP_KEEP_PPPOE_PASSWORD_PLACEHOLDER =
  "Dejar vacío para conservar la contraseña actual"
export const ISP_ACTIVITY_SUMMARY_LIMIT = 8
export const ISP_SUBSEQUENT_COMMERCIAL_STATUSES = [
  "suspended",
  "cancelled",
] as const
export const ISP_CATALOG_MUST_BE_ACTIVE_MESSAGE =
  "El servicio del catálogo no está activo."
export const ISP_CONTRACTED_PRICE_NEGATIVE_MESSAGE =
  "El precio contratado no puede ser negativo."
export const ISP_CONNECTION_TYPE_NOT_ALLOWED_MESSAGE =
  "El tipo de conexión no está permitido para este servicio."
export const ISP_PROFILE_INCOMPATIBLE_MESSAGE =
  "El perfil técnico no es válido para este tipo de conexión."
export const ISP_ALREADY_HAS_CONNECTION_MESSAGE =
  "Este servicio ya tiene una conexión técnica."
export const ISP_CROSS_COMPANY_MESSAGE =
  "No se pueden asociar servicios o conexiones de otra empresa."
export const ISP_SAVE_SERVICE_LABEL = "Guardar servicio"
export const ISP_SAVE_SERVICE_AND_CONNECTION_LABEL =
  "Guardar servicio y conexión"
export const ISP_CREATE_CONNECTION_LABEL = "Crear conexión"
export const ISP_CREATE_CONNECTION_CHECKBOX_LABEL =
  "Crear también una conexión técnica"

export type IspSubscriberServiceCreateInput = {
  customerId?: string | null
  customerCompanyId?: string | null
  actorCompanyId?: string | null
  subscriberExists?: boolean
  catalog?: Pick<
    IspCatalogItem,
    | "id"
    | "companyId"
    | "isActive"
    | "allowedConnectionTypes"
    | "requiresConnection"
    | "monthlyPrice"
  > | null
  catalogId?: string | null
  monthlyFee?: number | string | null
  activationDate?: string | null
  includeConnection?: boolean
  connection?: {
    connectionType?: string | null
    pppoeUsername?: string | null
    pppoePassword?: string | null
    ipAddress?: string | null
    technicalProfileId?: string | null
  }
  profile?: Pick<
    IspTechnicalProfile,
    "id" | "companyId" | "isActive" | "connectionType"
  > | null
}

export type IspConnectionOnServiceInput = {
  serviceId?: string | null
  serviceCustomerId?: string | null
  customerId?: string | null
  serviceCompanyId?: string | null
  connectionCompanyId?: string | null
  hasExistingConnection?: boolean
}

export function localIsoDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export function isoDateOnly(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  return trimmed.slice(0, 10)
}

export function commercialStatusFromActivationDate(
  activationDate?: string | null,
  today?: string
): IspCommercialStatus {
  const todayIso = today ?? localIsoDate()
  const date = isoDateOnly(activationDate) ?? todayIso
  return date <= todayIso ? "active" : "pending_activation"
}

export function defaultCommercialStatusOnCreate(
  activationDate?: string | null,
  today?: string
): IspCommercialStatus {
  return commercialStatusFromActivationDate(activationDate, today)
}

export function resolveEffectiveCommercialStatus(input: {
  storedStatus?: string | null
  activationDate?: string | null
  today?: string
}): IspCommercialStatus {
  if (
    input.storedStatus === "suspended" ||
    input.storedStatus === "cancelled"
  ) {
    return input.storedStatus
  }
  return commercialStatusFromActivationDate(input.activationDate, input.today)
}

export function canOperatorChooseCommercialStatusOnCreate(): boolean {
  return false
}

export function resolveCommercialStatusOnServiceUpdate(input: {
  requested?: string | null
  existingStatus?: string | null
  activationDate?: string | null
}): IspCommercialStatus | undefined {
  if (input.requested === "suspended" || input.requested === "cancelled") {
    return input.requested
  }
  if (
    input.requested === "active" ||
    input.requested === "pending_activation"
  ) {
    return commercialStatusFromActivationDate(input.activationDate)
  }
  if (
    input.existingStatus === "suspended" ||
    input.existingStatus === "cancelled"
  ) {
    return undefined
  }
  if (input.activationDate != null && input.activationDate !== "") {
    return commercialStatusFromActivationDate(input.activationDate)
  }
  return undefined
}

export function keepExistingText(
  incoming: string | number | null | undefined,
  existing: string | number | null | undefined
): string {
  const trimmed = String(incoming ?? "").trim()
  if (!trimmed) return String(existing ?? "").trim()
  return trimmed
}

export function shouldUpdatePppoePassword(incoming: string | null | undefined): boolean {
  return Boolean(incoming?.trim())
}

export function mergeConnectionEdit(
  incoming: Partial<IspConnectionDraft> | undefined,
  existing: Pick<
    IspConnection,
    | "connectionType"
    | "pppoeUsername"
    | "technicalProfile"
    | "technicalProfileId"
    | "ipAddress"
    | "prefixLength"
    | "gateway"
    | "vlan"
    | "coreName"
    | "coreProfileId"
    | "technicalStatus"
  >
): IspConnectionDraft {
  const connectionType = (keepExistingText(
    incoming?.connectionType,
    existing.connectionType
  ) || existing.connectionType) as IspConnectionDraft["connectionType"]
  return {
    connectionType,
    pppoeUsername: keepExistingText(
      incoming?.pppoeUsername,
      existing.pppoeUsername
    ),
    pppoePassword: incoming?.pppoePassword ?? "",
    technicalProfile: keepExistingText(
      incoming?.technicalProfile,
      existing.technicalProfile
    ),
    technicalProfileId: keepExistingText(
      incoming?.technicalProfileId,
      existing.technicalProfileId
    ),
    ipAddress: keepExistingText(incoming?.ipAddress, existing.ipAddress),
    prefixLength: keepExistingText(
      incoming?.prefixLength,
      existing.prefixLength != null ? String(existing.prefixLength) : ""
    ),
    gateway: keepExistingText(incoming?.gateway, existing.gateway),
    vlan: keepExistingText(incoming?.vlan, existing.vlan),
    coreName:
      keepExistingText(incoming?.coreName, existing.coreName) || "MikroTik",
    coreProfileId: keepExistingText(
      incoming?.coreProfileId,
      existing.coreProfileId
    ),
    technicalStatus: (keepExistingText(
      incoming?.technicalStatus,
      existing.technicalStatus
    ) || existing.technicalStatus) as IspConnectionDraft["technicalStatus"],
  }
}

export function validateConnectionUpdate(input: {
  type: string
  pppoeUsername?: string | null
  pppoePassword?: string | null
  existingPppoeUsername?: string | null
  existingPasswordSet?: boolean
  ipAddress?: string | null
  existingIpAddress?: string | null
}): { valid: boolean; message?: string } {
  return validateConnectionFields({
    type: input.type as IspConnectionType,
    pppoeUsername: keepExistingText(
      input.pppoeUsername,
      input.existingPppoeUsername
    ),
    pppoePassword: input.pppoePassword?.trim()
      ? input.pppoePassword
      : input.existingPasswordSet
        ? "kept"
        : input.pppoePassword,
    ipAddress: keepExistingText(input.ipAddress, input.existingIpAddress),
  })
}

export function defaultTechnicalStatusOnCreate(): IspTechnicalStatus {
  return ISP_DEFAULT_TECHNICAL_STATUS
}

export function parseContractedPrice(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  const trimmed = String(value ?? "").trim().replace(",", ".")
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function isValidActivationDate(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return true
  return !Number.isNaN(new Date(trimmed).getTime())
}

export function isConnectionTypeAllowedForCatalog(
  allowedConnectionTypes: readonly string[] | undefined,
  type: string | null | undefined
): boolean {
  if (!type) return false
  const allowed = filterConnectionTypesForCatalog(
    allowedConnectionTypes,
    ISP_CONNECTION_TYPES
  )
  return allowed.includes(type as IspConnectionType)
}

export function contractedPriceDiffersFromList(input: {
  listPrice?: number | null
  contractedPrice?: number | null
}): boolean {
  if (input.listPrice == null || input.contractedPrice == null) return false
  return input.listPrice !== input.contractedPrice
}

export function didModifyCatalogPriceWhenEditingSubscriber(): boolean {
  return false
}

export function planChangeKeepsPreviousService(input: {
  previousServiceId: string
  previousDeleted?: boolean
  previousStatus?: string | null
  newServiceId?: string | null
  replacedServiceId?: string | null
}): boolean {
  if (input.previousDeleted) return false
  if (input.previousServiceId === input.newServiceId) return false
  return (
    input.replacedServiceId === input.previousServiceId &&
    input.previousStatus === "cancelled"
  )
}

export function submitLabelForIncludeConnection(
  includeConnection: boolean
): string {
  return includeConnection
    ? ISP_SAVE_SERVICE_AND_CONNECTION_LABEL
    : ISP_SAVE_SERVICE_LABEL
}

export function compatibleTechnicalProfiles<
  T extends Pick<IspTechnicalProfile, "id" | "isActive" | "connectionType">,
>(
  profiles: T[],
  connectionType: string | null | undefined
): T[] {
  return profiles.filter((profile) => {
    if (!profile.isActive) return false
    if (!profile.connectionType) return true
    if (!connectionType) return true
    return profile.connectionType === connectionType
  })
}

export function isTechnicalProfileCompatible(input: {
  profile?: Pick<
    IspTechnicalProfile,
    "companyId" | "isActive" | "connectionType"
  > | null
  companyId: string
  connectionType?: string | null
  currentlyLinkedProfileId?: string | null
  selectedProfileId?: string | null
}): boolean {
  if (!input.selectedProfileId) return true
  if (!input.profile) return false
  if (input.profile.companyId !== input.companyId) return false
  if (
    !input.profile.isActive &&
    input.currentlyLinkedProfileId !== input.selectedProfileId
  ) {
    return false
  }
  if (
    input.profile.connectionType &&
    input.connectionType &&
    input.profile.connectionType !== input.connectionType
  ) {
    return false
  }
  return true
}

export function prefillConnectionFromCatalog(
  item: Pick<
    IspCatalogItem,
    "allowedConnectionTypes" | "technicalProfileId" | "technicalProfile"
  >
): Partial<IspConnectionDraft> & { technicalProfileId: string; coreProfileId: string } {
  const allowed = connectionTypesForOnboarding(item.allowedConnectionTypes)
  const profile = item.technicalProfile
  const suggestedType =
    profile?.connectionType &&
    allowed.includes(profile.connectionType as IspConnectionType)
      ? (profile.connectionType as IspConnectionType)
      : allowed[0] ?? ""

  return {
    connectionType: suggestedType,
    technicalProfileId: item.technicalProfileId ?? "",
    technicalProfile: profile?.code ?? profile?.coreProfileId ?? "",
    coreName: profile?.coreName ?? "MikroTik",
    coreProfileId: profile?.coreProfileId ?? "",
    technicalStatus: ISP_DEFAULT_TECHNICAL_STATUS,
  }
}

export function formatContractedSpeedLabel(service: {
  downloadSpeed?: number | null
  uploadSpeed?: number | null
  speedUnit?: string | null
  contractedSpeed?: string | null
}): string {
  if (service.downloadSpeed != null || service.uploadSpeed != null) {
    return formatCatalogSpeed(
      service.downloadSpeed,
      service.uploadSpeed,
      service.speedUnit
    )
  }
  return service.contractedSpeed?.trim() || ""
}

export function inheritedSpeedsFromCatalog(
  item: Pick<
    IspCatalogItem,
    "downloadSpeedMbps" | "uploadSpeedMbps" | "speedUnit"
  >
): { download: string; upload: string; pair: string } {
  return {
    download:
      item.downloadSpeedMbps == null ? "—" : `${item.downloadSpeedMbps} Mbps`,
    upload: item.uploadSpeedMbps == null ? "—" : `${item.uploadSpeedMbps} Mbps`,
    pair: formatCatalogSpeed(
      item.downloadSpeedMbps,
      item.uploadSpeedMbps,
      item.speedUnit
    ),
  }
}

export function stripConnectionSecrets<T extends Partial<IspConnection>>(
  connection: T
): T {
  return {
    ...connection,
    pppoePassword: null,
    pppoePasswordSet: Boolean(
      connection.pppoePasswordSet ?? connection.pppoePassword
    ),
  }
}

export function connectionJsonOmitsPassword(value: unknown): boolean {
  if (!value || typeof value !== "object") return true
  return !("pppoePassword" in value) || (value as { pppoePassword?: unknown }).pppoePassword == null
}

export function canCreateConnectionForContractedService(
  input: IspConnectionOnServiceInput
): { allowed: boolean; message?: string } {
  if (!input.serviceId?.trim()) {
    return { allowed: false, message: ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE }
  }
  if (
    input.customerId &&
    input.serviceCustomerId &&
    input.customerId !== input.serviceCustomerId
  ) {
    return { allowed: false, message: ISP_CROSS_COMPANY_MESSAGE }
  }
  if (
    input.serviceCompanyId &&
    input.connectionCompanyId &&
    input.serviceCompanyId !== input.connectionCompanyId
  ) {
    return { allowed: false, message: ISP_CROSS_COMPANY_MESSAGE }
  }
  if (input.hasExistingConnection) {
    return { allowed: false, message: ISP_ALREADY_HAS_CONNECTION_MESSAGE }
  }
  return { allowed: true }
}

export function canCreateOrphanConnection(): { allowed: boolean; message: string } {
  return {
    allowed: false,
    message: ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE,
  }
}

export function validateSubscriberServiceCreate(
  input: IspSubscriberServiceCreateInput
): { valid: boolean; message?: string } {
  if (!input.customerId?.trim()) {
    return { valid: false, message: "Indique el abonado." }
  }
  if (input.subscriberExists === false) {
    return { valid: false, message: "Abonado no encontrado." }
  }
  if (
    input.customerCompanyId &&
    input.actorCompanyId &&
    input.customerCompanyId !== input.actorCompanyId
  ) {
    return { valid: false, message: ISP_CROSS_COMPANY_MESSAGE }
  }
  if (!input.catalogId?.trim() && !input.catalog?.id) {
    return { valid: false, message: "Indique el servicio del catálogo." }
  }
  if (!input.catalog) {
    return { valid: false, message: "El servicio del catálogo no pertenece a esta empresa." }
  }
  if (
    input.actorCompanyId &&
    input.catalog.companyId !== input.actorCompanyId
  ) {
    return { valid: false, message: ISP_CROSS_COMPANY_MESSAGE }
  }
  if (!input.catalog.isActive) {
    return { valid: false, message: ISP_CATALOG_MUST_BE_ACTIVE_MESSAGE }
  }

  const fee = parseContractedPrice(input.monthlyFee)
  if (fee != null && fee < 0) {
    return { valid: false, message: ISP_CONTRACTED_PRICE_NEGATIVE_MESSAGE }
  }
  if (!isValidActivationDate(input.activationDate)) {
    return { valid: false, message: "Fecha inválida." }
  }

  if (!input.includeConnection) {
    return { valid: true }
  }

  const type = input.connection?.connectionType ?? ""
  if (!isConnectionTypeAllowedForCatalog(input.catalog.allowedConnectionTypes, type)) {
    return { valid: false, message: ISP_CONNECTION_TYPE_NOT_ALLOWED_MESSAGE }
  }

  const fields = validateConnectionFields({
    type: type as IspConnectionType,
    pppoeUsername: input.connection?.pppoeUsername,
    pppoePassword: input.connection?.pppoePassword,
    ipAddress: input.connection?.ipAddress,
  })
  if (!fields.valid) return fields

  if (input.connection?.technicalProfileId && input.profile !== undefined) {
    if (
      !isTechnicalProfileCompatible({
        profile: input.profile,
        companyId: input.actorCompanyId ?? input.catalog.companyId,
        connectionType: type,
        selectedProfileId: input.connection.technicalProfileId,
      })
    ) {
      return { valid: false, message: ISP_PROFILE_INCOMPATIBLE_MESSAGE }
    }
  }

  return { valid: true }
}

export function isTransactionalServiceAndConnectionCreate(input: {
  includeConnection: boolean
  serviceCreated: boolean
  connectionCreated: boolean
  connectionFailed?: boolean
}): boolean {
  if (!input.includeConnection) {
    return input.serviceCreated && !input.connectionCreated
  }
  if (input.connectionFailed) {
    return !input.serviceCreated && !input.connectionCreated
  }
  return input.serviceCreated && input.connectionCreated
}

export function graphAllowsMultipleServicesPerSubscriber(): boolean {
  return canCreateIspGraph({
    customerId: "c1",
    createService: true,
    createConnection: false,
  }).allowed
}

export function emptyConnectionDraft(): IspConnectionDraft {
  return {
    connectionType: "",
    pppoeUsername: "",
    pppoePassword: "",
    technicalProfile: "",
    technicalProfileId: "",
    ipAddress: "",
    prefixLength: "",
    gateway: "",
    vlan: "",
    coreName: "MikroTik",
    coreProfileId: "",
    technicalStatus: ISP_DEFAULT_TECHNICAL_STATUS,
  }
}

export function sortSubscriberServices<
  T extends {
    commercialStatus: string
    activationDate: string | null
    createdAt: string
  },
>(services: T[]): T[] {
  return [...services].sort((left, right) => {
    const leftHistory = left.commercialStatus === "cancelled" ? 1 : 0
    const rightHistory = right.commercialStatus === "cancelled" ? 1 : 0
    if (leftHistory !== rightHistory) return leftHistory - rightHistory
    const leftDate = left.activationDate ?? left.createdAt
    const rightDate = right.activationDate ?? right.createdAt
    return rightDate.localeCompare(leftDate)
  })
}
