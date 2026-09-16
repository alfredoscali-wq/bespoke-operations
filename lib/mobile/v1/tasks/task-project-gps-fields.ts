import { hasCoordinates } from "@/lib/gps/coordinates"
import type { ProjectGpsSource } from "@/lib/mobile/v1/tasks/task-start-coordinates"

export type MobileTaskProjectGpsFields = {
  projectLatitude: number | null
  projectLongitude: number | null
}

const EMPTY_PROJECT_GPS: MobileTaskProjectGpsFields = {
  projectLatitude: null,
  projectLongitude: null,
}

/**
 * Exposes Obra GPS as separate DTO fields.
 * Does not copy project coordinates onto the OT latitude/longitude.
 */
export function resolveMobileTaskProjectGpsFields(input: {
  projectId?: string | null
  project: ProjectGpsSource
}): MobileTaskProjectGpsFields {
  if (!input.projectId?.trim() || !input.project) {
    return EMPTY_PROJECT_GPS
  }

  if (!hasCoordinates(input.project.latitude, input.project.longitude)) {
    return EMPTY_PROJECT_GPS
  }

  return {
    projectLatitude: input.project.latitude as number,
    projectLongitude: input.project.longitude as number,
  }
}
