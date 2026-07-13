import type {
  CustomerAtencionChannel,
  CustomerAtencionInboxRow,
  CustomerAtencionMotivo,
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

import {
  isConsultationExternalWaitNextStep,
  isConsultationParaResolverKpiNextStep,
} from "@/lib/customer-atenciones/consultation"

export const SHARED_INBOX_MAX_ROWS = 250

export type SharedInboxStatusFilter =
  | "all"
  | "nueva"
  | "para_resolver"
  | "en_gestion"
  | "pendiente"
  | "resuelta"
  | "resueltas_hoy"

export type SharedInboxKpiKey =
  | "nuevas"
  | "para_resolver"
  | "pendientes"
  | "resueltas_hoy"

export type SharedInboxOperationalCategory =
  | "retenciones"
  | "administracion"
  | "tecnica"
  | "contactar_cliente"
  | "morosos"
  | "generar_ot"

export type SharedInboxOperationalCounts = Record<
  SharedInboxOperationalCategory,
  number
>

export const SHARED_INBOX_OPERATIONAL_CATEGORY_ORDER: SharedInboxOperationalCategory[] =
  [
    "retenciones",
    "administracion",
    "morosos",
    "tecnica",
    "contactar_cliente",
    "generar_ot",
  ]

export const SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG: Record<
  SharedInboxOperationalCategory,
  { label: string; nextSteps: readonly CustomerAtencionNextStep[] }
> = {
  retenciones: {
    label: "Retenciones",
    nextSteps: ["realizar_retencion"],
  },
  administracion: {
    label: "Administración",
    nextSteps: [
      "derivar_admin_facturacion",
      "derivar_admin_gestion",
      "derivar_admin_morosos",
    ],
  },
  morosos: {
    label: "Morosos",
    nextSteps: ["derivar_admin_morosos"],
  },
  tecnica: {
    label: "Técnica",
    nextSteps: ["resolver_consulta_tecnica"],
  },
  contactar_cliente: {
    label: "Ventas",
    nextSteps: ["contactar_cliente"],
  },
  generar_ot: {
    label: "Pendiente de generar OT",
    nextSteps: ["generar_ot"],
  },
}

export type SharedInboxQuery = {
  statusFilter: SharedInboxStatusFilter
  motivo?: CustomerAtencionMotivo | "all"
  channel?: CustomerAtencionChannel | "all"
  operationalCategory?: SharedInboxOperationalCategory | null
}

export type SharedInboxKpiSummary = Record<SharedInboxKpiKey, number>

const ACTIVE_STATUSES = new Set<CustomerAtencionStatus>([
  "nueva",
  "para_resolver",
  "en_gestion",
  "pendiente",
])

export function getConsultationDayBoundsIso(referenceDate: Date): {
  start: string
  end: string
} {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0
  )
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function isActiveConsultationStatus(
  status: CustomerAtencionStatus
): boolean {
  return ACTIVE_STATUSES.has(status)
}

export function isConsultationResolvedToday(
  row: Pick<CustomerAtencionInboxRow, "status" | "updatedAt">,
  referenceDate: Date
): boolean {
  if (row.status !== "resuelta") {
    return false
  }

  const { start, end } = getConsultationDayBoundsIso(referenceDate)
  return row.updatedAt >= start && row.updatedAt < end
}

export function isConsultationCreatedToday(
  row: Pick<CustomerAtencionInboxRow, "status" | "createdAt">,
  referenceDate: Date
): boolean {
  if (row.status === "resuelta") {
    return false
  }

  const { start, end } = getConsultationDayBoundsIso(referenceDate)
  return row.createdAt >= start && row.createdAt < end
}

export function matchesParaResolverKpi(
  row: Pick<CustomerAtencionInboxRow, "status" | "nextStep">
): boolean {
  if (row.status === "resuelta" || !row.nextStep) {
    return false
  }

  return isConsultationParaResolverKpiNextStep(row.nextStep)
}

export function matchesPendientesKpi(
  row: Pick<CustomerAtencionInboxRow, "status" | "nextStep">
): boolean {
  if (row.status === "resuelta" || !row.nextStep) {
    return false
  }

  return isConsultationExternalWaitNextStep(row.nextStep)
}

export function matchesNuevasKpi(
  row: Pick<CustomerAtencionInboxRow, "status" | "createdAt">,
  referenceDate: Date = new Date()
): boolean {
  return isConsultationCreatedToday(row, referenceDate)
}

export function matchesMainKpiFilter(
  row: CustomerAtencionInboxRow,
  kpi: SharedInboxKpiKey,
  referenceDate: Date = new Date()
): boolean {
  if (kpi === "nuevas") {
    return matchesNuevasKpi(row, referenceDate)
  }

  if (kpi === "para_resolver") {
    return matchesParaResolverKpi(row)
  }

  if (kpi === "pendientes") {
    return matchesPendientesKpi(row)
  }

  return isConsultationResolvedToday(row, referenceDate)
}

export function computeSharedInboxKpis(
  rows: CustomerAtencionInboxRow[],
  referenceDate: Date = new Date()
): SharedInboxKpiSummary {
  let nuevas = 0
  let para_resolver = 0
  let pendientes = 0
  let resueltas_hoy = 0

  for (const row of rows) {
    if (matchesNuevasKpi(row, referenceDate)) {
      nuevas += 1
    }

    if (matchesParaResolverKpi(row)) {
      para_resolver += 1
    }

    if (matchesPendientesKpi(row)) {
      pendientes += 1
    }

    if (isConsultationResolvedToday(row, referenceDate)) {
      resueltas_hoy += 1
    }
  }

  return {
    nuevas,
    para_resolver,
    pendientes,
    resueltas_hoy,
  }
}

export function getOperationalCategoryForNextStep(
  nextStep: CustomerAtencionNextStep | null | undefined
): SharedInboxOperationalCategory | null {
  if (!nextStep) {
    return null
  }

  for (const category of SHARED_INBOX_OPERATIONAL_CATEGORY_ORDER) {
    if (
      SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG[category].nextSteps.includes(
        nextStep
      )
    ) {
      return category
    }
  }

  return null
}

export function matchesOperationalCategory(
  row: Pick<CustomerAtencionInboxRow, "status" | "nextStep">,
  category: SharedInboxOperationalCategory
): boolean {
  if (row.status === "resuelta" || !row.nextStep) {
    return false
  }

  return SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG[category].nextSteps.includes(
    row.nextStep
  )
}

export function computeOperationalWorkCounts(
  rows: CustomerAtencionInboxRow[]
): SharedInboxOperationalCounts {
  const counts: SharedInboxOperationalCounts = {
    retenciones: 0,
    administracion: 0,
    morosos: 0,
    tecnica: 0,
    contactar_cliente: 0,
    generar_ot: 0,
  }

  for (const row of rows) {
    if (row.status === "resuelta") {
      continue
    }

    // Morosos also rolls into Administración: a row may match multiple categories.
    for (const category of SHARED_INBOX_OPERATIONAL_CATEGORY_ORDER) {
      if (matchesOperationalCategory(row, category)) {
        counts[category] += 1
      }
    }
  }

  return counts
}

export function getVisibleOperationalCategories(
  counts: SharedInboxOperationalCounts
): SharedInboxOperationalCategory[] {
  return SHARED_INBOX_OPERATIONAL_CATEGORY_ORDER.filter(
    (category) => counts[category] > 0
  )
}

export function hasOperationalWorkCounts(
  counts: SharedInboxOperationalCounts
): boolean {
  return getVisibleOperationalCategories(counts).length > 0
}

export function mapSharedInboxKpiToStatusFilter(
  kpi: SharedInboxKpiKey | "none"
): SharedInboxStatusFilter {
  if (kpi === "nuevas") {
    return "nueva"
  }

  if (kpi === "para_resolver") {
    return "para_resolver"
  }

  if (kpi === "pendientes") {
    return "pendiente"
  }

  if (kpi === "resueltas_hoy") {
    return "resueltas_hoy"
  }

  return "all"
}

function matchesStatusFilter(
  row: CustomerAtencionInboxRow,
  statusFilter: SharedInboxStatusFilter,
  referenceDate: Date
): boolean {
  if (statusFilter === "resueltas_hoy") {
    return isConsultationResolvedToday(row, referenceDate)
  }

  if (statusFilter === "nueva") {
    return matchesNuevasKpi(row, referenceDate)
  }

  if (statusFilter === "para_resolver") {
    return matchesParaResolverKpi(row)
  }

  if (statusFilter === "pendiente") {
    return matchesPendientesKpi(row)
  }

  if (statusFilter === "all") {
    return true
  }

  return row.status === statusFilter
}

export function filterSharedInboxRows(
  rows: CustomerAtencionInboxRow[],
  query: SharedInboxQuery,
  referenceDate: Date = new Date()
): CustomerAtencionInboxRow[] {
  return rows.filter((row) => {
    if (!matchesStatusFilter(row, query.statusFilter, referenceDate)) {
      return false
    }

    if (query.motivo && query.motivo !== "all" && row.motivo !== query.motivo) {
      return false
    }

    if (query.channel && query.channel !== "all" && row.channel !== query.channel) {
      return false
    }

    if (
      query.operationalCategory &&
      !matchesOperationalCategory(row, query.operationalCategory)
    ) {
      return false
    }

    return true
  })
}

function compareActiveRows(
  left: CustomerAtencionInboxRow,
  right: CustomerAtencionInboxRow
): number {
  return left.createdAt.localeCompare(right.createdAt)
}

function compareResolvedRows(
  left: CustomerAtencionInboxRow,
  right: CustomerAtencionInboxRow
): number {
  return right.updatedAt.localeCompare(left.updatedAt)
}

export function sortSharedInboxRows(
  rows: CustomerAtencionInboxRow[],
  statusFilter: SharedInboxStatusFilter
): CustomerAtencionInboxRow[] {
  const copy = [...rows]

  if (statusFilter === "resuelta" || statusFilter === "resueltas_hoy") {
    return copy.sort(compareResolvedRows)
  }

  if (statusFilter !== "all") {
    return copy.sort(compareActiveRows)
  }

  const active: CustomerAtencionInboxRow[] = []
  const resolved: CustomerAtencionInboxRow[] = []

  for (const row of copy) {
    if (row.status === "resuelta") {
      resolved.push(row)
    } else {
      active.push(row)
    }
  }

  active.sort(compareActiveRows)
  resolved.sort(compareResolvedRows)

  return [...active, ...resolved]
}

export function truncateConsultationDetail(
  detail: string,
  maxLength = 96
): string {
  const trimmed = detail.trim()

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}
