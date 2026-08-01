/**
 * Map KPI / alert identifiers onto bare Análisis destinations.
 * Presentation-only — no data or query changes.
 */

const GENERAL_STATE_HREF: Record<string, string> = {
  employees_active: "/activity/workforce-monitor",
  crews_active: "/activity/cuadrillas",
  projects_active: "/operations/planificacion",
  workorders_executed: "/activity/cuadrillas",
  consultations_attended: "/atencion-cliente",
  sales_completed: "/gestion-comercial",
  customers_new: "/clientes",
  active_time: "/activity/jornada",
}

const OPERATIONAL_ALERT_HREF: Record<string, string> = {
  ot_pending_day: "/activity/cuadrillas",
  consultations_waiting: "/atencion-cliente",
  ot_rescheduled: "/operations/planificacion",
  ot_cancelled: "/activity/cuadrillas",
  consultations_transferred: "/atencion-cliente",
}

const CREW_KPI_HREF: Record<string, string> = {
  activeCrews: "/activity/cuadrillas",
  finishedOt: "/activity/cuadrillas",
  pendingOt: "/operations/planificacion",
  hoursWorked: "/activity/jornada",
  avgProductivity: "/activity/cuadrillas",
  avgMinutesPerOt: "/activity/cuadrillas",
}

export function hrefForSituationRoomMetric(metricId: string): string {
  return GENERAL_STATE_HREF[metricId] ?? "/activity/cuadrillas"
}

export function hrefForSituationRoomAlert(alertId: string): string {
  return OPERATIONAL_ALERT_HREF[alertId] ?? "/activity/cuadrillas"
}

export function hrefForCrewProductionKpi(kpiId: string): string {
  return CREW_KPI_HREF[kpiId] ?? "/activity/cuadrillas"
}

export function hrefForRelevantActivity(item: {
  entityType: string
  entityId: string | null
  employeeId: string | null
}): { path: string; taskId?: string; employeeId?: string } {
  const entity = item.entityType.trim().toLowerCase()
  if (
    (entity === "workorder" || entity === "task") &&
    item.entityId?.trim()
  ) {
    return {
      path: "/operations/planificacion",
      taskId: item.entityId.trim(),
    }
  }
  if (item.employeeId?.trim()) {
    return {
      path: "/activity/jornada",
      employeeId: item.employeeId.trim(),
    }
  }
  if (entity === "attention" || entity === "customer_atencion") {
    return { path: "/atencion-cliente" }
  }
  if (entity === "commercial_activity" || entity === "request") {
    return { path: "/gestion-comercial" }
  }
  if (entity === "customer") {
    return { path: "/clientes" }
  }
  if (entity === "project") {
    return { path: "/operations/planificacion" }
  }
  return { path: "/activity/cuadrillas" }
}
