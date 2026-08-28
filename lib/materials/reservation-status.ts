import type { TaskMaterialLineStatus } from "@/lib/types/materials"

export type TaskMaterialLineReservationDisplay = {
  label: string
  tone: "muted" | "success"
}

export function getTaskMaterialLineReservationDisplay(
  status: TaskMaterialLineStatus
): TaskMaterialLineReservationDisplay {
  switch (status) {
    case "reserved":
      return { label: "Reservado", tone: "success" }
    case "consumed":
      return { label: "Consumido", tone: "success" }
    case "planned":
      return { label: "Pendiente de reserva", tone: "muted" }
    case "cancelled":
      return { label: "Cancelado", tone: "muted" }
    default:
      return { label: "Pendiente de reserva", tone: "muted" }
  }
}

export function formatInsufficientStockMessage(input: {
  available: number
  requested: number
}): string {
  return `Stock insuficiente: disponible ${input.available.toLocaleString("es-AR")}, solicitado ${input.requested.toLocaleString("es-AR")}`
}
