import type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete"

export type PermanentDeleteRequest = {
  entityType: PermanentDeleteEntityType
  entityId: string
}

export type PermanentDeleteResponse = {
  success: boolean
  message?: string
  entityType?: PermanentDeleteEntityType
  entityId?: string
  entityLabel?: string
  deletedTasks?: number
}

export async function requestPermanentDelete(
  input: PermanentDeleteRequest
): Promise<PermanentDeleteResponse> {
  const response = await fetch("/api/admin/permanent-delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  const payload = (await response.json()) as PermanentDeleteResponse

  if (!response.ok) {
    return {
      success: false,
      message: payload.message ?? "No se pudo eliminar definitivamente el registro.",
    }
  }

  return payload
}

export async function fetchSystemAuditLogs(): Promise<{
  success: boolean
  message?: string
  entries?: import("@/lib/audit/types").AuditLogEntry[]
}> {
  const response = await fetch("/api/audit/events?severity=CRITICAL&limit=50")

  const payload = (await response.json()) as {
    success: boolean
    message?: string
    entries?: import("@/lib/audit/types").AuditLogEntry[]
  }

  if (!response.ok) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar el Historial del Sistema.",
    }
  }

  return {
    success: true,
    entries: payload.entries ?? [],
  }
}
