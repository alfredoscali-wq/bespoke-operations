import type { Crew, CrewOrigin } from "@/lib/types/crews"

export function isExternalCrew(
  crew: Pick<Crew, "origin" | "contractorId"> | null | undefined
): boolean {
  if (!crew) return false
  return crew.origin === "external" || Boolean(crew.contractorId)
}

export function isInternalCrew(
  crew: Pick<Crew, "origin" | "contractorId"> | null | undefined
): boolean {
  return !isExternalCrew(crew)
}

export function resolveCrewOrigin(
  crew: Pick<Crew, "origin" | "contractorId"> | null | undefined
): CrewOrigin {
  return isExternalCrew(crew) ? "external" : "internal"
}

export function filterInternalCrews<T extends Pick<Crew, "origin" | "contractorId">>(
  crews: T[]
): T[] {
  return crews.filter(isInternalCrew)
}

export function filterExternalCrews<T extends Pick<Crew, "origin" | "contractorId">>(
  crews: T[],
  contractorId?: string | null
): T[] {
  return crews.filter((crew) => {
    if (!isExternalCrew(crew)) return false
    if (!contractorId) return true
    return crew.contractorId === contractorId
  })
}

export function formatCrewOptionLabel(
  crew: Pick<Crew, "name" | "origin" | "contractorId">
): string {
  if (isExternalCrew(crew)) {
    return `${crew.name} (Externa)`
  }
  return crew.name
}
