import {
  computeIndicatorSnapshot,
  EXECUTIVE_BRIEF_INDICATOR_IDS,
  indicatorCount,
  indicatorTimestamp,
  INDICATOR_IDS,
  type IndicatorSourceEvent,
} from "@/lib/indicators"
import {
  EXECUTIVE_RELEVANT_ACTIONS,
  EXECUTIVE_RELEVANT_ACTIVITY_LIMIT,
} from "@/lib/executive/relevant-actions"
import type {
  ExecutiveBrief,
  ExecutiveBriefScope,
  ExecutiveMetric,
  ExecutiveOperationalAlert,
  ExecutiveProductionBlock,
  ExecutiveRelevantActivityItem,
} from "@/lib/executive/types"

function metric(id: string, label: string, value: number): ExecutiveMetric {
  return { id, label, value }
}

function buildNarrative(
  scope: ExecutiveBriefScope,
  general: ExecutiveMetric[]
): string {
  const byId = new Map(general.map((item) => [item.id, item.value]))
  const employees = byId.get("employees_active") ?? 0
  const ot = byId.get("workorders_executed") ?? 0
  const consultations = byId.get("consultations_attended") ?? 0
  const sales = byId.get("sales_completed") ?? 0

  const subject =
    scope.kind === "company"
      ? "La empresa"
      : scope.label?.trim() ||
        (scope.kind === "employee"
          ? "El empleado"
          : scope.kind === "crew"
            ? "La cuadrilla"
            : scope.kind === "project"
              ? "La obra"
              : "El cliente")

  const parts: string[] = []
  if (scope.kind === "company" || scope.kind === "crew" || scope.kind === "project") {
    if (employees > 0) {
      parts.push(
        `${employees} empleado${employees === 1 ? "" : "s"} con actividad`
      )
    }
  }
  if (ot > 0) parts.push(`${ot} OT ejecutada${ot === 1 ? "" : "s"}`)
  if (consultations > 0) {
    parts.push(
      `${consultations} consulta${consultations === 1 ? "" : "s"} atendida${consultations === 1 ? "" : "s"}`
    )
  }
  if (sales > 0) {
    parts.push(`${sales} venta${sales === 1 ? "" : "s"} realizada${sales === 1 ? "" : "s"}`)
  }

  if (parts.length === 0) {
    return `${subject} no registra producción relevante en esta fecha.`
  }
  return `${subject}: ${parts.join(". ")}.`
}

function buildOperationalAlerts(
  events: readonly IndicatorSourceEvent[],
  get: (id: string) => number
): ExecutiveOperationalAlert[] {
  const alerts: ExecutiveOperationalAlert[] = []

  const started = get(INDICATOR_IDS.WORKORDERS_STARTED)
  const finished = get(INDICATOR_IDS.WORKORDERS_FINISHED)
  const openOt = Math.max(0, started - finished)
  if (openOt > 0) {
    alerts.push({
      id: "ot_pending_day",
      label: "OT iniciadas sin cierre en el día",
      value: openOt,
    })
  }

  const createdAtt = get(INDICATOR_IDS.ATTENTIONS_CREATED)
  const resolvedAtt = get(INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const openAtt = Math.max(0, createdAtt - resolvedAtt)
  if (openAtt > 0) {
    alerts.push({
      id: "consultations_waiting",
      label: "Consultas abiertas en el día",
      value: openAtt,
    })
  }

  const rescheduled = get(INDICATOR_IDS.WORKORDERS_RESCHEDULED)
  if (rescheduled > 0) {
    alerts.push({
      id: "ot_rescheduled",
      label: "OT reprogramadas",
      value: rescheduled,
    })
  }

  const cancelled = get(INDICATOR_IDS.WORKORDERS_CANCELLED)
  if (cancelled > 0) {
    alerts.push({
      id: "ot_cancelled",
      label: "OT canceladas",
      value: cancelled,
    })
  }

  const transferred = get(INDICATOR_IDS.ATTENTIONS_TRANSFERRED)
  if (transferred > 0) {
    alerts.push({
      id: "consultations_transferred",
      label: "Consultas derivadas / transferidas",
      value: transferred,
    })
  }

  // Keep unused param documented for future live-state alerts.
  void events
  return alerts
}

function buildRelevantActivity(
  events: readonly IndicatorSourceEvent[]
): ExecutiveRelevantActivityItem[] {
  const matched = events
    .filter((event) => EXECUTIVE_RELEVANT_ACTIONS.has(event.action))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, EXECUTIVE_RELEVANT_ACTIVITY_LIMIT)

  return matched.map((event) => ({
    id: event.id ?? `${event.action}:${event.createdAt}`,
    createdAt: event.createdAt,
    action: event.action,
    title: event.title?.trim() || event.action,
    description: event.description ?? null,
    entityType: event.entityType ?? "",
    entityId: event.entityId ?? null,
    employeeId: event.employeeId?.trim() || null,
  }))
}

