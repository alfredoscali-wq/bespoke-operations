import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type CrewFilterOption = {
  id: string
  name: string
}

type TaskCrewFields = Pick<Task, "crewId" | "crew">

export function taskHasCrew(task: TaskCrewFields): boolean {
  return Boolean(task.crewId || task.crew?.trim())
}

/**
 * Canonical Task ↔ Crew match: crew_id first, crew name snapshot for legacy rows.
 */
export function taskMatchesCrewId(
  task: TaskCrewFields,
  crew: Pick<Crew, "id" | "name">
): boolean {
  if (task.crewId) {
    return task.crewId === crew.id
  }

  return Boolean(
    task.crew?.trim() &&
      normalizeCrewName(task.crew) === normalizeCrewName(crew.name)
  )
}

function normalizeCrewName(value: string): string {
  return value.trim().toLocaleLowerCase("es")
}

export function resolveTaskCrewId(
  task: TaskCrewFields,
  crews: Pick<Crew, "id" | "name">[] = []
): string | undefined {
  if (task.crewId) {
    return task.crewId
  }

  if (!task.crew?.trim()) {
    return undefined
  }

  const taskCrewName = normalizeCrewName(task.crew)

  return crews.find(
    (crew) => normalizeCrewName(crew.name) === taskCrewName
  )?.id
}

export function resolveTaskCrewDisplayName(
  task: TaskCrewFields,
  getCrew?: (id: string) => Pick<Crew, "name"> | undefined
): string {
  if (task.crewId && getCrew) {
    const crew = getCrew(task.crewId)
    if (crew?.name) {
      return crew.name
    }
  }

  return task.crew?.trim() || "Sin cuadrilla"
}

/** True when crew_id is set but the crew is not in the active crews catalog (archived or missing). */
export function isTaskCrewArchived(
  task: TaskCrewFields,
  getCrew?: (id: string) => Pick<Crew, "name"> | undefined
): boolean {
  if (!task.crewId || !getCrew) {
    return false
  }

  return !getCrew(task.crewId)
}

export function getTaskCrewArchiveWarning(task: TaskCrewFields): string {
  const snapshot = task.crew?.trim()
  if (snapshot) {
    return `La cuadrilla "${snapshot}" fue archivada. Reasigne la tarea a una cuadrilla activa.`
  }

  return "La cuadrilla asignada fue archivada. Reasigne la tarea a una cuadrilla activa."
}

export function isSameTaskCrewAssignment(
  task: TaskCrewFields,
  crewId: string | null | undefined
): boolean {
  if (crewId) {
    return task.crewId === crewId
  }

  return !taskHasCrew(task)
}

export function buildCrewFilterOptions(
  crews: Pick<Crew, "id" | "name">[]
): CrewFilterOption[] {
  return [...crews]
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((crew) => ({ id: crew.id, name: crew.name }))
}

export function taskMatchesCrewFilter(
  task: TaskCrewFields,
  crewFilter: string | "all",
  crews: Pick<Crew, "id" | "name">[] = []
): boolean {
  if (crewFilter === "all") {
    return true
  }

  if (task.crewId === crewFilter) {
    return true
  }

  const filterCrew = crews.find((crew) => crew.id === crewFilter)
  if (!filterCrew) {
    return false
  }

  if (!task.crewId && task.crew?.trim()) {
    return normalizeCrewName(task.crew) === normalizeCrewName(filterCrew.name)
  }

  return false
}

export function resolveCrewSnapshotsForAssignment(
  crew: Pick<Crew, "id" | "name" | "supervisor"> | null | undefined
): {
  crewId: string | null
  crew: string
  supervisor: string
} {
  if (!crew) {
    return { crewId: null, crew: "", supervisor: "" }
  }

  return {
    crewId: crew.id,
    crew: crew.name,
    supervisor: crew.supervisor.trim(),
  }
}
