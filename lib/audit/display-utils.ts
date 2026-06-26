import type { AuditFieldChange } from "@/lib/audit/metadata-changes"
import type { AuditLogEntry } from "@/lib/audit/types"

export function formatAuditDisplayTimestamp(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function parseAuditChangesFromMetadata(
  metadata: Record<string, unknown>
): AuditFieldChange[] {
  const raw = metadata.changes
  if (!Array.isArray(raw)) return []

  return raw.filter(isAuditFieldChange)
}

function isAuditFieldChange(value: unknown): value is AuditFieldChange {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return typeof row.campo === "string"
}

export function formatAuditMetadataForDisplay(
  metadata: Record<string, unknown>
): Array<{ key: string; value: string }> {
  const hiddenKeys = new Set(["changes", "changedFields"])
  const rows: Array<{ key: string; value: string }> = []

  for (const [key, value] of Object.entries(metadata)) {
    if (hiddenKeys.has(key)) continue
    if (value === undefined || value === null) continue

    rows.push({
      key,
      value:
        typeof value === "string"
          ? value
          : JSON.stringify(value, null, 2),
    })
  }

  return rows.sort((a, b) => a.key.localeCompare(b.key))
}

export function resolveAuditStatusLabel(entry: AuditLogEntry): string {
  if (entry.severity === "CRITICAL") return "Crítico"
  if (entry.severity === "WARNING") return "Advertencia"
  return "OK"
}

export function buildAuditExportRow(entry: AuditLogEntry): Record<string, string> {
  return {
    Fecha: formatAuditDisplayTimestamp(entry.createdAt),
    Usuario: entry.performedByName,
    Modulo: entry.module,
    Accion: entry.action,
    Entidad: entry.entityLabel ?? "",
    Descripcion: entry.description,
    Estado: resolveAuditStatusLabel(entry),
    Severidad: entry.severity,
    "Tipo entidad": entry.entityType,
    "ID entidad": entry.entityId ?? "",
    IP: entry.ipAddress ?? "",
  }
}
