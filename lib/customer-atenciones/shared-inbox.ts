import type {
  CustomerAtencionChannel,
  CustomerAtencionInboxRow,
  CustomerAtencionMotivo,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

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

export type SharedInboxQuery = {
  statusFilter: SharedInboxStatusFilter
  motivo?: CustomerAtencionMotivo | "all"
  channel?: CustomerAtencionChannel | "all"
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

export function computeSharedInboxKpis(
  rows: CustomerAtencionInboxRow[],
  referenceDate: Date = new Date()
): SharedInboxKpiSummary {
  let nuevas = 0
  let para_resolver = 0
  let pendientes = 0
  let resueltas_hoy = 0

  for (const row of rows) {
    if (row.status === "nueva") {
      nuevas += 1
    }

    if (row.status === "para_resolver") {
      para_resolver += 1
    }

    if (row.status === "pendiente") {
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

export function filterSharedInboxRows(
  rows: CustomerAtencionInboxRow[],
  query: SharedInboxQuery,
  referenceDate: Date = new Date()
): CustomerAtencionInboxRow[] {
  return rows.filter((row) => {
    if (query.statusFilter === "resueltas_hoy") {
      if (!isConsultationResolvedToday(row, referenceDate)) {
        return false
      }
    } else if (
      query.statusFilter !== "all" &&
      row.status !== query.statusFilter
    ) {
      return false
    }

    if (query.motivo && query.motivo !== "all" && row.motivo !== query.motivo) {
      return false
    }

    if (query.channel && query.channel !== "all" && row.channel !== query.channel) {
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
