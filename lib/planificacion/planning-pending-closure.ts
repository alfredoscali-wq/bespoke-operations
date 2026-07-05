import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { compareTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export function listPendingClosureTasksForPlanningDate(
  tasks: Task[],
  date: string,
  crews: Pick<Crew, "id" | "name">[] = []
): Task[] {
  return tasks
    .filter(
      (task) =>
        isWorkOrderTask(task) &&
        task.dueDate === date &&
        isPendingClosureStatus(task.status)
    )
    .sort((left, right) => compareTasksByDispatchRoute(left, right, crews))
}

export function resolvePendingClosureSubmittedAt(task: Task): string | null {
  if (task.completedAt) {
    return task.completedAt
  }

  const stepTimes = (task.operationalSteps ?? [])
    .map((step) => step.completedAt)
    .filter((value): value is string => Boolean(value?.trim()))

  if (stepTimes.length === 0) {
    return null
  }

  return stepTimes.sort((left, right) => right.localeCompare(left))[0] ?? null
}

export function resolveTaskCrewOperatorLabel(
  task: Pick<Task, "crewId" | "crew">,
  crews: Pick<Crew, "id" | "name" | "members">[] = []
): string {
  const crewId = resolveTaskCrewId(task, crews)
  if (!crewId) {
    return "—"
  }

  const crew = crews.find((entry) => entry.id === crewId)
  if (!crew) {
    return task.crew?.trim() || "—"
  }

  const activeMembers = crew.members.filter((member) => member.active)
  if (activeMembers.length === 0) {
    return "—"
  }

  return activeMembers.map((member) => member.name).join(", ")
}

export function resolvePendingClosureClientLabel(task: Task): string {
  return (
    task.customerName?.trim() ||
    task.customerCompany?.trim() ||
    task.title?.trim() ||
    "—"
  )
}
