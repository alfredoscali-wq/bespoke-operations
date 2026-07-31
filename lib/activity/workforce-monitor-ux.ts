/**
 * Presentation helpers for Workforce Monitor production column.
 * Consumes business counters aligned with Actividad de la Jornada.
 */

import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import type { WorkforceActivityStatus } from "@/lib/activity/workforce-activity-status"
import type { WorkforceProductionCounters } from "@/lib/activity/workforce-monitor"

export type WorkforceExecutiveStatusId =
  | "activo"
  | "sin_actividad_reciente"
  | "jornada_finalizada"
  | "sin_actividad"

export type WorkforceExecutiveStatus = {
  id: WorkforceExecutiveStatusId
  label: string
  /** Dot color — icon-only accent, not a badge background. */
  dotClassName: string
}

export type WorkforceProductionHighlight = {
  id: string
  count: number
  text: string
}

/** Friendlier filter labels — same underlying status ids. */
export const WORKFORCE_STATUS_FILTER_LABELS: Record<
  WorkforceActivityStatus,
  string
> = {
  sin_actividad: "Sin actividad",
  baja_actividad: "Sin actividad reciente",
  actividad_normal: "Activo",
  alta_actividad: "Alta actividad",
}

function pluralize(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? singular : plural
}

/**
 * Business production lines for the table (volume + result when relevant).
 * Never shows Activity Engine event buckets.
 */
export function buildWorkforceProductionHighlights(
  production: WorkforceProductionCounters
): WorkforceProductionHighlight[] {
  const highlights: WorkforceProductionHighlight[] = []

  if (production.attentionsCreated > 0) {
    highlights.push({
      id: "attentions_created",
      count: production.attentionsCreated,
      text: `${production.attentionsCreated} ${pluralize(production.attentionsCreated, "expediente", "expedientes")}`,
    })
    if (production.attentionsResolved > 0) {
      highlights.push({
        id: "attentions_resolved",
        count: production.attentionsResolved,
        text: `${production.attentionsResolved} ${pluralize(production.attentionsResolved, "resuelto", "resueltos")}`,
      })
    }
    return highlights
  }

  if (
    production.workordersCreated > 0 ||
    production.workordersStarted > 0 ||
    production.workordersFinished > 0
  ) {
    const otVolume = Math.max(
      production.workordersCreated,
      production.workordersStarted,
      production.workordersFinished
    )
    highlights.push({
      id: "workorders",
      count: otVolume,
      text: `${otVolume} ${pluralize(otVolume, "OT", "OT")}`,
    })
    if (production.workordersFinished > 0) {
      highlights.push({
        id: "workorders_finished",
        count: production.workordersFinished,
        text: `${production.workordersFinished} ${pluralize(production.workordersFinished, "finalizada", "finalizadas")}`,
      })
    }
    return highlights
  }

  if (production.customersCreated > 0) {
    highlights.push({
      id: "customers_created",
      count: production.customersCreated,
      text: `${production.customersCreated} ${pluralize(production.customersCreated, "cliente nuevo", "clientes nuevos")}`,
    })
  }

  if (production.commercialCompleted > 0) {
    highlights.push({
      id: "commercial_completed",
      count: production.commercialCompleted,
      text: `${production.commercialCompleted} ${pluralize(production.commercialCompleted, "venta", "ventas")}`,
    })
  }

  if (production.retentions > 0) {
    highlights.push({
      id: "retentions",
      count: production.retentions,
      text: `${production.retentions} ${pluralize(production.retentions, "retención", "retenciones")}`,
    })
  }

  if (production.requestsCreated > 0) {
    highlights.push({
      id: "requests_created",
      count: production.requestsCreated,
      text: `${production.requestsCreated} ${pluralize(production.requestsCreated, "solicitud", "solicitudes")}`,
    })
  }

  if (
    production.attentionsTransferred > 0 &&
    highlights.length === 0
  ) {
    highlights.push({
      id: "attentions_transferred",
      count: production.attentionsTransferred,
      text: `${production.attentionsTransferred} ${pluralize(production.attentionsTransferred, "derivación", "derivaciones")}`,
    })
  }

  if (
    production.attentionsWorkordersGenerated > 0 &&
    highlights.length === 0
  ) {
    highlights.push({
      id: "attentions_ot",
      count: production.attentionsWorkordersGenerated,
      text: `${production.attentionsWorkordersGenerated} ${pluralize(production.attentionsWorkordersGenerated, "OT generada", "OT generadas")}`,
    })
  }

  return highlights
}

