import { toDateOnly } from "@/lib/availability/utils"
import { getCrewAvailabilitySummary } from "@/lib/crews/availability"
import type { CrewAvailabilityContext } from "@/lib/crews/availability"
import {
  crewHasFieldTasks,
  isCrewManuallyInactive,
  resolveCrewStatus,
} from "@/lib/crews/status-workflow"
import { compareDateOnly } from "@/lib/dates/date-only"
import { isActiveEvidence } from "@/lib/evidence/utils"
import {
  buildProjectOperationalMetricsMap,
} from "@/lib/projects/project-operational-metrics"
import { getTasksSummary } from "@/lib/data/tasks"
import {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
  isFinalTaskStatus,
} from "@/lib/tasks/status-groups"
import type { Crew } from "@/lib/types/crews"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type { Project, ProjectStatus } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"

export type DashboardExecutiveKpi = {
  id: string
  label: string
  value: string
  hint: string
  href: string
}

export type DashboardAlertSeverity = "critical" | "warning" | "success"

export type DashboardOperationalAlert = {
  id: string
  severity: DashboardAlertSeverity
  message: string
  href?: string
}

export type DashboardDayOperationMetric = {
  id: string
  label: string
  value: number
  hint: string
}

export type DashboardStatusKpi = {
  id: string
  label: string
  value: number
  href: string
}

export type DashboardActivityTone = "success" | "warning" | "neutral"

export type DashboardActivityItem = {
  id: string
  message: string
  tone: DashboardActivityTone
  href?: string
}

type DashboardActivityEvent = DashboardActivityItem & {
  sortAt: number
}

function countProjectsByStatus(
  projects: Project[],
  status: ProjectStatus
): number {
  return projects.filter((project) => project.status === status).length
}

function isTaskOverdue(task: Task, today: string): boolean {
  if (isFinalTaskStatus(task.status)) {
    return false
  }

  return compareDateOnly(task.dueDate, today) < 0
}

function isTaskScheduledForToday(task: Task, today: string): boolean {
  if (!ACTIVE_TASK_STATUSES.includes(task.status)) {
    return false
  }

  return task.dueDate === today || task.startDate === today
}

function isTaskCompletedToday(task: Task, today: string): boolean {
  return (
    (task.status === "finalizada" || task.status === "cerrada") &&
    task.dueDate === today
  )
}

export function buildExecutiveSummary(input: {
  projects: Project[]
  tasks: Task[]
  crews: Crew[]
  alertsCount: number
  crewAvailabilityContext: CrewAvailabilityContext
}): DashboardExecutiveKpi[] {
  const { projects, tasks, crews, alertsCount, crewAvailabilityContext } = input
  const assignableCrews = crews.filter((crew) => !isCrewManuallyInactive(crew))
  const availability = getCrewAvailabilitySummary(
    assignableCrews,
    crewAvailabilityContext
  )
  const availableToday = availability.operational + availability.reducedCapacity
  const activeProjects = countProjectsByStatus(projects, "active")
  const pendingAttention = tasks.filter((task) =>
    ACTIVE_TASK_STATUSES.includes(task.status)
  ).length

  return [
    {
      id: "active-projects",
      label: "Obras Activas",
      value: String(activeProjects),
      hint: "Obras en ejecución",
      href: "/obras?status=active",
    },
    {
      id: "pending-tasks",
      label: "Tareas Pendientes",
      value: String(pendingAttention),
      hint: "Requieren atención",
      href: "/tareas",
    },
    {
      id: "operational-crews",
      label: "Cuadrillas Operativas",
      value: `${availableToday} / ${assignableCrews.length}`,
      hint: "Disponibles hoy",
      href: "/cuadrillas",
    },
    {
      id: "operational-alerts",
      label: "Alertas Operativas",
      value: String(alertsCount),
      hint: "Incidentes abiertos",
      href: "/operations/calendar",
    },
  ]
}

