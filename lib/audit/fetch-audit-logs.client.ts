import type {
  AuditLogEntry,
  AuditLogQueryResult,
  AuditLogStats,
} from "@/lib/audit/types"

type AuditFetchResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

export async function fetchAuditLogs(
  params: URLSearchParams
): Promise<AuditFetchResult<AuditLogQueryResult>> {
  const response = await fetch(`/api/audit/events?${params.toString()}`)

  const payload = (await response.json()) as AuditLogQueryResult & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar el historial.",
    }
  }

  return {
    success: true,
    data: {
      entries: payload.entries,
      total: payload.total,
      page: payload.page,
      limit: payload.limit,
    },
  }
}

export async function fetchAuditStats(): Promise<AuditFetchResult<AuditLogStats>> {
  const response = await fetch("/api/audit/events/summary")
  const payload = (await response.json()) as AuditLogStats & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message: payload.message ?? "No se pudieron cargar los indicadores.",
    }
  }

  return {
    success: true,
    data: {
      eventsToday: payload.eventsToday,
      activeUsersToday: payload.activeUsersToday,
      tasksCreatedToday: payload.tasksCreatedToday,
      tasksFinishedToday: payload.tasksFinishedToday,
      criticalToday: payload.criticalToday,
      loginsToday: payload.loginsToday,
    },
  }
}

export async function fetchAuditEntityTimeline(input: {
  entityType: string
  entityId: string
}): Promise<AuditFetchResult<AuditLogEntry[]>> {
  const params = new URLSearchParams({
    entityType: input.entityType,
    entityId: input.entityId,
  })
  const response = await fetch(`/api/audit/events/timeline?${params.toString()}`)
  const payload = (await response.json()) as {
    success?: boolean
    message?: string
    entries?: AuditLogEntry[]
  }

  if (!response.ok || !payload.success || !payload.entries) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar la línea de tiempo.",
    }
  }

  return { success: true, data: payload.entries }
}

export function buildAuditExportUrl(
  params: URLSearchParams,
  format: "csv" | "xlsx" | "pdf"
): string {
  const exportParams = new URLSearchParams(params)
  exportParams.set("format", format)
  return `/api/audit/events/export?${exportParams.toString()}`
}
