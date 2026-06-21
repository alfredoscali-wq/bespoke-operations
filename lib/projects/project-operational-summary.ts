import type { ProjectOperationalMetrics } from "@/lib/projects/project-operational-metrics"

export interface ProjectsOperationalSummary {
  averageProgress: number
  overdueProjects: number
  riskProjects: number
  pendingTasks: number
}

export function buildProjectsOperationalSummary(
  metricsByProjectId: Record<string, ProjectOperationalMetrics>
): ProjectsOperationalSummary {
  const metrics = Object.values(metricsByProjectId)

  if (metrics.length === 0) {
    return {
      averageProgress: 0,
      overdueProjects: 0,
      riskProjects: 0,
      pendingTasks: 0,
    }
  }

  const averageProgress = Math.round(
    metrics.reduce((sum, item) => sum + item.progress, 0) / metrics.length
  )

  const overdueProjects = metrics.filter(
    (item) => item.health === "overdue"
  ).length

  const riskProjects = metrics.filter((item) => item.health === "risk").length

  const pendingTasks = metrics.reduce(
    (sum, item) => sum + item.pendingTasks,
    0
  )

  return {
    averageProgress,
    overdueProjects,
    riskProjects,
    pendingTasks,
  }
}

export function projectOperationalMetricsMapToRecord(
  metricsByProjectId: Map<string, ProjectOperationalMetrics>
): Record<string, ProjectOperationalMetrics> {
  return Object.fromEntries(metricsByProjectId)
}
