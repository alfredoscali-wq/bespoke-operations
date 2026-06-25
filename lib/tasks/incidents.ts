export type TaskIncidentReason =
  | "cliente-ausente"
  | "cliente-rechazo"
  | "lluvia"
  | "sin-energia"
  | "acceso-denegado"
  | "material-insuficiente"
  | "error-direccion"
  | "problema-tecnico"
  | "otro"

export const TASK_INCIDENT_REASONS: {
  value: TaskIncidentReason
  label: string
}[] = [
  { value: "cliente-ausente", label: "Cliente ausente" },
  { value: "cliente-rechazo", label: "Cliente rechazó el trabajo" },
  { value: "lluvia", label: "Lluvia" },
  { value: "sin-energia", label: "Sin energía eléctrica" },
  { value: "acceso-denegado", label: "Acceso denegado" },
  { value: "material-insuficiente", label: "Material insuficiente" },
  { value: "error-direccion", label: "Error de dirección" },
  { value: "problema-tecnico", label: "Problema técnico" },
  { value: "otro", label: "Otro" },
]

export const TASK_INCIDENT_REASON_LABELS: Record<TaskIncidentReason, string> =
  Object.fromEntries(
    TASK_INCIDENT_REASONS.map((item) => [item.value, item.label])
  ) as Record<TaskIncidentReason, string>

export function resolveIncidentReasonLabel(
  reason: string | null | undefined
): string {
  const trimmed = reason?.trim()
  if (!trimmed) return "—"

  return (
    TASK_INCIDENT_REASON_LABELS[trimmed as TaskIncidentReason] ?? trimmed
  )
}

export function isIncidentStatus(
  status: string
): status is "incidencia" {
  return status === "incidencia"
}
