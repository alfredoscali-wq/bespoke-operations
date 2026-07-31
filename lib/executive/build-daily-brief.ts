/**
 * Executive Daily Brief — presentation layer over ExecutiveBrief.
 * No new indicator math; only executive wording and section composition.
 */

import type {
  ExecutiveBrief,
  ExecutiveMetric,
  ExecutiveOperationalAlert,
  ExecutiveRelevantActivityItem,
} from "@/lib/executive/types"

export type DailyBriefLine = {
  id: string
  text: string
}

export type ExecutiveDailyBrief = {
  /** Underlying Indicator Engine brief (source of truth). */
  brief: ExecutiveBrief
  /** Multi-line executive synthesis for “¿Qué ocurrió hoy?” */
  summaryLines: string[]
  risks: DailyBriefLine[]
  highlights: DailyBriefLine[]
  tomorrow: DailyBriefLine[]
  generatedAt: string
}

function metricValue(
  metrics: ExecutiveMetric[],
  id: string
): number {
  return metrics.find((item) => item.id === id)?.value ?? 0
}

function buildSummaryLines(brief: ExecutiveBrief): string[] {
  const employees = metricValue(brief.generalState, "employees_active")
  const ot = metricValue(brief.generalState, "workorders_executed")
  const consultations = metricValue(
    brief.generalState,
    "consultations_attended"
  )
  const sales = metricValue(brief.generalState, "sales_completed")
  const crews = metricValue(brief.generalState, "crews_active")
  const projects = metricValue(brief.generalState, "projects_active")
  const hasCritical = brief.operationalAlerts.length > 0

  const lines: string[] = []

  if (!hasCritical && (employees > 0 || ot > 0 || consultations > 0)) {
    lines.push("La jornada finalizó con normalidad.")
  } else if (hasCritical) {
    lines.push(
      "La jornada cerró con temas que requieren seguimiento operativo."
    )
  } else {
    lines.push("La jornada no registró producción relevante.")
  }

  if (employees > 0) {
    lines.push(
      `Trabajaron ${employees} empleado${employees === 1 ? "" : "s"}.`
    )
  }
  if (crews > 0) {
    lines.push(
      `Hubo actividad en ${crews} cuadrilla${crews === 1 ? "" : "s"}.`
    )
  }
  if (ot > 0) {
    lines.push(`Se ejecutaron ${ot} OT.`)
  }
  if (consultations > 0) {
    lines.push(`Se atendieron ${consultations} consultas.`)
  }
  if (sales > 0) {
    lines.push(
      `Se concretaron ${sales} venta${sales === 1 ? "" : "s"}.`
    )
  }
  if (projects > 0) {
    lines.push(
      `Quedaron ${projects} obra${projects === 1 ? "" : "s"} con actividad.`
    )
  }

  if (!hasCritical) {
    lines.push("No hubo incidentes críticos.")
  }

  return lines
}

function buildRisks(
  alerts: ExecutiveOperationalAlert[]
): DailyBriefLine[] {
  const risks: DailyBriefLine[] = []

  for (const alert of alerts) {
    switch (alert.id) {
      case "ot_pending_day":
        risks.push({
          id: alert.id,
          text: `Hay ${alert.value} OT iniciada${alert.value === 1 ? "" : "s"} sin cierre registrado en el día.`,
        })
        break
      case "consultations_waiting":
        risks.push({
          id: alert.id,
          text: `Quedan ${alert.value} consulta${alert.value === 1 ? "" : "s"} del día sin resolución registrada.`,
        })
        break
      case "ot_rescheduled":
        risks.push({
          id: alert.id,
          text: `Se registraron ${alert.value} reprogramación${alert.value === 1 ? "" : "es"} de OT.`,
        })
        break
      case "ot_cancelled":
        risks.push({
          id: alert.id,
          text: `Hubo ${alert.value} cancelación${alert.value === 1 ? "" : "es"} de OT durante la jornada.`,
        })
        break
      case "consultations_transferred":
        risks.push({
          id: alert.id,
          text: `${alert.value} consulta${alert.value === 1 ? "" : "s"} fue${alert.value === 1 ? "" : "ron"} derivada${alert.value === 1 ? "" : "s"} a otras áreas.`,
        })
        break
      default:
        risks.push({
          id: alert.id,
          text: `${alert.label}: ${alert.value}.`,
        })
    }
  }

  return risks
}

