import { resolveLocationViaApi } from "@/lib/location/client/resolve-via-api"
import { validateLocationInput } from "@/lib/location"
import type { NewProjectInput } from "@/lib/types/projects"

/**
 * Resolves optional GPS sharedLocation into latitude/longitude for project create/update.
 * Empty sharedLocation leaves existing latitude/longitude untouched (edit keep / create null).
 */
export async function enrichProjectInputWithResolvedGps(
  input: NewProjectInput
): Promise<NewProjectInput> {
  const trimmed = input.sharedLocation?.trim() ?? ""

  if (!trimmed) {
    return {
      ...input,
      sharedLocation: "",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    }
  }

  const validation = validateLocationInput(trimmed)
  if (!validation.valid) {
    throw new Error("Pegue una ubicación GPS válida (link de Google Maps o coordenadas).")
  }

  const resolved = await resolveLocationViaApi(trimmed)

  return {
    ...input,
    sharedLocation: resolved.normalizedLocation,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  }
}
