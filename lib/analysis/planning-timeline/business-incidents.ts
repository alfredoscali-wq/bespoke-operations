/**
 * Business-only incident classification for Timeline Operativo.
 * Technical / system errors are never shown.
 */

import {
  resolveIncidentReasonLabel,
  type TaskIncidentReason,
} from "@/lib/tasks/incidents"

const BUSINESS_REASONS = new Set<TaskIncidentReason>([
  "cliente-ausente",
  "cliente-rechazo",
  "lluvia",
  "sin-energia",
  "acceso-denegado",
  "material-insuficiente",
  "error-direccion",
  "otro",
])

const BUSINESS_TITLE_BY_REASON: Partial<Record<TaskIncidentReason, string>> = {
  "cliente-ausente": "Cliente ausente",
  "cliente-rechazo": "Cliente rechazó el trabajo",
  lluvia: "Condición climática",
  "sin-energia": "Sin energía eléctrica",
  "acceso-denegado": "Sin acceso",
  "material-insuficiente": "Material faltante",
  "error-direccion": "Error de dirección",
  otro: "Incidente operativo",
}

export function isBusinessIncidentReason(
  reason: string | null | undefined
): boolean {
  const trimmed = reason?.trim()
  if (!trimmed) return false
  if (trimmed === "problema-tecnico") return false
  return BUSINESS_REASONS.has(trimmed as TaskIncidentReason)
}

export function businessIncidentTitle(
  reason: string | null | undefined
): string | null {
  const trimmed = reason?.trim()
  if (!trimmed || !isBusinessIncidentReason(trimmed)) return null
  return (
    BUSINESS_TITLE_BY_REASON[trimmed as TaskIncidentReason] ??
    resolveIncidentReasonLabel(trimmed)
  )
}
