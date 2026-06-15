import type { Crew } from "@/lib/types/crews"
import type { EvidenceRecord } from "@/lib/types/evidence"
import { isActiveEvidence } from "@/lib/evidence/utils"
import type { Project, ProjectType } from "@/lib/types/projects"
import type { Task, TaskStatus, TaskType } from "@/lib/types/tasks"
import { TASK_STATUS_LABELS, formatTaskDate } from "@/lib/tasks/constants"

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

const UPCOMING_TASK_STATUSES: TaskStatus[] = [
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

export function formatRelativeTime(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime()
  if (Number.isNaN(diffMs)) return "Reciente"

  const minutes = Math.max(1, Math.floor(Math.abs(diffMs) / 60000))

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

function mapProjectTypeToActivity(type: ProjectType): ActivityItem["type"] {
  if (type === "maintenance") return "general"
  return type
}

function mapTaskTypeToActivityType(type: TaskType): ActivityItem["type"] {
  if (type === "inspection" || type === "maintenance") return "general"
  return type
}

function mapEvidenceToActivityType(
  record: EvidenceRecord,
  projects: Project[]
): ActivityItem["type"] {
  if (record.category.toLowerCase().includes("poste")) return "pole"
  if (record.type === "photo" && record.evidenceType === "otdr-certification") {
    return "fiber"
  }

  const project = projects.find(
    (item) =>
      item.id === record.projectId || item.code === record.projectCode
  )
  if (!project) return "general"
  return mapProjectTypeToActivity(project.type)
}

function countTasksByStatuses(tasks: Task[], statuses: TaskStatus[]): number {
  return tasks.filter((task) => statuses.includes(task.status)).length
}

export function buildKpiMetrics(
  projects: Project[],
  tasks: Task[],
  evidence: EvidenceRecord[],
  crews: Crew[]
): KpiMetric[] {
  const activeProjects = projects.filter(
    (project) => project.status === "active"
  ).length
  const plannedProjects = projects.filter(
    (project) => project.status === "planned"
  ).length
  const pendingClosureProjects = projects.filter(
    (project) => project.status === "pending-closure"
  ).length
  const closedProjects = projects.filter(
    (project) => project.status === "closed"
  ).length

  const pendingTasks = countTasksByStatuses(tasks, ["pendiente"])
  const assignedTasks = countTasksByStatuses(tasks, ["asignada"])
  const inProgressTasks = countTasksByStatuses(tasks, ["en-curso"])
  const approvalTasks = countTasksByStatuses(tasks, ["en-aprobacion"])
  const completedTasks = countTasksByStatuses(tasks, ["finalizada"])
  const closedTasks = countTasksByStatuses(tasks, ["cerrada"])

  const pendingEvidence = evidence.filter(
    (item) => isActiveEvidence(item) && item.status === "pending-review"
  ).length
  const approvedEvidence = evidence.filter(
    (item) => isActiveEvidence(item) && item.status === "approved"
  ).length
  const rejectedEvidence = evidence.filter(
    (item) => isActiveEvidence(item) && item.status === "rejected"
  ).length

  const activeCrews = crews.filter((crew) => crew.status === "activa").length
  const fieldCrews = crews.filter((crew) => crew.status === "en-campo").length

  return [
    {
      id: "projects-active",
      label: "Obras Activas",
      value: String(activeProjects),
      change: `${projects.length} obras registradas`,
      trend: "neutral",
      description: "Obras en ejecución",
      href: "/obras?status=active",
    },
    {
      id: "projects-closed",
      label: "Obras Finalizadas",
      value: String(closedProjects),
      change: `${closedProjects} cerradas`,
      trend: "neutral",
      description: "Obras completadas en el sistema",
      href: "/obras?status=closed",
    },
    {
      id: "projects-planned",
      label: "Obras Planificadas",
      value: String(plannedProjects),
      change: `${plannedProjects} planificadas`,
      trend: "neutral",
      description: "Obras registradas sin iniciar",
      href: "/obras?status=planned",
    },
    {
      id: "projects-pending-closure",
      label: "Pendientes de Cierre",
      value: String(pendingClosureProjects),
      change: `${pendingClosureProjects} en cierre`,
      trend: pendingClosureProjects > 0 ? "up" : "neutral",
      description: "Obras solicitadas para cierre",
      href: "/obras?status=pending-closure",
    },
    {
      id: "tasks-pending",
      label: "Tareas Pendientes",
      value: String(pendingTasks),
      change: `${tasks.length} tareas totales`,
      trend: "neutral",
      description: "Sin cuadrilla asignada o sin iniciar",
      href: "/tareas?status=pendiente",
    },
    {
      id: "tasks-assigned",
      label: "Tareas Asignadas",
      value: String(assignedTasks),
      change: `${assignedTasks} asignadas`,
      trend: "neutral",
      description: "Con cuadrilla, pendientes de inicio",
      href: "/tareas?status=asignada",
    },
    {
      id: "tasks-in-progress",
      label: "Tareas en Curso",
      value: String(inProgressTasks),
      change: `${inProgressTasks} en ejecución`,
      trend: "neutral",
      description: "Trabajo activo en campo",
      href: "/tareas?status=en-curso",
    },
    {
      id: "tasks-approval",
      label: "En Aprobación",
      value: String(approvalTasks),
      change: `${approvalTasks} por revisar`,
      trend: approvalTasks > 0 ? "up" : "neutral",
      description: "Finalizadas por operario, pendientes de supervisor",
      href: "/tareas?status=en-aprobacion",
    },
    {
      id: "tasks-completed",
      label: "Tareas Finalizadas",
      value: String(completedTasks),
      change: `${completedTasks} finalizadas`,
      trend: "neutral",
      description: "Aprobadas por supervisión",
      href: "/tareas?status=finalizada",
    },
    {
      id: "tasks-closed",
      label: "Tareas Cerradas",
      value: String(closedTasks),
      change: `${closedTasks} cerradas`,
      trend: "neutral",
      description: "Ciclo operativo completado",
      href: "/tareas?status=cerrada",
    },
    {
      id: "evidence-pending",
      label: "Evidencias Pendientes",
      value: String(pendingEvidence),
      change: `${evidence.length} evidencias totales`,
      trend: pendingEvidence > 0 ? "up" : "neutral",
      description: "Pendientes de revisión",
      href: "/evidencias",
    },
    {
      id: "evidence-approved",
      label: "Evidencias Aprobadas",
      value: String(approvedEvidence),
      change: `${approvedEvidence} validadas`,
      trend: "up",
      description: "Evidencias aprobadas por supervisión",
      href: "/evidencias",
    },
    {
      id: "evidence-rejected",
      label: "Evidencias Rechazadas",
      value: String(rejectedEvidence),
      change: `${rejectedEvidence} rechazadas`,
      trend: rejectedEvidence > 0 ? "down" : "neutral",
      description: "Evidencias devueltas a campo",
      href: "/evidencias",
    },
    {
      id: "crews-active",
      label: "Cuadrillas Activas",
      value: String(activeCrews),
      change: `${crews.length} cuadrillas registradas`,
      trend: "neutral",
      description: "Cuadrillas disponibles para asignación",
      href: "/cuadrillas",
    },
    {
      id: "crews-field",
      label: "Cuadrillas en Campo",
      value: String(fieldCrews),
      change: `${fieldCrews} operando`,
      trend: "neutral",
      description: "Cuadrillas reportadas en sitio",
      href: "/cuadrillas",
    },
  ]
}

export function buildRecentActivity(
  projects: Project[],
  tasks: Task[],
  evidence: EvidenceRecord[]
): ActivityItem[] {
  const events: Array<ActivityItem & { sortAt: number }> = []

  projects.forEach((project) => {
    const timestamp =
      project.createdAt ??
      (project.startDate ? `${project.startDate}T08:00:00` : new Date().toISOString())
    events.push({
      id: `act-project-${project.id}`,
      title: "Obra registrada",
      description: `${project.code} — ${project.name}`,
      project: project.name,
      crew: project.supervisor,
      timestamp: formatRelativeTime(timestamp),
      type: mapProjectTypeToActivity(project.type),
      href: `/obras/${project.id}`,
      sortAt: new Date(timestamp).getTime(),
    })
  })

  tasks.forEach((task) => {
    const timestamp = task.createdAt ?? `${task.startDate}T08:00:00`
    events.push({
      id: `act-task-created-${task.id}`,
      title: "Tarea creada",
      description: `${task.code} — ${task.title}`,
      project: task.projectName,
      crew: task.crew || "Sin cuadrilla",
      timestamp: formatRelativeTime(timestamp),
      type: mapTaskTypeToActivityType(task.type),
      href: `/tareas/${task.id}`,
      sortAt: new Date(timestamp).getTime(),
    })
  })

  evidence.filter(isActiveEvidence).forEach((record) => {
    events.push({
      id: `act-evidence-${record.id}`,
      title: "Evidencia cargada",
      description: `${record.fileName} — ${record.description || record.category}`,
      project: record.projectName,
      crew: record.crew || record.worker,
      timestamp: formatRelativeTime(record.uploadedAt),
      type: mapEvidenceToActivityType(record, projects),
      href: `/evidencias/${record.id}`,
      sortAt: new Date(record.uploadedAt).getTime(),
    })

    record.uploadHistory.forEach((event) => {
      const isReviewAction =
        event.action.toLowerCase().includes("aprobada") ||
        event.action.toLowerCase().includes("rechazada")

      if (!isReviewAction) return

      events.push({
        id: `act-evidence-history-${record.id}-${event.id}`,
        title: event.action,
        description: event.note ?? record.fileName,
        project: record.projectName,
        crew: record.crew || record.worker,
        timestamp: formatRelativeTime(event.timestamp),
        type: mapEvidenceToActivityType(record, projects),
        href: `/evidencias/${record.id}`,
        sortAt: new Date(event.timestamp).getTime(),
      })
    })
  })

  return events
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 8)
    .map(({ sortAt: _sortAt, ...event }) => event)
}

export function buildUpcomingTasks(tasks: Task[]): UpcomingTask[] {
  return tasks
    .filter((task) => UPCOMING_TASK_STATUSES.includes(task.status))
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    )
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      title: task.title,
      project: task.projectName,
      crew: task.crew || "Sin cuadrilla",
      dueDate: formatTaskDate(task.dueDate),
      priority: task.priority,
      status: task.status,
    }))
}

export function buildOperationsSegments(
  projects: Project[]
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
        values.reduce((sum, value) => sum + value, 0) /
          Math.max(values.length, 1)
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
