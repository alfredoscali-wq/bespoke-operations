import type { CustomerSeguimientoStatus } from "@/lib/types/customer-seguimientos"

const STATUS_LABELS: Record<CustomerSeguimientoStatus, string> = {
  pendiente: "Pendiente",
  completado: "Completado",
}

export function formatCustomerSeguimientoStatusLabel(
  status: CustomerSeguimientoStatus
): string {
  return STATUS_LABELS[status] ?? status
}

export function formatScheduledTimeLabel(
  scheduledTime?: string | null
): string {
  if (!scheduledTime) {
    return "Sin horario"
  }

  const [hours, minutes] = scheduledTime.split(":")
  if (!hours || !minutes) {
    return scheduledTime
  }

  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`
}

export function formatScheduledDateLabel(
  scheduledDate: string,
  locale = "es-AR"
): string {
  const date = new Date(`${scheduledDate}T12:00:00`)
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}
