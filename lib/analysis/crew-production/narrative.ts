/**
 * Narrative + labels for Producción de Cuadrillas (business story, not events).
 */

import type {
  CrewProductionDetail,
  CrewProductionRankingRow,
  CrewProductionSourceTask,
} from "@/lib/analysis/crew-production/types"

const STATUS_LABELS: Record<string, string> = {
  asignada: "Programada",
  "en-curso": "En curso",
  finalizada: "Finalizada",
  cerrada: "Cerrada",
  "en-aprobacion": "En aprobación",
  "pendiente-cierre": "Pendiente de cierre",
  cancelada: "Cancelada",
  incidencia: "Incidencia",
  vencida: "Vencida",
  programada: "Programada",
}

export function crewProductionStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function resolveInterventionResult(status: string): string {
  if (status === "finalizada" || status === "cerrada") return "Completada"
  if (status === "cancelada") return "Cancelada"
  if (status === "incidencia") return "Con incidencia"
  if (status === "en-aprobacion" || status === "pendiente-cierre") {
    return "En cierre"
  }
  if (status === "en-curso") return "En ejecución"
  if (status === "vencida") return "Vencida"
  return "Programada"
}

export function buildCrewProductionNarrative(input: {
  crewName: string
  finished: number
  programmed: number
  cancelled: number
  avgMinutes: number
}): string {
  const name = input.crewName.trim() || "La cuadrilla"
  const rate =
    input.programmed > 0
      ? Math.round((input.finished / input.programmed) * 100)
      : 0

  const lines: string[] = []

  if (input.finished === 0 && input.programmed === 0) {
    lines.push(
      `${name} no tuvo órdenes de trabajo programadas en el período seleccionado.`
    )
  } else {
    lines.push(
      `${name} completó ${input.finished} orden${input.finished === 1 ? "" : "es"} de trabajo durante la jornada.`
    )
    if (input.programmed > 0) {
      lines.push(
        `Finalizó el ${rate}% de las tareas programadas.`
      )
    }
  }

  if (input.cancelled === 0) {
    lines.push("No registró cancelaciones.")
  } else {
    lines.push(
      `Registró ${input.cancelled} cancelación${input.cancelled === 1 ? "" : "es"}.`
    )
  }

  if (input.finished > 0 && input.avgMinutes > 0) {
    lines.push(
      `Mantiene un tiempo promedio de ${Math.round(input.avgMinutes)} minutos por intervención.`
    )
  }

  return lines.join("\n\n")
}

export function rankByProductivity(
  rows: CrewProductionRankingRow[]
): CrewProductionRankingRow[] {
  return [...rows].sort((left, right) => {
    if (right.productivity !== left.productivity) {
      return right.productivity - left.productivity
    }
    if (right.finishedOt !== left.finishedOt) {
      return right.finishedOt - left.finishedOt
    }
    return left.crewName.localeCompare(right.crewName, "es")
  })
}

export function interventionCustomerName(
  task: CrewProductionSourceTask
): string {
  return (
    task.customerName?.trim() ||
    task.projectName?.trim() ||
    "Cliente no indicado"
  )
}
