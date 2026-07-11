import { hasCoordinates } from "@/lib/gps/coordinates"
import type { ProjectStatus } from "@/lib/types/projects"

export const PROJECT_GPS_REQUIRED_TO_START_MESSAGE =
  "La Obra necesita una ubicación GPS antes de poder iniciarse."

export function hasProjectGps(input: {
  latitude?: number | null
  longitude?: number | null
}): boolean {
  return hasCoordinates(input.latitude, input.longitude)
}

export function validateProjectGpsPair(input: {
  latitude?: number | null
  longitude?: number | null
}): { ok: true } | { ok: false; message: string } {
  const lat = input.latitude
  const lng = input.longitude

  if (lat == null && lng == null) {
    return { ok: true }
  }

  if (lat == null || lng == null) {
    return {
      ok: false,
      message: "La ubicación GPS debe incluir latitud y longitud.",
    }
  }

  if (!hasCoordinates(lat, lng)) {
    return {
      ok: false,
      message: "Las coordenadas GPS de la Obra no son válidas.",
    }
  }

  return { ok: true }
}

export function projectCanStartWithGps(input: {
  status: ProjectStatus
  latitude?: number | null
  longitude?: number | null
}): { ok: true } | { ok: false; message: string } {
  if (input.status !== "planned") {
    return {
      ok: false,
      message: "Solo se puede iniciar una obra en estado Planificada.",
    }
  }

  if (!hasProjectGps(input)) {
    return {
      ok: false,
      message: PROJECT_GPS_REQUIRED_TO_START_MESSAGE,
    }
  }

  return { ok: true }
}
