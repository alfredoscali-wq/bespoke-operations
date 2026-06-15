import { taskMatchesCrew } from "@/lib/crews/utils"
import type { Crew, CrewStatus } from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"

/** Task statuses that place a crew in field operations. */
export const CREW_FIELD_TASK_STATUSES: TaskStatus[] = [
  "asignada",
  "en-curso",
  "en-aprobacion",
]

export function crewHasFieldTasks(
  crew: Pick<Crew, "id" | "name">,
  tasks: Task[]
): boolean {
  return tasks.some(
    (task) =>
      taskMatchesCrew(task, crew) &&
      CREW_FIELD_TASK_STATUSES.includes(task.status)
  )
}

export function resolveAutomaticCrewStatus(
  crew: Pick<Crew, "id" | "name">,
  tasks: Task[]
): Exclude<CrewStatus, "inactiva"> {
  return crewHasFieldTasks(crew, tasks) ? "en-campo" : "activa"
}

export function resolveCrewStatus(
  crew: Pick<Crew, "id" | "name" | "status">,
  tasks: Task[]
): CrewStatus {
  if (crew.status === "inactiva") {
    return "inactiva"
  }

  return resolveAutomaticCrewStatus(crew, tasks)
}

export function isCrewManuallyInactive(crew: Pick<Crew, "status">): boolean {
  return crew.status === "inactiva"
}

export function isCrewAssignable(crew: Pick<Crew, "status">): boolean {
  return crew.status !== "inactiva"
}

export function getAssignableCrews(crews: Crew[]): Crew[] {
  return crews.filter(isCrewAssignable)
}

export function getCrewsForTaskSelection(
  crews: Crew[],
  currentCrewId?: string | null
): Crew[] {
  return crews.filter(
    (crew) => isCrewAssignable(crew) || crew.id === currentCrewId
  )
}

export function validateCrewAssignment(
  crew: Pick<Crew, "status" | "name"> | undefined
): { allowed: boolean; message?: string } {
  if (!crew) {
    return { allowed: false, message: "Cuadrilla no encontrada." }
  }

  if (!isCrewAssignable(crew)) {
    return {
      allowed: false,
      message: `La cuadrilla ${crew.name} está inactiva y no puede recibir tareas.`,
    }
  }

  return { allowed: true }
}

export function shouldPersistCrewStatusSync(
  crew: Pick<Crew, "id" | "name" | "status">,
  tasks: Task[]
): CrewStatus | null {
  if (isCrewManuallyInactive(crew)) {
    return null
  }

  const nextStatus = resolveAutomaticCrewStatus(crew, tasks)
  return nextStatus !== crew.status ? nextStatus : null
}

export function withResolvedCrewStatuses(
  crews: Crew[],
  tasks: Task[]
): Crew[] {
  return crews.map((crew) => {
    const status = resolveCrewStatus(crew, tasks)
    return status === crew.status ? crew : { ...crew, status }
  })
}
