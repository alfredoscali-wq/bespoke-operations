import { getCrewsSummary, mockCrews } from "@/lib/data/crews"
import { getEvidenceSummary, mockEvidence } from "@/lib/data/evidence"
import { mockProjects } from "@/lib/data/projects"
import { getTasksSummary, mockTasks } from "@/lib/data/tasks"
import { getCrewIdByName } from "@/lib/crews/constants"
import { TASK_STATUS_LABELS, formatTaskDate } from "@/lib/tasks/constants"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type { Project, ProjectType } from "@/lib/types/projects"
import type { Task, TaskStatus, TaskType } from "@/lib/types/tasks"

export type KpiMetric = {
  id: string
  label: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  description: string
  href: string
}

export type ActivityItem = {
  id: string
  title: string
  description: string
  project: string
  crew: string
  timestamp: string
  type: "fiber" | "camera" | "wireless" | "pole" | "general"
  href: string
}

export type UpcomingTask = {
  id: string
  title: string
  project: string
  crew: string
  dueDate: string
  priority: "alta" | "media" | "baja"
  status: TaskStatus
}

export type OperationsSegment = {
  label: string
  value: number
  color: string
}

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
]

const TYPE_LABELS: Record<ProjectType, string> = {
  fiber: "Fibra óptica",
  camera: "Cámaras",
  wireless: "Wireless",
  pole: "Postes",
  maintenance: "Mantenimiento",
}

const TYPE_COLORS: Record<ProjectType, string> = {
  fiber: "bg-blue-500",
  camera: "bg-violet-500",
  wireless: "bg-amber-500",
  pole: "bg-stone-500",
  maintenance: "bg-teal-500",
}

function formatRelativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60000))

  if (minutes < 60) {
    return `Hace ${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `Hace ${hours} h`
  }

  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

function mapTaskTypeToActivityType(type: TaskType): ActivityItem["type"] {
  if (type === "inspection" || type === "maintenance") return "general"
  return type
}

function mapEvidenceToActivityType(
  record: EvidenceRecord
): ActivityItem["type"] {
  if (record.category.toLowerCase().includes("poste")) return "pole"
  if (record.type === "photo" && record.evidenceType === "otdr-certification") {
    return "fiber"
  }

  const project = mockProjects.find((item) => item.id === record.projectId)
  if (!project) return "general"
  if (project.type === "maintenance") return "general"
  return project.type
}

export function buildKpiMetrics(
  projects = mockProjects,
  tasks = mockTasks,
  crews = mockCrews
): KpiMetric[] {
  const activeProjects = projects.filter(
    (project) => project.status === "active"
  ).length
  const taskSummary = getTasksSummary(tasks)
  const pendingTasks = tasks.filter((task) =>
    ACTIVE_TASK_STATUSES.includes(task.status)
  ).length
  const crewSummary = getCrewsSummary(crews, tasks, projects)
  const activeProjectList = projects.filter(
    (project) => project.status === "active" || project.status === "pending-closure"
  )
  const overallProgress =
    activeProjectList.length === 0
      ? 0
      : Math.round(
          activeProjectList.reduce((sum, project) => sum + project.progress, 0) /
            activeProjectList.length
        )

  return [
    {
      id: "active-projects",
      label: "Obras Activas",
      value: String(activeProjects),
      change: `${projects.length} obras registradas`,
      trend: "neutral",
      description: "Despliegues de fibra, cámaras y wireless",
      href: "/obras",
    },
    {
      id: "pending-tasks",
      label: "Tareas Pendientes",
      value: String(pendingTasks),
      change: `${taskSummary.total} tareas en sistema`,
      trend: "neutral",
      description: "Actividades sin completar en campo",
      href: "/tareas",
    },
    {
      id: "active-crews",
      label: "Cuadrillas Activas",
      value: String(crewSummary.activeCrews),
      change: `${crewSummary.totalCrews} cuadrillas registradas`,
      trend: "neutral",
      description: "Equipos operando hoy",
      href: "/cuadrillas",
    },
    {
      id: "overall-progress",
      label: "Avance General",
      value: `${overallProgress}%`,
      change: `${getEvidenceSummary(mockEvidence).total} evidencias cargadas`,
      trend: overallProgress >= 70 ? "up" : "neutral",
      description: "Promedio de avance en obras activas",
      href: "/obras",
    },
  ]
}

export function buildRecentActivity(
  tasks = mockTasks,
  evidence = mockEvidence
): ActivityItem[] {
  const events: Array<ActivityItem & { sortAt: number }> = []

  evidence.forEach((record) => {
    events.push({
      id: `act-ev-${record.id}`,
      title: "Evidencia cargada",
      description: `${record.fileName} — ${record.description}`,
      project: record.projectName,
      crew: record.crew,
      timestamp: formatRelativeTime(record.uploadedAt),
      type: mapEvidenceToActivityType(record),
      href: `/evidencias/${record.id}`,
      sortAt: new Date(record.uploadedAt).getTime(),
    })
  })

  tasks
    .filter(
      (task) => task.status === "finalizada" || task.status === "cerrada"
    )
    .forEach((task) => {
      events.push({
        id: `act-task-${task.id}`,
        title: "Tarea completada",
        description: `${task.code} — ${task.title}`,
        project: task.projectName,
        crew: task.crew,
        timestamp: formatRelativeTime(`${task.dueDate}T17:00:00`),
        type: mapTaskTypeToActivityType(task.type),
        href: `/tareas/${task.id}`,
        sortAt: new Date(`${task.dueDate}T17:00:00`).getTime(),
      })
    })

  tasks
    .filter((task) => task.status === "en-curso")
    .forEach((task) => {
      const crewId = getCrewIdByName(task.crew)
      events.push({
        id: `act-crew-${task.id}`,
        title: "Trabajo iniciado",
        description: `${task.crew} reportó inicio en ${task.code}.`,
        project: task.projectName,
        crew: task.crew,
        timestamp: formatRelativeTime(`${task.startDate}T09:30:00`),
        type: mapTaskTypeToActivityType(task.type),
        href: crewId ? `/cuadrillas/${crewId}` : `/tareas/${task.id}`,
        sortAt: new Date(`${task.startDate}T09:30:00`).getTime(),
      })
    })

  return events
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 6)
    .map(({ sortAt: _sortAt, ...event }) => event)
}

export function buildUpcomingTasks(tasks = mockTasks): UpcomingTask[] {
  return tasks
    .filter((task) => ACTIVE_TASK_STATUSES.includes(task.status))
    .sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      project: task.projectName,
      crew: task.crew,
      dueDate: formatTaskDate(task.dueDate),
      priority: task.priority,
      status: task.status,
    }))
}

export function buildOperationsSegments(
  projects = mockProjects
): OperationsSegment[] {
  const activeProjects = projects.filter(
    (project) =>
      project.status === "active" || project.status === "pending-closure"
  )

  const grouped = new Map<ProjectType, number[]>()

  activeProjects.forEach((project) => {
    const values = grouped.get(project.type) ?? []
    values.push(project.progress)
    grouped.set(project.type, values)
  })

  return (Object.keys(TYPE_LABELS) as ProjectType[])
    .filter((type) => grouped.has(type))
    .map((type) => {
      const values = grouped.get(type) ?? []
      const average = Math.round(
        values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
      )

      return {
        label: TYPE_LABELS[type],
        value: average,
        color: TYPE_COLORS[type],
      }
    })
}

export function getUpcomingTaskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status]
}

/** @deprecated Use buildKpiMetrics() */
export const kpiMetrics = buildKpiMetrics()

/** @deprecated Use buildRecentActivity() */
export const recentActivity = buildRecentActivity()

/** @deprecated Use buildUpcomingTasks() */
export const upcomingTasks = buildUpcomingTasks()
