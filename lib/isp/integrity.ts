import { normalizeDni } from "@/lib/customers/normalization/dni"
import {
  ISP_CONNECTION_TYPES,
  type IspCommercialStatus,
  type IspConnectionType,
  type IspMonthlyCollectionMethod,
  type IspTechnicalStatus,
  type IspTechnology,
} from "@/lib/isp/constants"

export const ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE =
  "Una conexión no puede existir sin un servicio."
export const ISP_SERVICE_REQUIRES_CUSTOMER_MESSAGE =
  "Un servicio no puede existir sin un cliente."
export const ISP_CONNECTION_REQUIRES_CUSTOMER_MESSAGE =
  "Una conexión no puede existir sin un cliente."
export const ISP_ORPHAN_PREVENTED_MESSAGE =
  "No se pueden dejar servicios ni conexiones huérfanos."

export type IspCreateGraphInput = {
  customerId?: string | null
  createCustomer?: boolean
  createService?: boolean
  createConnection?: boolean
}

export function canCreateIspGraph(input: IspCreateGraphInput): {
  allowed: boolean
  message?: string
} {
  const hasCustomer =
    Boolean(input.customerId?.trim()) || input.createCustomer === true

  if (input.createConnection && !input.createService && !hasCustomer) {
    return { allowed: false, message: ISP_CONNECTION_REQUIRES_CUSTOMER_MESSAGE }
  }

  if (input.createConnection && !input.createService) {
    return { allowed: false, message: ISP_CONNECTION_REQUIRES_SERVICE_MESSAGE }
  }

  if (input.createService && !hasCustomer) {
    return { allowed: false, message: ISP_SERVICE_REQUIRES_CUSTOMER_MESSAGE }
  }

  return { allowed: true }
}

export function resolveMonthlyCollectionMethod(input?: {
  requested?: string | null
  otPaymentMethod?: string | null
}): IspMonthlyCollectionMethod {
  void input?.otPaymentMethod
  if (input?.requested === "siro") return "siro"
  return "pending"
}

export function didCopyOtPaymentMethodToMonthlyCollection(input: {
  monthlyCollectionMethod: string
  otPaymentMethod?: string | null
}): boolean {
  const ot = input.otPaymentMethod?.trim().toLowerCase()
  if (!ot) return false
  return input.monthlyCollectionMethod.trim().toLowerCase() === ot
}

