import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import type { Crew } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import type { IncidentType } from "@/lib/types/incident-types"
import type { IncidentSummary, TaskIncidentStatus } from "@/lib/types/task-incidents"
import type { Task } from "@/lib/types/tasks"

export const PLANNING_INCIDENT_STATUS_LABELS: Record<TaskIncidentStatus, string> =
  {
    REPORTADA: "Reportada",
    EN_ANALISIS: "En análisis",
    RESUELTA: "Resuelta",
    RECHAZADA: "Rechazada",
  }

export const PLANNING_INCIDENT_EVENT_LABELS: Record<string, string> = {
  CREATED: "Incidencia creada",
  STATUS_CHANGED: "Estado actualizado",
  CONTINUE: "Continuar ejecución",
  REQUEST_INFO: "Información solicitada",
  RESCHEDULE: "Replanificación solicitada",
  CANCEL_TASK: "OT cancelada",
  CLOSED: "Incidencia cerrada",
}

export type PlanningIncidentListItem = IncidentSummary & {
  taskCode: string
  customerLabel: string
  crewLabel: string
  operatorLabel: string
  incidentTypeLabel: string
  elapsedLabel: string
}

export function sortIncidentsOldestFirst(
  incidents: IncidentSummary[]
): IncidentSummary[] {
  return [...incidents].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )
}

export function formatIncidentElapsedTime(createdAt: string): string {
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) {
    return "—"
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - createdMs) / 60000)
  )

  if (elapsedMinutes < 1) {
    return "Hace instantes"
  }

  if (elapsedMinutes < 60) {
    return elapsedMinutes === 1
      ? "Hace 1 minuto"
      : `Hace ${elapsedMinutes} minutos`
  }

  const hours = Math.floor(elapsedMinutes / 60)
  const minutes = elapsedMinutes % 60

  if (hours < 24) {
    if (minutes === 0) {
      return hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`
    }

    return `Hace ${hours} h ${minutes} min`
  }

  const days = Math.floor(hours / 24)
  return days === 1 ? "Hace 1 día" : `Hace ${days} días`
}

function resolveEmployeeLabel(
  employeeId: string,
  employees: Pick<Employee, "id" | "firstName" | "lastName">[]
): string {
  const employee = employees.find((entry) => entry.id === employeeId)
  if (!employee) {
    return "—"
  }

  const fullName = `${employee.firstName} ${employee.lastName}`.trim()
  return fullName || "—"
}

function resolveTaskCustomerLabel(task: Task | undefined): string {
  if (!task) {
    return "—"
  }

  return (
    task.customerName?.trim() ||
    task.customerCompany?.trim() ||
    task.title?.trim() ||
    "—"
  )
}

export function buildPlanningIncidentListItems(
  incidents: IncidentSummary[],
  tasks: Task[],
  crews: Pick<Crew, "id" | "name" | "members">[],
  employees: Pick<Employee, "id" | "firstName" | "lastName">[],
  incidentTypes: Pick<IncidentType, "id" | "name" | "code">[]
): PlanningIncidentListItem[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const incidentTypesById = new Map(
    incidentTypes.map((item) => [item.id, item] as const)
  )

  return sortIncidentsOldestFirst(incidents).map((incident) => {
    const task = tasksById.get(incident.taskId)
    const crewId =
      incident.crewId ??
      (task ? resolveTaskCrewId(task, crews) : null)
    const crew = crewId ? crews.find((entry) => entry.id === crewId) : undefined

    return {
      ...incident,
      taskCode: task ? formatTaskAdminDisplayCode(task.code) : "—",
      customerLabel: resolveTaskCustomerLabel(task),
      crewLabel: crew?.name?.trim() || task?.crew?.trim() || "—",
      operatorLabel: resolveEmployeeLabel(incident.employeeId, employees),
      incidentTypeLabel:
        incidentTypesById.get(incident.incidentTypeId)?.name?.trim() ||
        incidentTypesById.get(incident.incidentTypeId)?.code?.trim() ||
        "—",
      elapsedLabel: formatIncidentElapsedTime(incident.createdAt),
    }
  })
}

export function resolvePlanningIncidentTypeLabel(
  incidentTypeId: string,
  incidentTypes: Pick<IncidentType, "id" | "name" | "code">[]
): string {
  const incidentType = incidentTypes.find((item) => item.id === incidentTypeId)
  return incidentType?.name?.trim() || incidentType?.code?.trim() || "—"
}

export function resolvePlanningIncidentEventLabel(eventType: string): string {
  const normalized = eventType.trim()
  return PLANNING_INCIDENT_EVENT_LABELS[normalized] ?? normalized
}
