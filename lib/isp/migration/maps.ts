import {
  ISP_CATALOG_CATEGORIES,
  ISP_CATALOG_CUSTOMER_TYPES,
  type IspCatalogCategory,
  type IspCatalogCustomerType,
  type IspCatalogTechnology,
} from "@/lib/isp/catalog-constants"
import type {
  IspCommercialStatus,
  IspConnectionType,
  IspMonthlyCollectionMethod,
  IspTechnicalStatus,
} from "@/lib/isp/constants"

export function normalizeMigrationKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
}

export function isExampleMigrationId(value: string): boolean {
  const key = normalizeMigrationKey(value)
  return (
    key.startsWith("ejemplo") ||
    key.startsWith("example") ||
    key.startsWith("datos de ejemplo")
  )
}

const EXAMPLE_ROW_MARKERS = [
  "datos de ejemplo",
  "dato de ejemplo",
  "fila de ejemplo",
  "filas de ejemplo",
]

export function isExampleMigrationRow(values: Record<string, string>): boolean {
  const ids = [
    values.cliente_id_externo,
    values.catalogo_id_externo,
    values.servicio_id_externo,
    values.conexion_id_externo,
    values.equipamiento_id_externo,
  ]
  if (ids.some((id) => Boolean(id && isExampleMigrationId(id)))) {
    return true
  }

  return Object.values(values).some((value) => {
    const key = normalizeMigrationKey(value)
    if (!key) return false
    return EXAMPLE_ROW_MARKERS.some((marker) => key.includes(marker))
  })
}

function lookup<T extends string>(
  value: string,
  table: Record<string, T>
): T | null {
  const key = normalizeMigrationKey(value)
  if (!key) return null
  return table[key] ?? null
}

const CONNECTION_TYPE_MAP: Record<string, IspConnectionType> = {
  pppoe: "pppoe",
  ppp: "pppoe",
  "ip estatica": "static_ip",
  "ip fija": "static_ip",
  static: "static_ip",
  static_ip: "static_ip",
  "static ip": "static_ip",
  dhcp: "dhcp",
  otro: "other",
  other: "other",
}

const CUSTOMER_STATUS_MAP: Record<
  string,
  "activo" | "inactivo" | "pendiente-activacion"
> = {
  activo: "activo",
  active: "activo",
  suspendido: "inactivo",
  baja: "inactivo",
  inactivo: "inactivo",
  pendiente: "pendiente-activacion",
  "pendiente de alta": "pendiente-activacion",
  "pendiente-activacion": "pendiente-activacion",
  "pendiente activacion": "pendiente-activacion",
}

const COMMERCIAL_STATUS_MAP: Record<string, IspCommercialStatus> = {
  activo: "active",
  active: "active",
  suspendido: "suspended",
  suspended: "suspended",
  baja: "cancelled",
  cancelled: "cancelled",
  cancelado: "cancelled",
  pendiente: "pending_activation",
  "pendiente de alta": "pending_activation",
  pending_activation: "pending_activation",
}

const TECHNICAL_STATUS_MAP: Record<string, IspTechnicalStatus> = {
  "provisionamiento pendiente": "pending_provision",
  pending_provision: "pending_provision",
  pendiente: "pending_provision",
  provisionado: "provisioned",
  provisioned: "provisioned",
  error: "provision_error",
  "error de provisioning": "provision_error",
  provision_error: "provision_error",
  desconectado: "disconnected",
  disconnected: "disconnected",
}

const CUSTOMER_TYPE_MAP: Record<string, IspCatalogCustomerType> = {
  particular: "residential",
  residencial: "residential",
  residential: "residential",
  empresa: "business",
  business: "business",
  ambos: "both",
  both: "both",
}

const CATEGORY_MAP: Record<string, IspCatalogCategory> = {
  internet: "internet",
  empresarial: "business",
  business: "business",
  conectividad: "connectivity",
  connectivity: "connectivity",
  tv: "tv",
  camaras: "cameras",
  cameras: "cameras",
  otros: "other",
  other: "other",
}

const TECHNOLOGY_MAP: Record<string, IspCatalogTechnology> = {
  ftth: "ftth",
  fibra: "ftth",
  "fibra optica": "ftth",
  fiber: "ftth",
  wireless: "wireless",
  radio: "wireless",
  otra: "other",
  other: "other",
}

const BILLING_PERIOD_MAP: Record<string, "monthly"> = {
  mensual: "monthly",
  monthly: "monthly",
}

const BILLING_METHOD_MAP: Record<string, IspMonthlyCollectionMethod | "siro"> = {
  siro: "siro",
  pending: "pending",
  pendiente: "pending",
}

