import type { WorkOrderTechnology } from "@/lib/tasks/commercial-plan"

export const ISP_CATALOG_CATEGORIES = [
  "internet",
  "business",
  "connectivity",
  "tv",
  "cameras",
  "other",
] as const
export type IspCatalogCategory = (typeof ISP_CATALOG_CATEGORIES)[number]

export const ISP_CATALOG_CUSTOMER_TYPES = [
  "residential",
  "business",
  "both",
] as const
export type IspCatalogCustomerType = (typeof ISP_CATALOG_CUSTOMER_TYPES)[number]

export const ISP_CATALOG_TECHNOLOGIES = ["ftth", "wireless", "other"] as const
export type IspCatalogTechnology = (typeof ISP_CATALOG_TECHNOLOGIES)[number]

export const ISP_CATALOG_BILLING_PERIODS = ["monthly"] as const
export type IspCatalogBillingPeriod = (typeof ISP_CATALOG_BILLING_PERIODS)[number]

export const ISP_CATALOG_BILLING_METHODS = ["siro"] as const
export type IspCatalogBillingMethod = (typeof ISP_CATALOG_BILLING_METHODS)[number]

export const ISP_CATALOG_CONNECTION_TYPES = [
  "pppoe",
  "static_ip",
  "dhcp",
  "l2l",
  "dedicated",
  "other",
] as const
export type IspCatalogConnectionType =
  (typeof ISP_CATALOG_CONNECTION_TYPES)[number]

export const ISP_CATALOG_SPEED_UNITS = ["mbps"] as const
export type IspCatalogSpeedUnit = (typeof ISP_CATALOG_SPEED_UNITS)[number]

export const ISP_CATALOG_CURRENCIES = ["ARS"] as const
export type IspCatalogCurrency = (typeof ISP_CATALOG_CURRENCIES)[number]

export const ISP_CATALOG_CORES = ["MikroTik"] as const

export const ISP_CATALOG_CATEGORY_LABELS: Record<IspCatalogCategory, string> = {
  internet: "Internet",
  business: "Empresarial",
  connectivity: "Conectividad",
  tv: "TV",
  cameras: "Cámaras",
  other: "Otros",
}

export const ISP_CATALOG_CUSTOMER_TYPE_LABELS: Record<
  IspCatalogCustomerType,
  string
> = {
  residential: "Particular",
  business: "Empresa",
  both: "Ambos",
}

export const ISP_CATALOG_TECHNOLOGY_LABELS: Record<IspCatalogTechnology, string> =
  {
    ftth: "Fibra óptica",
    wireless: "Wireless",
    other: "Otra",
  }

export const ISP_CATALOG_BILLING_PERIOD_LABELS: Record<
  IspCatalogBillingPeriod,
  string
> = {
  monthly: "Mensual",
}

export const ISP_CATALOG_BILLING_METHOD_LABELS: Record<
  IspCatalogBillingMethod,
  string
> = {
  siro: "SIRO",
}

export const ISP_CATALOG_CONNECTION_TYPE_LABELS: Record<
  IspCatalogConnectionType,
  string
> = {
  pppoe: "PPPoE",
  static_ip: "IP estática",
  dhcp: "DHCP",
  l2l: "L2L",
  dedicated: "Dedicado",
  other: "Otros",
}

export const ISP_CATALOG_SPEED_UNIT_LABELS: Record<string, string> = {
  mbps: "Mbps",
  gbps: "Gbps",
  kbps: "Kbps",
}

export const ISP_CATALOG_SIRO_STATUS_LABEL = "SIRO · Pendiente de integración"

export const OT_TECHNOLOGY_TO_CATALOG: Record<
  WorkOrderTechnology,
  IspCatalogTechnology
> = {
  fiber: "ftth",
  wireless: "wireless",
}

export const CATALOG_TECHNOLOGY_TO_OT: Partial<
  Record<IspCatalogTechnology, WorkOrderTechnology>
> = {
  ftth: "fiber",
  wireless: "wireless",
}

export const ISP_CATALOG_SEED_ITEMS = [
  {
    name: "FTTH 50 Mb",
    code: "FTTH-50",
    technicalProfileCode: "FTTH-50",
    otLabel: "50 Mb",
    legacyPlanCode: "50Mb",
    technology: "ftth" as const,
    downloadSpeedMbps: 50,
    allowedConnectionTypes: ["pppoe", "static_ip"] as IspCatalogConnectionType[],
  },
  {
    name: "FTTH 100 Mb",
    code: "FTTH-100",
    technicalProfileCode: "FTTH-100",
    otLabel: "100 Mb",
    legacyPlanCode: "100Mb",
    technology: "ftth" as const,
    downloadSpeedMbps: 100,
    allowedConnectionTypes: ["pppoe", "static_ip"] as IspCatalogConnectionType[],
  },
  {
    name: "FTTH 300 Mb",
    code: "FTTH-300",
    technicalProfileCode: "FTTH-300",
    otLabel: "300 Mb",
    legacyPlanCode: "300Mb",
    technology: "ftth" as const,
    downloadSpeedMbps: 300,
    allowedConnectionTypes: ["pppoe", "static_ip"] as IspCatalogConnectionType[],
  },
  {
    name: "Wireless 20 Mb",
    code: "WIRELESS-20",
    technicalProfileCode: "WIRELESS-20-IP",
    otLabel: "20 Mb Wireless",
    legacyPlanCode: "20Mb",
    technology: "wireless" as const,
    downloadSpeedMbps: 20,
    allowedConnectionTypes: ["static_ip"] as IspCatalogConnectionType[],
  },
] as const
