import {
  isCambioDomicilioTask,
  parseCambioDomicilioFromTask,
} from "@/lib/tasks/cambio-domicilio"
import type { Task } from "@/lib/types/tasks"

export type MobileTaskCurrentLocationFields = {
  currentAddress: string | null
  currentLatitude: number | null
  currentLongitude: number | null
}

/**
 * Origin domicile for cambio-domicilio OTs (from existing taskMetadata parser).
 * Other service types always return nulls for Field Agent compatibility.
 */
export function resolveMobileTaskCurrentLocationFields(
  task: Task
): MobileTaskCurrentLocationFields {
  if (!isCambioDomicilioTask(task)) {
    return {
      currentAddress: null,
      currentLatitude: null,
      currentLongitude: null,
    }
  }

  const { current } = parseCambioDomicilioFromTask(task)

  return {
    currentAddress: current.address.trim() || null,
    currentLatitude: current.latitude,
    currentLongitude: current.longitude,
  }
}