export function buildOperationalAlerts(input: {
  projects: Project[]
  tasks: Task[]
  crews: Crew[]
  crewAvailabilityContext: CrewAvailabilityContext
  referenceDate?: string
}): DashboardOperationalAlert[] {
  const today = input.referenceDate ?? toDateOnly()
  const alerts: DashboardOperationalAlert[] = []

  const overdueTasks = input.tasks.filter((task) => isTaskOverdue(task, today))
  if (overdueTasks.length > 0) {
    alerts.push({
      id: "overdue-tasks",
      severity: "critical",
      message: `${overdueTasks.length} tarea${overdueTasks.length === 1 ? "" : "s"} vencida${overdueTasks.length === 1 ? "" : "s"}`,
      href: "/tareas",
    })
  }

  const metrics = buildProjectOperationalMetricsMap(
    input.projects,
    input.tasks,
    new Date(`${today}T12:00:00`)
  )
  const overdueProjects = [...metrics.values()].filter(
    (item) => item.health === "overdue"
  ).length

  if (overdueProjects > 0) {
    alerts.push({
      id: "overdue-projects",
      severity: "critical",
      message: `${overdueProjects} obra${overdueProjects === 1 ? "" : "s"} fuera de plazo`,
      href: "/obras",
    })
  }

  const assignableCrews = input.crews.filter((crew) => !isCrewManuallyInactive(crew))
  const reducedCrews = assignableCrews.filter((crew) => {
    const availability = getCrewAvailabilitySummary([crew], {
      ...input.crewAvailabilityContext,
      referenceDate: today,
    })
    return availability.reducedCapacity > 0
  })

  if (reducedCrews.length > 0) {
    alerts.push({
      id: "reduced-crews",
      severity: "warning",
      message: `${reducedCrews.length} cuadrilla${reducedCrews.length === 1 ? "" : "s"} con capacidad reducida`,
      href: "/operations/calendar",
    })
  }

  const riskProjects = [...metrics.values()].filter(
    (item) => item.health === "risk"
  ).length

  if (riskProjects > 0) {
    alerts.push({
      id: "risk-projects",
      severity: "warning",
      message: `${riskProjects} obra${riskProjects === 1 ? "" : "s"} en riesgo`,
      href: "/obras",
    })
  }

  const pendingApproval = input.tasks.filter(
    (task) => task.status === "en-aprobacion"
  ).length

  if (pendingApproval > 0) {
    alerts.push({
      id: "pending-approval",
      severity: "warning",
      message: `${pendingApproval} tarea${pendingApproval === 1 ? "" : "s"} en aprobación`,
      href: "/tareas?status=en-aprobacion",
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "success",
      message: "Sin novedades operativas",
    })
  }

  return alerts
}

export function countOperationalIncidents(
  alerts: DashboardOperationalAlert[]
): number {
  return alerts.filter((alert) => alert.severity !== "success").length
}

export function buildDayOperations(input: {
  tasks: Task[]
  evidence: EvidenceRecord[]
  referenceDate?: string
}): DashboardDayOperationMetric[] {
  const today = input.referenceDate ?? toDateOnly()

  const scheduledToday = input.tasks.filter((task) =>
    isTaskScheduledForToday(task, today)
  ).length

  const completedToday = input.tasks.filter((task) =>
    isTaskCompletedToday(task, today)
  ).length

  const pendingEvidence = input.evidence.filter(
    (item) => isActiveEvidence(item) && item.status === "pending-review"
  ).length

  return [
    {
      id: "scheduled-today",
      label: "Tareas programadas hoy",
      value: scheduledToday,
      hint: "Con fecha operativa hoy",
    },
    {
      id: "completed-today",
      label: "Tareas finalizadas hoy",
      value: completedToday,
      hint: "Cierre operativo del día",
    },
    {
      id: "pending-evidence",
      label: "Evidencias pendientes",
      value: pendingEvidence,
      hint: "Requieren revisión",
    },
  ]
}

export function buildProjectsStatusKpis(projects: Project[]): DashboardStatusKpi[] {
  return [
    {
      id: "active",
      label: "Activas",
      value: countProjectsByStatus(projects, "active"),
      href: "/obras?status=active",
    },
    {
      id: "planned",
      label: "Planificadas",
      value: countProjectsByStatus(projects, "planned"),
      href: "/obras?status=planned",
    },
    {
      id: "pending-closure",
      label: "Pendientes de Cierre",
      value: countProjectsByStatus(projects, "pending-closure"),
      href: "/obras?status=pending-closure",
    },
    {
      id: "closed",
      label: "Finalizadas",
      value: countProjectsByStatus(projects, "closed"),
      href: "/obras?status=closed",
    },
  ]
}

export function buildTasksStatusKpis(tasks: Task[]): DashboardStatusKpi[] {
  const summary = getTasksSummary(tasks)

  const entries: { id: string; label: string; key: keyof typeof summary; href: string }[] =
    [
      { id: "pendiente", label: "Pendientes", key: "pendiente", href: "/tareas?status=pendiente" },
      { id: "asignada", label: "Asignadas", key: "asignada", href: "/tareas?status=asignada" },
      { id: "en-curso", label: "En Curso", key: "enCurso", href: "/tareas?status=en-curso" },
      {
        id: "en-aprobacion",
        label: "En Aprobación",
        key: "enAprobacion",
        href: "/tareas?status=en-aprobacion",
      },
      {
        id: "finalizada",
        label: "Finalizadas",
        key: "finalizada",
        href: "/tareas?status=finalizada",
      },
      { id: "cerrada", label: "Cerradas", key: "cerrada", href: "/tareas?status=cerrada" },
    ]

  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    value: summary[entry.key],
    href: entry.href,
  }))
}

