import type { WeeklyAutomaticReport } from "@/lib/reports/automatic/types"

function formatHours(value: number | null): string {
  if (value == null) {
    return "sin datos suficientes"
  }

  return `${value} h`
}

export function generateWeeklyReportNarrative(
  report: Pick<
    WeeklyAutomaticReport,
    "summary" | "crewPerformance" | "alerts" | "production"
  >
): string {
  const { summary, crewPerformance, alerts, production } = report
  const managed = summary.tasksDueInWeek || summary.tasksCreated
  const parts: string[] = []

  if (summary.tasksCompleted > 0) {
    parts.push(
      `Durante la semana se gestionaron ${managed} órdenes de trabajo, finalizando ${summary.tasksCompleted} (${summary.weeklyCompliancePercent}% de cumplimiento).`
    )
  } else {
    parts.push(
      `Durante la semana se gestionaron ${managed} órdenes de trabajo.`
    )
  }

  const bestCrew = crewPerformance.find(
    (row) => row.crewId !== "__unassigned__" && row.completed > 0
  )

  if (bestCrew) {
    parts.push(
      `La cuadrilla ${bestCrew.crewName} obtuvo el mejor rendimiento operativo (${bestCrew.compliancePercent}% de cumplimiento).`
    )
  }

  const productionTotal =
    production.instalacionNueva +
    production.cambioDomicilio +
    production.cambioTecnologia +
    production.serviceTecnico +
    production.reconexion +
    production.baja

  if (productionTotal > 0) {
    parts.push(
      `Se registraron ${productionTotal} cierres productivos (${production.instalacionNueva} instalaciones nuevas, ${production.serviceTecnico} servicios técnicos).`
    )
  }

  const alertParts: string[] = []
  if (alerts.overdueTasks > 0) {
    alertParts.push(`${alerts.overdueTasks} órdenes vencidas`)
  }
  if (alerts.pendingApprovalTasks > 0) {
    alertParts.push(`${alerts.pendingApprovalTasks} pendientes de aprobación`)
  }
  if (alerts.openIncidents > 0) {
    alertParts.push(`${alerts.openIncidents} incidencias abiertas`)
  }
  if (alerts.absentOperarios > 0) {
    alertParts.push(`${alerts.absentOperarios} operarios con ausencias`)
  }
  if (alerts.stoppedProjects > 0) {
    alertParts.push(`${alerts.stoppedProjects} obras detenidas`)
  }

  if (alertParts.length > 0) {
    parts.push(
      `Permanecen ${alertParts.join(", ")} que requieren seguimiento.`
    )
  } else {
    parts.push("No se registraron alertas críticas pendientes al cierre de la semana.")
  }

  parts.push(
    `El tiempo promedio de resolución fue ${formatHours(summary.averageResolutionHours)}.`
  )

  return parts.join(" ")
}
