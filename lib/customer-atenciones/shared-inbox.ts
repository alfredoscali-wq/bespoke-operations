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
import { isDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"

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
  /** Calendar day (YYYY-MM-DD) for created_at; empty/null = no date filter. */
  createdDate?: string | null
  /** Partial search across customer identity fields and consultation detail. */
  search?: string
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

/** Day bounds for a YYYY-MM-DD calendar date in the local timezone. */
export function getConsultationDayBoundsFromDateOnly(dateOnly: string): {
  start: string
  end: string
} | null {
  if (!isDateOnly(dateOnly)) {
    return null
  }

  const [yearText, monthText, dayText] = dateOnly.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return getConsultationDayBoundsIso(new Date(year, month - 1, day))
}

export function normalizeSharedInboxSearch(
  search: string | null | undefined
): string {
  return search?.trim() ?? ""
}

export function normalizeSharedInboxCreatedDate(
  createdDate: string | null | undefined
): string | null {
  const value = createdDate?.trim() ?? ""
  if (!value || !isDateOnly(value)) {
    return null
  }

  return value
}

export function hasSharedInboxDiscoveryFilters(
  query: Pick<SharedInboxQuery, "createdDate" | "search">
): boolean {
  return (
    Boolean(normalizeSharedInboxCreatedDate(query.createdDate)) ||
    Boolean(normalizeSharedInboxSearch(query.search))
  )
}

/** Resolves the calendar day used for day-scoped KPIs and list semantics. */
export function resolveSharedInboxReferenceDate(
  query: Pick<SharedInboxQuery, "createdDate">,
  now: Date = new Date()
): Date {
  const createdDate = normalizeSharedInboxCreatedDate(query.createdDate)
  if (!createdDate) {
    return now
  }

  const bounds = getConsultationDayBoundsFromDateOnly(createdDate)
  if (!bounds) {
    return now
  }

  const [yearText, monthText, dayText] = createdDate.split("-")
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 12, 0, 0, 0)
}

/**
 * Operational daily board: selected day is today, no search, and the status
 * filter is not an explicit resolved view.
 */
export function isOperationalInboxView(
  query: Pick<SharedInboxQuery, "createdDate" | "search" | "statusFilter">,
  now: Date = new Date()
): boolean {
  const createdDate = normalizeSharedInboxCreatedDate(query.createdDate)
  if (!createdDate) {
    return false
  }

  const isToday = createdDate === toLocalDateOnly(now)
  const searching = Boolean(normalizeSharedInboxSearch(query.search))
  const wantsResolved =
    query.statusFilter === "resuelta" || query.statusFilter === "resueltas_hoy"

  return isToday && !searching && !wantsResolved
}

export function matchesSharedInboxCreatedDate(
  row: Pick<CustomerAtencionInboxRow, "createdAt">,
  createdDate: string | null | undefined
): boolean {
  const normalized = normalizeSharedInboxCreatedDate(createdDate)
  if (!normalized) {
    return true
  }

  return toLocalDateOnly(new Date(row.createdAt)) === normalized
}

/** Historical day scope: created that day or resolved that day. */
export function matchesSharedInboxHistoricalDay(
  row: Pick<CustomerAtencionInboxRow, "createdAt" | "status" | "updatedAt">,
  createdDate: string | null | undefined,
  referenceDate: Date
): boolean {
  if (matchesSharedInboxCreatedDate(row, createdDate)) {
    return true
  }

  return isConsultationResolvedToday(row, referenceDate)
}

export function matchesSharedInboxSearch(
  row: Pick<CustomerAtencionInboxRow, "customerName" | "detail">,
  search: string | null | undefined
): boolean {
  const normalized = normalizeSharedInboxSearch(search).toLowerCase()
  if (!normalized) {
    return true
  }

  return (
    row.customerName.toLowerCase().includes(normalized) ||
    row.detail.toLowerCase().includes(normalized)
  )
}

/**
 * Default operational list row: active work needing action.
 * Includes Nuevas del día, Para Resolver, Pendiente y En gestión;
 * excludes resueltas.
 */
export function matchesOperationalInboxDefaultRow(
  row: Pick<CustomerAtencionInboxRow, "status" | "createdAt">,
  referenceDate: Date
): boolean {
  if (row.status === "resuelta") {
    return false
  }

  if (row.status === "nueva") {
    return matchesConsultasRecibidasHoyKpi(row, referenceDate)
  }

  // Para Resolver / Pendiente / En gestión (backlog activo).
  return (
    row.status === "para_resolver" ||
    row.status === "pendiente" ||
    row.status === "en_gestion"
  )
}