export function buildCrewsStatusKpis(input: {
  crews: Crew[]
  tasks: Task[]
  crewAvailabilityContext: CrewAvailabilityContext
}): DashboardStatusKpi[] {
  const assignableCrews = input.crews.filter((crew) => !isCrewManuallyInactive(crew))
  const availability = getCrewAvailabilitySummary(
    assignableCrews,
    input.crewAvailabilityContext
  )

  let activeCrews = 0
  let fieldCrews = 0

  for (const crew of assignableCrews) {
    const status = resolveCrewStatus(crew, input.tasks)
    if (status === "activa" && !crewHasFieldTasks(crew, input.tasks)) {
      activeCrews += 1
    }
    if (status === "en-campo" || crewHasFieldTasks(crew, input.tasks)) {
      fieldCrews += 1
    }
  }

  const notOperational =
    input.crews.filter((crew) => isCrewManuallyInactive(crew)).length +
    availability.notOperational

  return [
    {
      id: "active",
      label: "Cuadrillas Activas",
      value: activeCrews,
      href: "/cuadrillas",
    },
    {
      id: "field",
      label: "Cuadrillas en Campo",
      value: fieldCrews,
      href: "/cuadrillas",
    },
    {
      id: "reduced",
      label: "Capacidad Reducida",
      value: availability.reducedCapacity,
      href: "/operations/calendar",
    },
    {
      id: "not-operational",
      label: "No Operativas",
      value: notOperational,
      href: "/cuadrillas",
    },
  ]
}

export function buildRecentOperationalActivity(input: {
  projects: Project[]
  tasks: Task[]
  evidence: EvidenceRecord[]
  crews: Crew[]
  crewAvailabilityContext: CrewAvailabilityContext
  limit?: number
}): DashboardActivityItem[] {
  const events: DashboardActivityEvent[] = []
  const today = toDateOnly()

  input.tasks
    .filter((task) => FINAL_TASK_STATUSES.includes(task.status))
    .forEach((task) => {
      const timestamp = task.createdAt ?? `${task.dueDate}T18:00:00`
      events.push({
        id: `task-final-${task.id}`,
        message: `Tarea ${task.code} finalizada`,
        tone: "success",
        href: `/tareas/${task.id}`,
        sortAt: new Date(timestamp).getTime(),
      })
    })

  input.evidence.filter(isActiveEvidence).forEach((record) => {
    events.push({
      id: `evidence-upload-${record.id}`,
      message: `Evidencia cargada — ${record.fileName}`,
      tone: "neutral",
      href: `/evidencias/${record.id}`,
      sortAt: new Date(record.uploadedAt).getTime(),
    })

    record.uploadHistory.forEach((event) => {
      const approved = event.action.toLowerCase().includes("aprobada")
      const rejected = event.action.toLowerCase().includes("rechazada")

      if (!approved && !rejected) return

      events.push({
        id: `evidence-review-${record.id}-${event.id}`,
        message: approved
          ? "Evidencia aprobada"
          : "Evidencia rechazada",
        tone: approved ? "success" : "warning",
        href: `/evidencias/${record.id}`,
        sortAt: new Date(event.timestamp).getTime(),
      })
    })
  })

  input.projects.forEach((project) => {
    const timestamp =
      project.createdAt ??
      (project.startDate ? `${project.startDate}T08:00:00` : new Date().toISOString())

    if (project.status === "active") {
      events.push({
        id: `project-active-${project.id}`,
        message: `Obra ${project.code} iniciada`,
        tone: "success",
        href: `/obras/${project.id}`,
        sortAt: new Date(timestamp).getTime(),
      })
    }
  })

  const assignableCrews = input.crews.filter((crew) => !isCrewManuallyInactive(crew))
  assignableCrews.forEach((crew) => {
    const summary = getCrewAvailabilitySummary([crew], {
      ...input.crewAvailabilityContext,
      referenceDate: today,
    })

    if (summary.reducedCapacity > 0) {
      events.push({
        id: `crew-reduced-${crew.id}`,
        message: `${crew.name} con baja de personal`,
        tone: "warning",
        href: "/cuadrillas",
        sortAt: Date.now(),
      })
    }
  })

  return events
    .sort((left, right) => right.sortAt - left.sortAt)
    .slice(0, input.limit ?? 10)
    .map(({ sortAt: _sortAt, ...item }) => item)
}

export function getActivityTonePrefix(tone: DashboardActivityTone): string {
  switch (tone) {
    case "success":
      return "✓"
    case "warning":
      return "⚠"
    case "neutral":
      return "·"
  }
}
