import {
  getCurrentAvailabilityStatus,
  toDateOnly,
} from "@/lib/availability/utils"
import { isEmployeeAvailable } from "@/lib/employees/utils"
import type { EmployeeAvailability } from "@/lib/types/availability"
import type {
  Crew,
  CrewAvailability,
  CrewAvailabilityStatus,
  CrewAvailabilitySummary,
  CrewMember,
} from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"

export type CrewAvailabilityContext = {
  availabilityRecords: EmployeeAvailability[]
  getEmployee?: (id: string) => Employee | undefined
  referenceDate?: string
}

function resolveReferenceDate(context: CrewAvailabilityContext): string {
  return context.referenceDate ?? toDateOnly()
}

function getActiveMembers(members: CrewMember[]): CrewMember[] {
  return members.filter((member) => member.active)
}

/**
 * Determines whether a crew member can contribute to operational capacity
 * on the reference date, using RRHH status and availability windows.
 */
export function isMemberOperationallyAvailable(
  member: CrewMember,
  context: CrewAvailabilityContext
): boolean {
  if (!member.active) {
    return false
  }

  if (member.employeeId) {
    const employee = context.getEmployee?.(member.employeeId)
    if (employee && !isEmployeeAvailable(employee)) {
      return false
    }

    return (
      getCurrentAvailabilityStatus(
        member.employeeId,
        context.availabilityRecords,
        resolveReferenceDate(context)
      ) === "AVAILABLE"
    )
  }

  return true
}

function resolveCrewAvailabilityStatus(
  totalMembers: number,
  availableMembers: number
): CrewAvailabilityStatus {
  if (totalMembers === 0 || availableMembers === 0) {
    return "NOT_OPERATIONAL"
  }

  if (availableMembers === totalMembers) {
    return "OPERATIONAL"
  }

  return "REDUCED_CAPACITY"
}

export function getCrewAvailability(
  crew: Pick<Crew, "id" | "members">,
  context: CrewAvailabilityContext
): CrewAvailability {
  const referenceDate = resolveReferenceDate(context)
  const activeMembers = getActiveMembers(crew.members)
  const availableMembers = activeMembers.filter((member) =>
    isMemberOperationallyAvailable(member, context)
  ).length

  return {
    crewId: crew.id,
    status: resolveCrewAvailabilityStatus(
      activeMembers.length,
      availableMembers
    ),
    totalMembers: activeMembers.length,
    availableMembers,
    absentMembers: activeMembers.length - availableMembers,
    referenceDate,
  }
}

export function getCrewAvailabilityById(
  crewId: string,
  crews: Pick<Crew, "id" | "members">[],
  context: CrewAvailabilityContext
): CrewAvailability | undefined {
  const crew = crews.find((item) => item.id === crewId)
  if (!crew) {
    return undefined
  }

  return getCrewAvailability(crew, context)
}

export function getCrewAvailabilitySummary(
  crews: Pick<Crew, "id" | "members">[],
  context: CrewAvailabilityContext
): CrewAvailabilitySummary {
  const availability = crews.map((crew) => getCrewAvailability(crew, context))

  return {
    totalCrews: crews.length,
    operational: availability.filter((item) => item.status === "OPERATIONAL")
      .length,
    reducedCapacity: availability.filter(
      (item) => item.status === "REDUCED_CAPACITY"
    ).length,
    notOperational: availability.filter(
      (item) => item.status === "NOT_OPERATIONAL"
    ).length,
  }
}
