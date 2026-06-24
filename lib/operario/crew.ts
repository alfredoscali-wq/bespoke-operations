import type { WorkerCrewRef } from "@/lib/data/operario"
import type { Crew } from "@/lib/types/crews"

export type OperarioCrewStatus = "loading" | "resolved" | "unassigned" | "multiple"

export type OperarioCrewResolution = {
  workerCrewRef: WorkerCrewRef
  crewStatus: OperarioCrewStatus
  assignedCrewNames: string[]
}

const EMPTY_CREW_REF: WorkerCrewRef = { name: "" }

export function findEmployeeCrews(
  employeeId: string,
  crews: Crew[]
): Pick<Crew, "id" | "name">[] {
  return crews
    .filter((crew) =>
      crew.members.some(
        (member) => member.active && member.employeeId === employeeId
      )
    )
    .map((crew) => ({ id: crew.id, name: crew.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
}

export function resolveOperarioWorkerCrew(
  employeeId: string | null | undefined,
  crews: Crew[]
): OperarioCrewResolution {
  if (!employeeId?.trim()) {
    return {
      workerCrewRef: EMPTY_CREW_REF,
      crewStatus: "unassigned",
      assignedCrewNames: [],
    }
  }

  const matchedCrews = findEmployeeCrews(employeeId, crews)
  const assignedCrewNames = matchedCrews.map((crew) => crew.name)

  if (matchedCrews.length === 0) {
    return {
      workerCrewRef: EMPTY_CREW_REF,
      crewStatus: "unassigned",
      assignedCrewNames: [],
    }
  }

  const primary = matchedCrews[0]

  return {
    workerCrewRef: { id: primary.id, name: primary.name },
    crewStatus: matchedCrews.length > 1 ? "multiple" : "resolved",
    assignedCrewNames,
  }
}

export function createLoadingCrewResolution(): OperarioCrewResolution {
  return {
    workerCrewRef: EMPTY_CREW_REF,
    crewStatus: "loading",
    assignedCrewNames: [],
  }
}
