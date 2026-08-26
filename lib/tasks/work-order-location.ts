import { buildGoogleMapsUrl, hasCoordinates } from "@/lib/gps"
import { validateLocationInput } from "@/lib/location"
import type { WorkOrderFormInput } from "@/lib/tasks/work-order"

export type WorkOrderLocationMissing =
  | "address"
  | "locality"
  | "gps"
  | "gps-partial"

export type WorkOrderLocationValidation = {
  valid: boolean
  missing?: WorkOrderLocationMissing
  message?: string
}

export type CopiedGpsFields = {
  latitude: number | null
  longitude: number | null
  sharedLocation: string
}

const GPS_MISSING_MESSAGE = "Falta la ubicación GPS."
const GPS_PARTIAL_MESSAGE =
  "La ubicación GPS está incompleta (faltan latitud o longitud)."
const GPS_INVALID_LINK_MESSAGE = "Pegue una ubicación válida de Google Maps."

export function readFiniteCoordinate(
  value: number | null | undefined
): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function isGpsCoordinatePairPartial(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  const hasLat = readFiniteCoordinate(latitude) != null
  const hasLng = readFiniteCoordinate(longitude) != null
  return hasLat !== hasLng
}

export function isWorkOrderGpsLoaded(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return hasCoordinates(latitude, longitude)
}

export function isSharedLocationResolvable(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) {
    return false
  }

  return validateLocationInput(trimmed).valid
}

export function isWorkOrderGpsValueValid(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  sharedLocation: string | null | undefined
): boolean {
  if (hasCoordinates(latitude, longitude)) {
    return true
  }

  return isSharedLocationResolvable(sharedLocation)
}

/** Copy GPS from a ficha without inventing coordinates. Numbers stay numbers. */
export function resolveCopiedGps(input: {
  latitude?: number | null
  longitude?: number | null
  sharedLocation?: string | null
}): CopiedGpsFields {
  const latitude = readFiniteCoordinate(input.latitude)
  const longitude = readFiniteCoordinate(input.longitude)
  let sharedLocation = input.sharedLocation?.trim() ?? ""

  if (!sharedLocation && hasCoordinates(latitude, longitude)) {
    sharedLocation = buildGoogleMapsUrl(latitude as number, longitude as number)
  }

  return {
    latitude,
    longitude,
    sharedLocation,
  }
}

export function shouldResolveLocationOnSave(
  sharedLocation: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (!sharedLocation?.trim()) {
    return false
  }

  return !hasCoordinates(latitude, longitude)
}

export function hasWorkOrderStreetAddress(
  form: Pick<
    WorkOrderFormInput,
    "serviceType" | "address" | "currentAddress" | "newAddress"
  >
): boolean {
  if (form.serviceType === "baja" || !form.serviceType) {
    return true
  }

  if (form.serviceType === "cambio-domicilio") {
    return Boolean(form.currentAddress.trim() && form.newAddress.trim())
  }

  return Boolean(form.address.trim())
}

export function hasWorkOrderLocality(
  form: Pick<
    WorkOrderFormInput,
    "serviceType" | "locality" | "currentLocality" | "newLocality"
  >
): boolean {
  if (form.serviceType === "instalacion-nueva") {
    return Boolean(form.locality.trim())
  }

  if (form.serviceType === "cambio-domicilio") {
    return Boolean(form.currentLocality.trim() && form.newLocality.trim())
  }

  return true
}

function requiredGpsFields(form: Pick<
  WorkOrderFormInput,
  | "serviceType"
  | "sharedLocation"
  | "newSharedLocation"
  | "latitude"
  | "longitude"
  | "newLatitude"
  | "newLongitude"
>): {
  latitude: number | null
  longitude: number | null
  sharedLocation: string
} {
  if (form.serviceType === "cambio-domicilio") {
    return {
      latitude: readFiniteCoordinate(form.newLatitude),
      longitude: readFiniteCoordinate(form.newLongitude),
      sharedLocation: form.newSharedLocation.trim(),
    }
  }

  return {
    latitude: readFiniteCoordinate(form.latitude),
    longitude: readFiniteCoordinate(form.longitude),
    sharedLocation: form.sharedLocation.trim(),
  }
}

export function hasWorkOrderGps(
  form: Pick<
    WorkOrderFormInput,
    | "serviceType"
    | "sharedLocation"
    | "newSharedLocation"
    | "latitude"
    | "longitude"
    | "newLatitude"
    | "newLongitude"
  >
): boolean {
  const gps = requiredGpsFields(form)
  return isWorkOrderGpsValueValid(gps.latitude, gps.longitude, gps.sharedLocation)
}

export function validateWorkOrderLocation(
  form: WorkOrderFormInput
): WorkOrderLocationValidation {
  if (!form.serviceType) {
    return { valid: true }
  }

  if (!hasWorkOrderStreetAddress(form)) {
    return {
      valid: false,
      missing: "address",
      message:
        form.serviceType === "cambio-domicilio"
          ? "Indique dirección actual y nueva dirección."
          : "La dirección es obligatoria.",
    }
  }

  if (!hasWorkOrderLocality(form)) {
    return {
      valid: false,
      missing: "locality",
      message:
        form.serviceType === "cambio-domicilio"
          ? "Indique localidad actual y nueva localidad."
          : "La localidad es obligatoria.",
    }
  }

  const required = requiredGpsFields(form)
  if (isGpsCoordinatePairPartial(required.latitude, required.longitude)) {
    if (!isSharedLocationResolvable(required.sharedLocation)) {
      return {
        valid: false,
        missing: "gps-partial",
        message: GPS_PARTIAL_MESSAGE,
      }
    }
  }

  if (form.serviceType === "cambio-domicilio") {
    const currentPartial = isGpsCoordinatePairPartial(
      form.currentLatitude,
      form.currentLongitude
    )
    if (
      currentPartial &&
      !isSharedLocationResolvable(form.currentSharedLocation)
    ) {
      return {
        valid: false,
        missing: "gps-partial",
        message: GPS_PARTIAL_MESSAGE,
      }
    }

    const currentLocation = form.currentSharedLocation.trim()
    if (
      currentLocation &&
      !hasCoordinates(form.currentLatitude, form.currentLongitude) &&
      !isSharedLocationResolvable(currentLocation)
    ) {
      return {
        valid: false,
        missing: "gps",
        message:
          "Pegue una ubicación válida de Google Maps para el domicilio actual.",
      }
    }
  }

  if (hasWorkOrderGps(form)) {
    return { valid: true }
  }

  if (
    required.sharedLocation &&
    !isSharedLocationResolvable(required.sharedLocation)
  ) {
    return {
      valid: false,
      missing: "gps",
      message:
        form.serviceType === "cambio-domicilio"
          ? "Pegue una ubicación válida de Google Maps para el nuevo domicilio."
          : GPS_INVALID_LINK_MESSAGE,
    }
  }

  return {
    valid: false,
    missing: "gps",
    message: GPS_MISSING_MESSAGE,
  }
}