/**
 * Secondary production note (actions / complement), aligned with Jornada language.
 */
export function buildWorkforceProductionNarrative(
  production: WorkforceProductionCounters
): string | null {
  if (production.attentionsCreated > 0) {
    const parts: string[] = []
    if (production.attentionsPending > 0) {
      parts.push(
        `${production.attentionsPending} ${pluralize(production.attentionsPending, "pendiente", "pendientes")}`
      )
    }
    if (production.attentionsTransferred > 0) {
      parts.push(
        `${production.attentionsTransferred} ${pluralize(production.attentionsTransferred, "derivación", "derivaciones")}`
      )
    }
    if (production.attentionsWorkordersGenerated > 0) {
      parts.push(
        `${production.attentionsWorkordersGenerated} ${pluralize(production.attentionsWorkordersGenerated, "OT generada", "OT generadas")}`
      )
    }
    if (production.retentions > 0) {
      parts.push(
        `${production.retentions} ${pluralize(production.retentions, "retención", "retenciones")}`
      )
    }
    return parts.length > 0 ? parts.join(" · ") : null
  }

  if (
    production.workordersCreated > 0 ||
    production.workordersStarted > 0 ||
    production.workordersFinished > 0
  ) {
    const parts: string[] = []
    if (production.workordersCreated > 0) {
      parts.push(
        `${production.workordersCreated} ${pluralize(production.workordersCreated, "creada", "creadas")}`
      )
    }
    if (production.workordersStarted > 0) {
      parts.push(
        `${production.workordersStarted} ${pluralize(production.workordersStarted, "iniciada", "iniciadas")}`
      )
    }
    return parts.length > 0 ? parts.join(" · ") : null
  }

  return null
}

/** Sort key: business volume first (expedientes, then OT, then commercial). */
export function workforceProductionScore(
  production: WorkforceProductionCounters
): number {
  return (
    production.attentionsCreated * 1000 +
    production.attentionsResolved * 100 +
    production.workordersFinished * 50 +
    production.workordersCreated * 40 +
    production.customersCreated * 30 +
    production.commercialCompleted * 30 +
    production.retentions * 20 +
    production.requestsCreated * 10 +
    production.attentionsTransferred +
    production.attentionsWorkordersGenerated
  )
}

export function formatWorkforceActiveTime(
  firstEventAt: string | null,
  lastEventAt: string | null
): string {
  if (!firstEventAt || !lastEventAt) return "—"
  const start = new Date(firstEventAt).getTime()
  const end = new Date(lastEventAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—"
  }
  const ms = end - start
  if (ms <= 0) return "—"
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, "0")} min`
}

/**
 * Executive status from existing row fields + selected date.
 * Does not change classifyWorkforceActivityStatus.
 */
export function resolveWorkforceExecutiveStatus(input: {
  activityStatus: WorkforceActivityStatus
  eventCount: number
  selectedDate: string
  today?: string
}): WorkforceExecutiveStatus {
  const today = input.today ?? todayDateInputValue()

  if (input.eventCount <= 0 || input.activityStatus === "sin_actividad") {
    return {
      id: "sin_actividad",
      label: "Sin actividad",
      dotClassName: "bg-red-500",
    }
  }

  if (input.selectedDate < today) {
    return {
      id: "jornada_finalizada",
      label: "Jornada finalizada",
      dotClassName: "bg-slate-400",
    }
  }

  if (input.activityStatus === "baja_actividad") {
    return {
      id: "sin_actividad_reciente",
      label: "Sin actividad reciente",
      dotClassName: "bg-amber-500",
    }
  }

  return {
    id: "activo",
    label: "Activo",
    dotClassName: "bg-emerald-500",
  }
}

export function buildJornadaHref(employeeId: string, date: string): string {
  const params = new URLSearchParams({
    employeeId,
    date,
  })
  return `/activity/jornada?${params.toString()}`
}
