import { hasCoordinates } from "@/lib/gps"
import { calculateDistanceMeters } from "@/lib/mobile/v1/tasks/geo-utils"
import type { MobileApiErrorCode } from "@/lib/mobile/v1/errors"

/** Matches company_mobile_settings / bootstrap defaults. Runtime OFF until configured. */
export const DEFAULT_SHIFT_LOCATION_VALIDATION_ENABLED = false
export const DEFAULT_SHIFT_RADIUS_METERS = 150

export const SHIFT_LOCATION_REQUIRED_MESSAGE =
  "La Base Operativa de esta cuadrilla no tiene ubicación GPS."

export type CompanyShiftLocationSettings = {
  shiftLocationValidationEnabled: boolean
  shiftRadiusMeters: number
}

export type ShiftStartLocationPolicyInput = {
  validationEnabled: boolean
  radiusMeters: number
  deviceLatitude: number
  deviceLongitude: number
  referenceLatitude: number | null
  referenceLongitude: number | null
}

export type ShiftStartLocationPolicyResult = {
  shouldValidate: boolean
  shouldBlock: boolean
  missingReference: boolean
  distanceMeters: number | null
  withinRadius: boolean | null
  code: Extract<
    MobileApiErrorCode,
    "SHIFT_LOCATION_OUT_OF_RANGE" | "SHIFT_LOCATION_REQUIRED"
  > | null
  message: string | null
}

export function mapCompanyShiftLocationSettings(
  row: {
    shift_location_validation_enabled: boolean
    shift_radius_meters: number
  } | null
): CompanyShiftLocationSettings {
  if (!row) {
    return {
      shiftLocationValidationEnabled: DEFAULT_SHIFT_LOCATION_VALIDATION_ENABLED,
      shiftRadiusMeters: DEFAULT_SHIFT_RADIUS_METERS,
    }
  }

  return {
    shiftLocationValidationEnabled: row.shift_location_validation_enabled,
    shiftRadiusMeters: row.shift_radius_meters,
  }
}

export function evaluateShiftStartLocationPolicy(
  input: ShiftStartLocationPolicyInput
): ShiftStartLocationPolicyResult {
  if (!input.validationEnabled) {
    return {
      shouldValidate: false,
      shouldBlock: false,
      missingReference: false,
      distanceMeters: null,
      withinRadius: null,
      code: null,
      message: null,
    }
  }

  if (
    !hasCoordinates(input.referenceLatitude, input.referenceLongitude) ||
    input.referenceLatitude == null ||
    input.referenceLongitude == null
  ) {
    return {
      shouldValidate: true,
      shouldBlock: true,
      missingReference: true,
      distanceMeters: null,
      withinRadius: null,
      code: "SHIFT_LOCATION_REQUIRED",
      message: SHIFT_LOCATION_REQUIRED_MESSAGE,
    }
  }

  const distanceMeters = calculateDistanceMeters(
    input.deviceLatitude,
    input.deviceLongitude,
    input.referenceLatitude,
    input.referenceLongitude
  )
  const withinRadius = distanceMeters <= input.radiusMeters

  if (withinRadius) {
    return {
      shouldValidate: true,
      shouldBlock: false,
      missingReference: false,
      distanceMeters,
      withinRadius: true,
      code: null,
      message: null,
    }
  }

  return {
    shouldValidate: true,
    shouldBlock: true,
    missingReference: false,
    distanceMeters,
    withinRadius: false,
    code: "SHIFT_LOCATION_OUT_OF_RANGE",
    message: `Se encuentra a ${Math.round(distanceMeters)} metros de la base operativa.`,
  }
}
