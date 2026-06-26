import { isTaskCompletedInReportRange } from "@/lib/reports/completed-tasks"
import {
  applyReportFilters,
  isDateWithinReportRange,
  type ReportFilters,
} from "@/lib/reports/report-filters"
import {
  calculateComplianceRate,
  resolveReportPeriodRange,
  type ReportPeriodRange,
} from "@/lib/reports/report-utils"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

export type CrewProductivityRow = {
  crewId: string
  crewName: string
  programmed: number
  completed: number
  cancelled: number
  compliance: number
}

const UNASSIGNED_CREW_ID = "__unassigned__"

function resolveCrewName(
  task: Task,
  crewId: string,
  crews: Pick<{ id: string; name: string }, "id" | "name">[]
): string {
  if (crewId === UNASSIGNED_CREW_ID) {
    return "Sin cuadrilla"
  }

  return (
    crews.find((crew) => crew.id === crewId)?.name ??
    task.crew?.trim() ??
    "Sin cuadrilla"
  )
}

function countCrewMetrics(
  tasks: Task[],
  range: ReportPeriodRange
): Pick<
  CrewProductivityRow,
  "programmed" | "completed" | "cancelled" | "compliance"
> {
  const programmed = tasks.filter((task) =>
    isDateWithinReportRange(task.dueDate, range)
  ).length

  const completed = tasks.filter((task) =>
    isTaskCompletedInReportRange(task, range)
  ).length

  const cancelled = tasks.filter(
    (task) =>
      task.status === "cancelada" &&
      isDateWithinReportRange(task.dueDate, range)
  ).length

  return {
    programmed,
    completed,
    cancelled,
    compliance: calculateComplianceRate(completed, programmed),
  }
}

export function getCrewProductivity(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): CrewProductivityRow[] {
  const filteredTasks = applyReportFilters(tasks, filters, crews)
  const range = resolveReportPeriodRange(filters)
  const groups = new Map<string, { crewName: string; tasks: Task[] }>()

  for (const task of filteredTasks) {
    const crewId = resolveTaskCrewId(task, crews) ?? UNASSIGNED_CREW_ID
    const existing = groups.get(crewId)

    if (existing) {
      existing.tasks.push(task)
      continue
    }

    groups.set(crewId, {
      crewName: resolveCrewName(task, crewId, crews),
      tasks: [task],
    })
  }

  return Array.from(groups.entries())
    .map(([crewId, group]) => ({
      crewId,
      crewName: group.crewName,
      ...countCrewMetrics(group.tasks, range),
    }))
    .sort((left, right) => right.compliance - left.compliance)
}

export function getCrewRanking(
  tasks: Task[],
  filters: ReportFilters,
  crews: Pick<{ id: string; name: string }, "id" | "name">[] = []
): CrewProductivityRow[] {
  return getCrewProductivity(tasks, filters, crews)
    .filter((row) => row.crewId !== UNASSIGNED_CREW_ID)
    .sort((left, right) => {
      if (right.compliance !== left.compliance) {
        return right.compliance - left.compliance
      }

      return right.completed - left.completed
    })
    .slice(0, 3)
}
