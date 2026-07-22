import { isExternalCrew, resolveCrewOrigin } from "@/lib/crews/origin"
import type { Crew, CrewOrigin } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"

/**
 * Dashboard/reporting model prep: classify OT execution by crew origin.
 * No KPI UI yet — use these helpers when internal vs external metrics are added.
 */
export type TaskCrewExecutionOrigin = CrewOrigin | "unassigned"

export function resolveTaskCrewExecutionOrigin(
  task: Pick<Task, "crewId" | "crew">,
  crews: Array<Pick<Crew, "id" | "name" | "origin" | "contractorId">>
): TaskCrewExecutionOrigin {
  const crewId = resolveTaskCrewId(task)
  if (!crewId) {
    const byName = crews.find((crew) => crew.name === task.crew)
    if (!byName) return "unassigned"
    return resolveCrewOrigin(byName)
  }

  const crew = crews.find((item) => item.id === crewId)
  if (!crew) return "unassigned"
  return resolveCrewOrigin(crew)
}

export function partitionTasksByCrewOrigin(
  tasks: Array<Pick<Task, "crewId" | "crew">>,
  crews: Array<Pick<Crew, "id" | "name" | "origin" | "contractorId">>
): {
  internal: typeof tasks
  external: typeof tasks
  unassigned: typeof tasks
} {
  const internal: typeof tasks = []
  const external: typeof tasks = []
  const unassigned: typeof tasks = []

  for (const task of tasks) {
    const origin = resolveTaskCrewExecutionOrigin(task, crews)
    if (origin === "internal") internal.push(task)
    else if (origin === "external") external.push(task)
    else unassigned.push(task)
  }

  return { internal, external, unassigned }
}

export function isTaskExecutedByExternalCrew(
  task: Pick<Task, "crewId" | "crew">,
  crews: Array<Pick<Crew, "id" | "name" | "origin" | "contractorId">>
): boolean {
  const crewId = resolveTaskCrewId(task)
  const crew = crewId
    ? crews.find((item) => item.id === crewId)
    : crews.find((item) => item.name === task.crew)
  return isExternalCrew(crew)
}