function buildHighlights(
  brief: ExecutiveBrief,
  activity: ExecutiveRelevantActivityItem[]
): DailyBriefLine[] {
  const highlights: DailyBriefLine[] = []
  const getProd = (blockId: string, metricId: string) =>
    brief.production
      .find((block) => block.id === blockId)
      ?.metrics.find((item) => item.id === metricId)?.value ?? 0

  const projectsFinished = getProd("company", "projects_finished")
  const projectsStarted = getProd("company", "projects_started")
  const sales = metricValue(brief.generalState, "sales_completed")
  const otFinished = getProd("operations", "wo_finished")
  const consultationsResolved = getProd("attention", "att_resolved")
  const customersNew = getProd("company", "customers_new")

  if (projectsFinished > 0) {
    highlights.push({
      id: "highlight_project_finished",
      text:
        projectsFinished === 1
          ? "Se finalizó una obra."
          : `Se finalizaron ${projectsFinished} obras.`,
    })
  }
  if (projectsStarted > 0) {
    highlights.push({
      id: "highlight_project_started",
      text:
        projectsStarted === 1
          ? "Se inició una obra."
          : `Se iniciaron ${projectsStarted} obras.`,
    })
  }
  if (sales >= 3) {
    highlights.push({
      id: "highlight_sales_volume",
      text: `Se concretaron ${sales} ventas en la jornada.`,
    })
  } else if (sales > 0 && projectsFinished === 0) {
    // Light mention only when nothing stronger already listed
    const hasSaleActivity = activity.some((item) =>
      item.action.includes("commercial_activity.completed")
    )
    if (hasSaleActivity || sales > 0) {
      highlights.push({
        id: "highlight_sales",
        text:
          sales === 1
            ? "Se concretó una venta."
            : `Se concretaron ${sales} ventas.`,
      })
    }
  }
  if (otFinished >= 20) {
    highlights.push({
      id: "highlight_ot_volume",
      text: `Se cerró un volumen destacado de OT (${otFinished}).`,
    })
  }
  if (consultationsResolved >= 30) {
    highlights.push({
      id: "highlight_attention_volume",
      text: `Atención resolvió un volumen destacado de consultas (${consultationsResolved}).`,
    })
  }
  if (customersNew > 0) {
    highlights.push({
      id: "highlight_customers",
      text:
        customersNew === 1
          ? "Se incorporó un cliente nuevo."
          : `Se incorporaron ${customersNew} clientes nuevos.`,
    })
  }

  return highlights
}

function buildTomorrow(brief: ExecutiveBrief): DailyBriefLine[] {
  const items: DailyBriefLine[] = []
  const alertById = new Map(
    brief.operationalAlerts.map((alert) => [alert.id, alert])
  )

  const otPending = alertById.get("ot_pending_day")
  if (otPending) {
    items.push({
      id: "tomorrow_ot",
      text: `Continuar el cierre de ${otPending.value} OT pendiente${otPending.value === 1 ? "" : "s"}.`,
    })
  }

  const consultations = alertById.get("consultations_waiting")
  if (consultations) {
    items.push({
      id: "tomorrow_consultations",
      text: `Dar seguimiento a ${consultations.value} consulta${consultations.value === 1 ? "" : "s"} pendiente${consultations.value === 1 ? "" : "s"}.`,
    })
  }

  const rescheduled = alertById.get("ot_rescheduled")
  if (rescheduled) {
    items.push({
      id: "tomorrow_reschedule",
      text: "Revisar las OT reprogramadas y confirmar la nueva agenda.",
    })
  }

  const projects = metricValue(brief.generalState, "projects_active")
  if (projects > 0) {
    items.push({
      id: "tomorrow_projects",
      text: `Mantener seguimiento de ${projects} obra${projects === 1 ? "" : "s"} con actividad.`,
    })
  }

  const transferred = alertById.get("consultations_transferred")
  if (transferred) {
    items.push({
      id: "tomorrow_transfers",
      text: "Verificar el avance de las consultas derivadas.",
    })
  }

  return items
}

export type BuildDailyBriefInput = {
  brief: ExecutiveBrief
  /** ISO timestamp of generation. Defaults to now. */
  generatedAt?: string
}

/**
 * Compose the Executive Daily Brief from an existing ExecutiveBrief.
 * Does not call Indicator Engine again.
 */
export function buildExecutiveDailyBrief(
  input: BuildDailyBriefInput
): ExecutiveDailyBrief {
  const { brief } = input
  return {
    brief,
    summaryLines: buildSummaryLines(brief),
    risks: buildRisks(brief.operationalAlerts),
    highlights: buildHighlights(brief, brief.relevantActivity),
    tomorrow: buildTomorrow(brief),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  }
}
