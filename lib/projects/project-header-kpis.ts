import { getProjectOperationalStats } from "@/lib/projects/utils"
import { getTasksForProject } from "@/lib/tasks/utils"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"

export type ProjectHeaderKpis = {
  total: number
  active: number
  pendingClosure: number
  completed: number
}

/**
 * Header KPIs for an Obra detail. Call with the project-scoped live OT list
 * (company_id + project_id + deleted_at IS NULL), not fetchTasks().
 * Semantics match the current encabezado: pendiente-cierre counts in both
 * Activas and Pend. cierre; Finalizadas is finalizada + cancelada only.
 */
export function buildProjectHeaderKpis(
  project: Pick<Project, "id" | "code" | "progress">,
  tasks: Task[]
): ProjectHeaderKpis {
  const projectTasks = getTasksForProject(project as Project, tasks)
  const stats = getProjectOperationalStats(project, tasks, [], [])

  return {
    total: projectTasks.length,
    active: stats.activeTasks,
    pendingClosure: projectTasks.filter((task) =>
      isPendingClosureStatus(task.status)
    ).length,
    completed: stats.completedTasks,
  }
}