function productionBlocks(
  get: (id: string) => number,
  scopeKind: ExecutiveBriefScope["kind"]
): ExecutiveProductionBlock[] {
  const operations: ExecutiveMetric[] = [
    metric("wo_finished", "OT finalizadas", get(INDICATOR_IDS.WORKORDERS_FINISHED)),
    metric("wo_started", "OT iniciadas", get(INDICATOR_IDS.WORKORDERS_STARTED)),
    metric("wo_assigned", "OT asignadas", get(INDICATOR_IDS.WORKORDERS_ASSIGNED)),
    metric("wo_created", "OT creadas", get(INDICATOR_IDS.WORKORDERS_CREATED)),
  ].filter((item) => item.value > 0 || scopeKind !== "company")

  const attention: ExecutiveMetric[] = [
    metric(
      "att_created",
      "Consultas creadas",
      get(INDICATOR_IDS.ATTENTIONS_CREATED)
    ),
    metric(
      "att_resolved",
      "Consultas resueltas",
      get(INDICATOR_IDS.ATTENTIONS_RESOLVED)
    ),
    metric("retentions", "Retenciones", get(INDICATOR_IDS.RETENTIONS)),
    metric(
      "att_ot",
      "OT desde atención",
      get(INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED)
    ),
  ].filter((item) => item.value > 0 || scopeKind !== "company")

  const commercial: ExecutiveMetric[] = [
    metric(
      "sales",
      "Ventas realizadas",
      get(INDICATOR_IDS.COMMERCIAL_COMPLETED)
    ),
    metric(
      "commercial_acts",
      "Actividades comerciales",
      get(INDICATOR_IDS.COMMERCIAL_ACTIVITIES)
    ),
    metric(
      "requests_created",
      "Solicitudes creadas",
      get(INDICATOR_IDS.REQUESTS_CREATED)
    ),
    metric(
      "requests_resolved",
      "Solicitudes resueltas",
      get(INDICATOR_IDS.REQUESTS_RESOLVED)
    ),
  ].filter((item) => item.value > 0 || scopeKind !== "company")

  const companyBlock: ExecutiveMetric[] = [
    metric(
      "customers_new",
      "Clientes nuevos",
      get(INDICATOR_IDS.CUSTOMERS_CREATED)
    ),
    metric(
      "projects_started",
      "Obras iniciadas",
      get(INDICATOR_IDS.PROJECTS_STARTED)
    ),
    metric(
      "projects_finished",
      "Obras finalizadas",
      get(INDICATOR_IDS.PROJECTS_FINISHED)
    ),
  ].filter((item) => item.value > 0 || scopeKind !== "company")

  // For company view, hide empty blocks; for entity views keep structure.
  const blocks: ExecutiveProductionBlock[] = [
    { id: "operations", title: "Operaciones", metrics: operations },
    { id: "attention", title: "Atención", metrics: attention },
    { id: "commercial", title: "Comercial", metrics: commercial },
    { id: "company", title: "Empresa", metrics: companyBlock },
  ]

  if (scopeKind === "company") {
    return blocks
      .map((block) => ({
        ...block,
        metrics: block.metrics.filter((item) => item.value > 0),
      }))
      .filter((block) => block.metrics.length > 0)
  }

  return blocks
}

export type BuildExecutiveBriefInput = {
  scope: ExecutiveBriefScope
  date: string
  events: readonly IndicatorSourceEvent[]
}

/**
 * Builds the reusable Executive Brief from Activity events via Indicator Engine.
 * Screens must not recalculate indicators — they render this structure.
 */
export function buildExecutiveBrief(
  input: BuildExecutiveBriefInput
): ExecutiveBrief {
  const snapshot = computeIndicatorSnapshot(input.events, {
    indicatorIds: EXECUTIVE_BRIEF_INDICATOR_IDS,
  })
  const get = (id: string) => indicatorCount(snapshot, id)

  const workordersExecuted = get(INDICATOR_IDS.WORKORDERS_FINISHED)
  const consultationsAttended = get(INDICATOR_IDS.ATTENTIONS_CREATED)
  const salesCompleted = get(INDICATOR_IDS.COMMERCIAL_COMPLETED)

  const generalState: ExecutiveMetric[] = [
    metric(
      "employees_active",
      "Empleados activos",
      get(INDICATOR_IDS.EMPLOYEES_ACTIVE)
    ),
    metric("crews_active", "Cuadrillas activas", get(INDICATOR_IDS.CREWS_ACTIVE)),
    metric(
      "projects_active",
      "Obras activas",
      get(INDICATOR_IDS.PROJECTS_ACTIVE)
    ),
    metric("workorders_executed", "OT ejecutadas", workordersExecuted),
    metric(
      "consultations_attended",
      "Consultas atendidas",
      consultationsAttended
    ),
    metric("sales_completed", "Ventas realizadas", salesCompleted),
  ]

  // Entity scopes: drop company-only density metrics that confuse.
  const scopedGeneral =
    input.scope.kind === "employee"
      ? generalState.filter(
          (item) =>
            item.id === "workorders_executed" ||
            item.id === "consultations_attended" ||
            item.id === "sales_completed" ||
            item.id === "projects_active"
        )
      : generalState

  const firstEventAt = indicatorTimestamp(snapshot, INDICATOR_IDS.FIRST_EVENT_AT)
  const lastEventAt = indicatorTimestamp(snapshot, INDICATOR_IDS.LAST_EVENT_AT)
  const activeTimeMs = get(INDICATOR_IDS.ACTIVE_TIME_MS)

  return {
    scope: input.scope,
    date: input.date,
    narrative: buildNarrative(input.scope, scopedGeneral),
    generalState: scopedGeneral,
    production: productionBlocks(get, input.scope.kind),
    operationalAlerts: buildOperationalAlerts(input.events, get),
    relevantActivity: buildRelevantActivity(input.events),
    snapshot,
    firstEventAt,
    lastEventAt,
    activeTimeMs,
  }
}
