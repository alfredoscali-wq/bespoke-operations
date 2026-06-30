import type { WorkOrderFormInput } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

export type CambioDomicilioLocation = {
  address: string
  locality: string
  sharedLocation: string
  latitude: number | null
  longitude: number | null
}

export type CambioDomicilioDetails = {
  current: CambioDomicilioLocation
  new: CambioDomicilioLocation
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  return null
}

function resolveLocationFromParts(input: {
  address: string
  locality: string
  sharedLocation: string
  latitude: number | null
  longitude: number | null
}): CambioDomicilioLocation {
  return {
    address: input.address,
    locality: input.locality,
    sharedLocation: input.sharedLocation,
    latitude: input.latitude,
    longitude: input.longitude,
  }
}

export function parseCambioDomicilioFromTask(task: Task): CambioDomicilioDetails {
  const metadata = task.taskMetadata ?? {}

  const currentAddress = readString(metadata.currentAddress)
  const currentLocality = readString(metadata.currentLocality)

  const newAddress =
    readString(metadata.newAddress) || readString(task.serviceAddress) || ""
  const newLocality =
    readString(metadata.newLocality) || readString(task.locality) || ""

  const currentSharedLocation = readString(metadata.currentSharedLocation)
  const newSharedLocation =
    readString(metadata.newSharedLocation) || readString(task.sharedLocation)

  const currentLatitude = readNumber(metadata.currentLatitude)
  const currentLongitude = readNumber(metadata.currentLongitude)
  const newLatitude =
    readNumber(metadata.newLatitude) ?? task.latitude ?? null
  const newLongitude =
    readNumber(metadata.newLongitude) ?? task.longitude ?? null

  return {
    current: resolveLocationFromParts({
      address: currentAddress,
      locality: currentLocality,
      sharedLocation: currentSharedLocation,
      latitude: currentLatitude,
      longitude: currentLongitude,
    }),
    new: resolveLocationFromParts({
      address: newAddress,
      locality: newLocality,
      sharedLocation: newSharedLocation,
      latitude: newLatitude,
      longitude: newLongitude,
    }),
  }
}

export function buildCambioDomicilioMetadataFromForm(
  form: WorkOrderFormInput
): Record<string, unknown> {
  return {
    currentAddress: form.currentAddress.trim(),
    newAddress: form.newAddress.trim(),
    currentLocality: form.currentLocality.trim(),
    newLocality: form.newLocality.trim(),
    currentSharedLocation: form.currentSharedLocation.trim() || undefined,
    newSharedLocation: form.newSharedLocation.trim() || undefined,
    currentLatitude: form.currentLatitude ?? undefined,
    currentLongitude: form.currentLongitude ?? undefined,
    newLatitude: form.newLatitude ?? undefined,
    newLongitude: form.newLongitude ?? undefined,
  }
}

export function buildCambioDomicilioFormSliceFromTask(
  task: Task
): Partial<WorkOrderFormInput> {
  const details = parseCambioDomicilioFromTask(task)

  return {
    currentAddress: details.current.address,
    newAddress: details.new.address,
    currentLocality: details.current.locality,
    newLocality: details.new.locality,
    currentSharedLocation: details.current.sharedLocation,
    newSharedLocation: details.new.sharedLocation,
    currentLatitude: details.current.latitude,
    currentLongitude: details.current.longitude,
    newLatitude: details.new.latitude,
    newLongitude: details.new.longitude,
    sharedLocation: details.new.sharedLocation,
    latitude: details.new.latitude,
    longitude: details.new.longitude,
  }
}

export function isCambioDomicilioTask(
  task: Pick<Task, "serviceType">
): boolean {
  return task.serviceType === "cambio-domicilio"
}