function parseComparableAmount(
  value: string | number | null | undefined
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  const trimmed = String(value ?? "")
    .trim()
    .replace(",", ".")
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function didCopyOtChargeToMonthlyFee(input: {
  monthlyFee?: string | number | null
  otInstallationAmount?: number | null
  otAmountToCollect?: number | null
}): boolean {
  const fee = parseComparableAmount(input.monthlyFee)
  if (fee == null || fee <= 0) return false
  return (
    (input.otInstallationAmount != null && fee === input.otInstallationAmount) ||
    (input.otAmountToCollect != null && fee === input.otAmountToCollect)
  )
}

export function didInferPppoeUsernameFromDni(input: {
  pppoeUsername?: string | null
  dni?: string | null
}): boolean {
  const usernameDigits = (input.pppoeUsername ?? "").replace(/\D/g, "")
  const dniDigits = (input.dni ?? "").replace(/\D/g, "")
  if (!usernameDigits || dniDigits.length < 7) return false
  return usernameDigits === dniDigits
}

export function suggestConnectionTypeFromWorkOrder(input: {
  technology: IspTechnology | ""
  installationIp?: string | null
}): IspConnectionType | "" {
  const installationIp = input.installationIp?.trim() ?? ""
  if (input.technology === "wireless" && installationIp) {
    return "static_ip"
  }
  return ""
}

export type IspPairStatus = {
  commercialStatus: IspCommercialStatus
  technicalStatus: IspTechnicalStatus
}

export function formatCommercialTechnicalPair(pair: IspPairStatus): {
  commercialLabel: string
  technicalLabel: string
  combinedLabel: string
  isFullyActive: boolean
} {
  const commercialLabel =
    pair.commercialStatus === "active" ? "Activo" : pair.commercialStatus
  const technicalLabel =
    pair.technicalStatus === "pending_provision"
      ? "Provisionamiento pendiente"
      : pair.technicalStatus
  const isFullyActive =
    pair.commercialStatus === "active" &&
    pair.technicalStatus === "provisioned"

  return {
    commercialLabel,
    technicalLabel,
    combinedLabel: isFullyActive
      ? "Activo"
      : `Servicio: ${commercialLabel} · Conexión: ${technicalLabel}`,
    isFullyActive,
  }
}

export function connectionFieldsForType(type: IspConnectionType | ""): {
  showPppoe: boolean
  showStaticIp: boolean
  showDhcp: boolean
} {
  return {
    showPppoe: type === "pppoe",
    showStaticIp: type === "static_ip",
    showDhcp: type === "dhcp",
  }
}

export function validateConnectionFields(input: {
  type: IspConnectionType
  pppoeUsername?: string | null
  pppoePassword?: string | null
  ipAddress?: string | null
}): { valid: boolean; message?: string } {
  if (!(ISP_CONNECTION_TYPES as readonly string[]).includes(input.type)) {
    return { valid: false, message: "Tipo de conexión inválido." }
  }

  if (input.type === "pppoe" && !input.pppoeUsername?.trim()) {
    return { valid: false, message: "Indique el usuario PPPoE." }
  }

  if (input.type === "pppoe" && !input.pppoePassword?.trim()) {
    return { valid: false, message: "Indique la contraseña PPPoE." }
  }

  if (input.type === "static_ip" && !input.ipAddress?.trim()) {
    return { valid: false, message: "Indique la dirección IP." }
  }

  return { valid: true }
}

export function matchCustomerByDni<T extends { dni?: string | null }>(
  customers: T[],
  dni: string | null | undefined
): T | null {
  const needle = normalizeDni(dni)
  if (!needle.isValid) return null

  return (
    customers.find((customer) => {
      const current = normalizeDni(customer.dni)
      return current.isValid && current.digits === needle.digits
    }) ?? null
  )
}

export type IspSubscriberListStatus =
  | "activo"
  | "suspendido"
  | "baja"
  | "pendiente"

export function deriveIspSubscriberListStatus(input: {
  customerStatus: string
  commercialStatuses: Array<string | null | undefined>
}): IspSubscriberListStatus {
  if (input.commercialStatuses.some((status) => status === "suspended")) {
    return "suspendido"
  }

  const status = input.customerStatus.trim().toLowerCase()
  if (status === "pendiente-activacion" || status === "pendiente de activación") {
    return "pendiente"
  }
  if (status === "inactivo") {
    return "baja"
  }
  return "activo"
}

export const ISP_SUBSCRIBER_LIST_STATUS_LABELS: Record<
  IspSubscriberListStatus,
  string
> = {
  activo: "Activo",
  suspendido: "Suspendido",
  baja: "Baja",
  pendiente: "Pendiente",
}

export function belongsToIspUniverse(input: {
  hasExplicitIspMembership: boolean
  serviceCount?: number
  connectionCount?: number
  hasWorkOrder?: boolean
}): boolean {
  return input.hasExplicitIspMembership === true
}

export function deriveCustomerServiceOverview(input: {
  serviceCount: number
  connectionCount: number
  hasPendingProvision: boolean
  hasActiveCommercial: boolean
}): string {
  if (input.serviceCount === 0) {
    return "Sin servicio"
  }

  if (input.hasActiveCommercial && input.hasPendingProvision) {
    return "Activo / Provisionamiento pendiente"
  }

  if (input.hasActiveCommercial) {
    return "Activo"
  }

  return "Con servicio"
}
