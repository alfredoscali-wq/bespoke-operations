import {
  buildProjectOperationalMetricsMap,
} from "@/lib/projects/project-operational-metrics"
import {
  buildProjectsOperationalSummary,
  projectOperationalMetricsMapToRecord,
} from "@/lib/projects/project-operational-summary"
import {
  getCrewProductivity,
  type CrewProductivityRow,
} from "@/lib/reports/crew-productivity"
import {
  getLocalityReport,
  type LocalityReportRow,
} from "@/lib/reports/locality-reports"
import { getOperationalReportSummary } from "@/lib/reports/operational-reports"
import { getOldestPendingTasks } from "@/lib/reports/pending-reports"
import type { ReportFilters } from "@/lib/reports/report-filters"
import {
  getServiceTypeReport,
  type ServiceTypeReportRow,
} from "@/lib/reports/service-type-reports"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"

export type ReportTypeRow = ServiceTypeReportRow

export type ReportLocalityRow = LocalityReportRow

export interface ManagementReportSummary {
  scheduledOrders: number
  completedOrders: number
  completionRate: number
  activeProjects: number
  overdueProjects: number
  riskProjects: number
}

export interface ManagementReport {
  summary: ManagementReportSummary
  crews: CrewProductivityRow[]
  ordersByType: ReportTypeRow[]
  localities: ReportLocalityRow[]
  oldestPendingOrders: Task[]
}

type BuildManagementReportInput = {
  tasks: Task[]
  projects: Project[]
  filters: ReportFilters
  crews?: Pick<{ id: string; name: string }, "id" | "name">[]
  referenceDate?: Date
}

function resolveOldestPendingOrders(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[],
  referenceDate: Date
): Task[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))

  return getOldestPendingTasks(tasks, filters, crews, referenceDate)
    .map((row) => tasksById.get(row.taskId))
    .filter((task): task is Task => Boolean(task))
}

export function buildManagementReport({
  tasks,
  projects,
  filters,
  crews = [],
  referenceDate = new Date(),
}: BuildManagementReportInput): ManagementReport {
  const operationalSummary = getOperationalReportSummary(tasks, filters, crews)
  const projectMetrics = buildProjectOperationalMetricsMap(
    projects,
    tasks,
    referenceDate
  )
  const projectsSummary = buildProjectsOperationalSummary(
    projectOperationalMetricsMapToRecord(projectMetrics)
  )

  return {
    summary: {
      scheduledOrders: operationalSummary.programmed,
      completedOrders: operationalSummary.completed,
      completionRate: operationalSummary.compliance,
      activeProjects: projects.filter((project) => project.status === "active")
        .length,
      overdueProjects: projectsSummary.overdueProjects,
      riskProjects: projectsSummary.riskProjects,
    },
    crews: getCrewProductivity(tasks, filters, crews),
    ordersByType: getServiceTypeReport(tasks, filters, crews),
    localities: getLocalityReport(tasks, filters, crews),
    oldestPendingOrders: resolveOldestPendingOrders(
      tasks,
      filters,
      crews,
      referenceDate
    ),
  }
}
