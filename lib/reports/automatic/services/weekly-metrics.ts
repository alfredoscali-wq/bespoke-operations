import { compareDateOnly } from "@/lib/dates/date-only"
import { isDateWithinReportRange } from "@/lib/reports/report-filters"
import { isTaskCompletedInReportRange } from "@/lib/reports/completed-tasks"
import {
  calculateComplianceRate,
  extractDatePortion,
  type ReportPeriodRange,
} from "@/lib/reports/report-utils"
import { isActiveTaskStatus } from "@/lib/tasks/status-groups"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import type {
  WeeklyCrewPerformanceRow,
  WeeklyExecutiveSummary,
  WeeklyProductionCounts,
  WeeklyReportAlerts,
} from "@/lib/reports/automatic/types"

const PRODUCTION_SERVICE_TYPES = {
  instalacionNueva: "instalacion-nueva",
  cambioDomicilio: "cambio-domicilio",
  cambioTecnologia: "cambio-tecnologia",
  serviceTecnico: "service-tecnico",
  reconexion: "reconexion",
  baja: "baja",
} as const

function isDateInRange(
  value: string | null | undefined,
  range: ReportPeriodRange
): boolean {
  return isDateWithinReportRange(value, range)
}

function isTaskCreatedInRange(task: Task, range: ReportPeriodRange): boolean {
  return isDateInRange(task.createdAt, range)
}

function isTaskDueInRange(task: Task, range: ReportPeriodRange): boolean {
  return isDateInRange(task.dueDate, range)
}

function resolveResolutionHours(task: Task): number | null {
  const created = task.createdAt ? new Date(task.createdAt).getTime() : NaN
  const completed = task.completedAt ? new Date(task.completedAt).getTime() : NaN

  if (!Number.isFinite(created) || !Number.isFinite(completed) || completed < created) {
    return null
  }

  return Math.round(((completed - created) / 3_600_000) * 10) / 10
}

function averageHours(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round((total / values.length) * 10) / 10
}

export function buildWeeklyExecutiveSummary(input: {
  activeCustomers: number
  inactiveCustomers: number
  activeProjects: number
  tasks: Task[]
  range: ReportPeriodRange
}): WeeklyExecutiveSummary {
  const { tasks, range } = input

  const tasksCreated = tasks.filter((task) => isTaskCreatedInRange(task, range)).length
  const tasksCompleted = tasks.filter((task) =>
    isTaskCompletedInReportRange(task, range)
  ).length
  const tasksDueInWeek = tasks.filter((task) => isTaskDueInRange(task, range))
  const tasksDueInWeekCount = tasksDueInWeek.length
  const weeklyCompliancePercent = calculateComplianceRate(
    tasksCompleted,
    tasksDueInWeekCount
  )

  const tasksPending = tasks.filter((task) => isActiveTaskStatus(task.status)).length
  const tasksOverdue = tasks.filter((task) => isTaskVencida(task)).length

  const resolutionHours = tasks
    .filter((task) => isTaskCompletedInReportRange(task, range))
    .map(resolveResolutionHours)
    .filter((value): value is number => value !== null)

  return {
    activeCustomers: input.activeCustomers,
    inactiveCustomers: input.inactiveCustomers,
    activeProjects: input.activeProjects,
    tasksCreated,
    tasksCompleted,
    tasksDueInWeek: tasksDueInWeekCount,
    tasksPending,
    tasksOverdue,
    weeklyCompliancePercent,
    averageResolutionHours: averageHours(resolutionHours),
  }
}

export function buildWeeklyCrewPerformance(input: {
  tasks: Task[]
  crews: Crew[]
  range: ReportPeriodRange
}): WeeklyCrewPerformanceRow[] {
  const groups = new Map<string, Task[]>()

  for (const task of input.tasks) {
    const crewId = resolveTaskCrewId(task, input.crews) ?? "__unassigned__"
    const bucket = groups.get(crewId) ?? []
    bucket.push(task)
    groups.set(crewId, bucket)
  }

  return Array.from(groups.entries())
    .map(([crewId, crewTasks]) => {
      const crew = input.crews.find((item) => item.id === crewId)
      const crewName =
        crew?.name?.trim() ||
        crewTasks[0]?.crew?.trim() ||
        (crewId === "__unassigned__" ? "Sin cuadrilla" : "Cuadrilla")

      const assigned = crewTasks.filter((task) => isTaskDueInRange(task, input.range))
        .length
      const completed = crewTasks.filter((task) =>
        isTaskCompletedInReportRange(task, input.range)
      ).length
      const pending = crewTasks.filter((task) => isActiveTaskStatus(task.status))
        .length
      const overdue = crewTasks.filter((task) => isTaskVencida(task)).length
      const resolutionHours = crewTasks
        .filter((task) => isTaskCompletedInReportRange(task, input.range))
        .map(resolveResolutionHours)
        .filter((value): value is number => value !== null)

      return {
        crewId,
        crewName,
        supervisor: crew?.supervisor?.trim() || "—",
        assigned,
        completed,
        pending,
        overdue,
        compliancePercent: calculateComplianceRate(completed, assigned),
        averageResolutionHours: averageHours(resolutionHours),
      }
    })
    .sort((left, right) => right.compliancePercent - left.compliancePercent)
}

export function buildWeeklyProductionCounts(
  tasks: Task[],
  range: ReportPeriodRange
): WeeklyProductionCounts {
  const completedInWeek = tasks.filter((task) =>
    isTaskCompletedInReportRange(task, range)
  )

  function count(serviceType: string): number {
    return completedInWeek.filter((task) => task.serviceType === serviceType).length
  }

  return {
    instalacionNueva: count(PRODUCTION_SERVICE_TYPES.instalacionNueva),
    cambioDomicilio: count(PRODUCTION_SERVICE_TYPES.cambioDomicilio),
    cambioTecnologia: count(PRODUCTION_SERVICE_TYPES.cambioTecnologia),
    serviceTecnico: count(PRODUCTION_SERVICE_TYPES.serviceTecnico),
    reconexion: count(PRODUCTION_SERVICE_TYPES.reconexion),
    baja: count(PRODUCTION_SERVICE_TYPES.baja),
  }
}

export function buildWeeklyReportAlerts(input: {
  tasks: Task[]
  projects: Project[]
  absentOperarioIds: Set<string>
}): WeeklyReportAlerts {
  return {
    overdueTasks: input.tasks.filter((task) => isTaskVencida(task)).length,
    pendingApprovalTasks: input.tasks.filter(
      (task) => task.status === "pendiente-cierre" || task.status === "en-aprobacion"
    ).length,
    openIncidents: input.tasks.filter((task) => task.status === "incidencia").length,
    absentOperarios: input.absentOperarioIds.size,
    stoppedProjects: input.projects.filter((project) => project.status === "paused")
      .length,
  }
}

export function collectAbsentOperarioIdsForWeek(input: {
  crews: Crew[]
  range: ReportPeriodRange
  isAbsentOnDate: (date: string) => Set<string>
}): Set<string> {
  const absent = new Set<string>()
  const start = extractDatePortion(input.range.startDate)
  const end = extractDatePortion(input.range.endDate)

  if (!start || !end) {
    return absent
  }

  let cursor = start
  while (compareDateOnly(cursor, end) <= 0) {
    for (const employeeId of input.isAbsentOnDate(cursor)) {
      absent.add(employeeId)
    }

    const next = new Date(`${cursor}T12:00:00`)
    next.setDate(next.getDate() + 1)
    cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
  }

  return absent
}