const BOOLEAN_TRUE = new Set(["si", "yes", "true", "1", "activo"])
const BOOLEAN_FALSE = new Set(["no", "false", "0", "inactivo"])

export function mapConnectionType(value: string): IspConnectionType | null {
  return lookup(value, CONNECTION_TYPE_MAP)
}

export function mapCustomerStatus(
  value: string
): "activo" | "inactivo" | "pendiente-activacion" | null {
  return lookup(value, CUSTOMER_STATUS_MAP)
}

export function mapCommercialStatus(value: string): IspCommercialStatus | null {
  return lookup(value, COMMERCIAL_STATUS_MAP)
}

export function mapTechnicalStatus(value: string): IspTechnicalStatus | null {
  return lookup(value, TECHNICAL_STATUS_MAP)
}

export function mapCustomerType(value: string): IspCatalogCustomerType | null {
  const mapped = lookup(value, CUSTOMER_TYPE_MAP)
  if (mapped) return mapped
  if ((ISP_CATALOG_CUSTOMER_TYPES as readonly string[]).includes(value)) {
    return value as IspCatalogCustomerType
  }
  return null
}

export function mapCatalogCategory(value: string): IspCatalogCategory | null {
  const mapped = lookup(value, CATEGORY_MAP)
  if (mapped) return mapped
  if ((ISP_CATALOG_CATEGORIES as readonly string[]).includes(value)) {
    return value as IspCatalogCategory
  }
  return null
}

export function mapCatalogTechnology(
  value: string
): IspCatalogTechnology | null {
  return lookup(value, TECHNOLOGY_MAP)
}

export function mapBillingPeriod(value: string): "monthly" | null {
  if (!value.trim()) return "monthly"
  return lookup(value, BILLING_PERIOD_MAP)
}

export function mapServiceBillingMethod(
  value: string
): IspMonthlyCollectionMethod | null {
  if (!value.trim()) return "pending"
  const mapped = lookup(value, BILLING_METHOD_MAP)
  if (mapped === "siro" || mapped === "pending") return mapped
  return null
}

export function mapCatalogBillingMethod(value: string): "siro" | null {
  if (!value.trim()) return "siro"
  return normalizeMigrationKey(value) === "siro" ? "siro" : null
}

export function mapYesNo(
  value: string,
  fallback: boolean | null = null
): boolean | null {
  const key = normalizeMigrationKey(value)
  if (!key) return fallback
  if (BOOLEAN_TRUE.has(key)) return true
  if (BOOLEAN_FALSE.has(key)) return false
  return null
}

export function isValidIpv4(value: string): boolean {
  const parts = value.trim().split(".")
  if (parts.length !== 4) return false
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false
    const numeric = Number(part)
    return numeric >= 0 && numeric <= 255
  })
}

export function parseMigrationMoney(value: string): {
  ok: boolean
  amount: number | null
  empty: boolean
} {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, amount: null, empty: true }

  const noSymbol = trimmed.replace(/\$/g, "").replace(/\s/g, "")
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(noSymbol)) {
    const amount = Number(noSymbol.replace(/\./g, "").replace(",", "."))
    return {
      ok: Number.isFinite(amount) && amount >= 0,
      amount: Number.isFinite(amount) ? amount : null,
      empty: false,
    }
  }

  const normalized = noSymbol.replace(",", ".")
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, amount: null, empty: false }
  }
  return { ok: true, amount, empty: false }
}

export function parseSpeedMbps(value: string): {
  ok: boolean
  amount: number | null
  empty: boolean
} {
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, amount: null, empty: true }
  const match = trimmed.replace(",", ".").match(/(\d+(?:\.\d+)?)/)
  if (!match) return { ok: false, amount: null, empty: false }
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, amount: null, empty: false }
  }
  return { ok: true, amount: Math.round(amount), empty: false }
}

export function formatContractedSpeed(
  download: number | null,
  upload: number | null
): string {
  if (download == null && upload == null) return ""
  if (download != null && upload != null) return `${download}/${upload} Mb`
  if (download != null) return `${download} Mb`
  return `${upload} Mb`
}

export function parseConnectionTypesList(value: string): {
  ok: boolean
  types: IspConnectionType[]
  unknown: string[]
} {
  if (!value.trim()) return { ok: true, types: [], unknown: [] }
  const parts = value.split(/[;,/|]/).map((part) => part.trim()).filter(Boolean)
  const types: IspConnectionType[] = []
  const unknown: string[] = []
  for (const part of parts) {
    const mapped = mapConnectionType(part)
    if (!mapped) {
      unknown.push(part)
      continue
    }
    if (!types.includes(mapped)) types.push(mapped)
  }
  return { ok: unknown.length === 0, types, unknown }
}