export type SharedInboxHistoricalDaySummary = {
  createdDate: string
  ingresadas: number
  resueltas: number
  pendientes: number
}

/**
 * Resumen histórico del día seleccionado (basado en creación del día).
 * pendientes = ingresadas del día que siguen abiertas.
 */
export function computeHistoricalDaySummary(
  rows: readonly Pick<
    CustomerAtencionInboxRow,
    "createdAt" | "status"
  >[],
  createdDate: string,
  referenceDate: Date
): SharedInboxHistoricalDaySummary {
  let ingresadas = 0
  let resueltas = 0
  let pendientes = 0

  for (const row of rows) {
    if (!matchesConsultasRecibidasHoyKpi(row, referenceDate)) {
      continue
    }

    ingresadas += 1
    if (row.status === "resuelta") {
      resueltas += 1
    } else {
      pendientes += 1
    }
  }

  return {
    createdDate,
    ingresadas,
    resueltas,
    pendientes,
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

/** Volumen de entrada del día: incluye gestión, pendientes y resueltas. */
export function matchesConsultasRecibidasHoyKpi(
  row: Pick<CustomerAtencionInboxRow, "createdAt">,
  referenceDate: Date = new Date()
): boolean {
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
  // Conservado para el chip de bandeja "Nuevas" (activas creadas hoy).
  return isConsultationCreatedToday(row, referenceDate)
}

export function matchesMainKpiFilter(
  row: CustomerAtencionInboxRow,
  kpi: SharedInboxKpiKey,
  referenceDate: Date = new Date()
): boolean {
  if (kpi === "nuevas") {
    return matchesConsultasRecibidasHoyKpi(row, referenceDate)
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
    if (matchesConsultasRecibidasHoyKpi(row, referenceDate)) {
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
  referenceDate: Date,
  query: SharedInboxQuery,
  now: Date
): boolean {
  if (statusFilter === "resueltas_hoy") {
    return isConsultationResolvedToday(row, referenceDate)
  }

  if (statusFilter === "nueva") {
    // "Ingresadas": created on the selected day (any status).
    return matchesConsultasRecibidasHoyKpi(row, referenceDate)
  }

  if (statusFilter === "para_resolver") {
    return matchesParaResolverKpi(row)
  }

  if (statusFilter === "pendiente") {
    return matchesPendientesKpi(row)
  }

  if (statusFilter === "all") {
    if (isOperationalInboxView(query, now)) {
      return matchesOperationalInboxDefaultRow(row, referenceDate)
    }

    return true
  }

  return row.status === statusFilter
}

export function filterSharedInboxDiscoveryRows(
  rows: CustomerAtencionInboxRow[],
  query: SharedInboxQuery,
  referenceDate: Date = new Date(),
  now: Date = new Date()
): CustomerAtencionInboxRow[] {
  const operational = isOperationalInboxView(
    { ...query, statusFilter: "all" },
    now
  )
  const searching = Boolean(normalizeSharedInboxSearch(query.search))

  // Note: operationalCategory is intentionally excluded from discovery.
  // Dashboard KPIs / work-queue counts must stay global for the jornada;
  // category only filters the consultation table (see filterSharedInboxRows).
  return rows.filter((row) => {
    if (query.motivo && query.motivo !== "all" && row.motivo !== query.motivo) {
      return false
    }

    if (query.channel && query.channel !== "all" && row.channel !== query.channel) {
      return false
    }

    if (searching) {
      // Global search: the database already matched customer identity fields
      // (name, phone, DNI, customer number, external code, address) plus the
      // consultation detail. Re-filtering in memory would incorrectly drop
      // matches on fields the inbox row does not carry, and the search is not
      // scoped to the selected day.
      return true
    }

    if (operational) {
      return true
    }

    if (!normalizeSharedInboxCreatedDate(query.createdDate)) {
      return true
    }

    return matchesSharedInboxHistoricalDay(row, query.createdDate, referenceDate)
  })
}

export function filterSharedInboxRows(
  rows: CustomerAtencionInboxRow[],
  query: SharedInboxQuery,
  referenceDate: Date = new Date(),
  now: Date = new Date()
): CustomerAtencionInboxRow[] {
  const discovered = filterSharedInboxDiscoveryRows(
    rows,
    query,
    referenceDate,
    now
  )

  return discovered.filter((row) => {
    if (
      query.operationalCategory &&
      !matchesOperationalCategory(row, query.operationalCategory)
    ) {
      return false
    }

    return matchesStatusFilter(row, query.statusFilter, referenceDate, query, now)
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
