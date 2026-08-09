/**
 * OPS 2.1B — split KPIs: OT operativas (ruta) vs OT de Obra (capacidad sin orden).
 */

import {
  formatPlanningMultiDayBadge,
  resolvePlanningDayDurationMinutes,
  resolvePlanningRangeStartDate,
} from "@/lib/planificacion/planning-date-range"
import { resolveIncidentReasonLabel } from "@/lib/tasks/incidents"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type PlanningOperativeKpis = {
  programmedCount: number
  assignedCount: number
  overdueCount: number
  dayLoadMinutes: number
}

export type PlanningObrasKpis = {
  activeObrasCount: number
  activeObraTaskCount: number
  affectedCrewsCount: number
  committedDayMinutes: number
}

export type PlanningObraActiveRow = {
  taskId: string
  projectId: string
  code: string
  title: string
  obraName: string
  crewId: string | null
  crewName: string
  startDate: string
  dueDate: string
  dayBadge: string | null
  dayDurationMinutes: number
  status: Task["status"]
  /** OPS 2.4 — open incident on Obra OT (status = incidencia). */
  hasOpenIncident: boolean
  incidentReasonLabel: string | null
  incidentReportedAt: string | null
  incidentReportedBy: string | null
}

export function computePlanningOperativeKpis(
  routeTasks: Task[],
  planningDate: string,
  overdueCount: number
): PlanningOperativeKpis {
  return {
    programmedCount: routeTasks.filter((t) => t.status === "programada").length,
    assignedCount: routeTasks.filter((t) => t.status === "asignada").length,
    overdueCount,
    dayLoadMinutes: routeTasks.reduce(
      (sum, task) =>
        sum + resolvePlanningDayDurationMinutes(task, planningDate),
      0
    ),
  }
}

export function computePlanningObrasKpis(
  obraTasks: Task[],
  planningDate: string,
  crews: Pick<Crew, "id" | "name">[]
): PlanningObrasKpis {
  const obraIds = new Set<string>()
  const crewIds = new Set<string>()
  let committedDayMinutes = 0

  for (const task of obraTasks) {
    if (task.projectId?.trim()) {
      obraIds.add(task.projectId.trim())
    }
    const crewId = resolveTaskCrewId(task, crews)
    if (crewId) {
      crewIds.add(crewId)
    }
    committedDayMinutes += resolvePlanningDayDurationMinutes(
      task,
      planningDate
    )
  }

  return {
    activeObrasCount: obraIds.size,
    activeObraTaskCount: obraTasks.length,
    affectedCrewsCount: crewIds.size,
    committedDayMinutes,
  }
}

export function buildPlanningObraActiveRows(
  obraTasks: Task[],
  planningDate: string,
  crews: Pick<Crew, "id" | "name">[]
): PlanningObraActiveRow[] {
  return [...obraTasks]
    .sort((left, right) => {
      const leftIncident = left.status === "incidencia" ? 0 : 1
      const rightIncident = right.status === "incidencia" ? 0 : 1
      if (leftIncident !== rightIncident) {
        return leftIncident - rightIncident
      }
      return left.code.localeCompare(right.code, "es")
    })
    .map((task) => {
      const crewId = resolveTaskCrewId(task, crews) ?? null
      const crew = crewId
        ? crews.find((entry) => entry.id === crewId)
        : undefined
      const hasOpenIncident = task.status === "incidencia"

      return {
        taskId: task.id,
        projectId: task.projectId?.trim() || "",
        code: task.code,
        title: task.title?.trim() || task.code,
        obraName:
          task.projectName?.trim() ||
          task.projectCode?.trim() ||
          "Obra",
        crewId,
        crewName: crew?.name?.trim() || task.crew?.trim() || "Sin cuadrilla",
        startDate: resolvePlanningRangeStartDate(task),
        dueDate: task.dueDate,
        dayBadge: formatPlanningMultiDayBadge(task, planningDate),
        dayDurationMinutes: resolvePlanningDayDurationMinutes(
          task,
          planningDate
        ),
        status: task.status,
        hasOpenIncident,
        incidentReasonLabel: hasOpenIncident
          ? resolveIncidentReasonLabel(task.incidentReason)
          : null,
        incidentReportedAt: hasOpenIncident
          ? task.incidentReportedAt?.trim() || null
          : null,
        incidentReportedBy: hasOpenIncident
          ? task.incidentReportedBy?.trim() || null
          : null,
      }
    })
}
