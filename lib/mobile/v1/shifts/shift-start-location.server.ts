import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { hasCoordinates } from "@/lib/gps"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import {
  mapCompanyShiftLocationSettings,
  type CompanyShiftLocationSettings,
} from "@/lib/mobile/v1/shifts/shift-location-validation"

export type CrewOperationalBaseCoordinates = {
  latitude: number
  longitude: number
}

/**
 * Shift GPS settings for the authenticated tenant only.
 * Missing row → defaults (validation OFF). Never inserts.
 */
export async function loadCompanyShiftLocationSettings(
  client: SupabaseClient,
  companyId: string
): Promise<CompanyShiftLocationSettings> {
  const { data, error } = await client
    .from("company_mobile_settings")
    .select("shift_location_validation_enabled, shift_radius_meters")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  return mapCompanyShiftLocationSettings(data ?? null)
}

/**
 * Operational base GPS for the resolved crew, scoped to the same tenant.
 */
export async function loadCrewOperationalBaseCoordinates(
  client: SupabaseClient,
  companyId: string,
  workTeamId: string
): Promise<CrewOperationalBaseCoordinates | null> {
  const { data, error } = await client
    .from("crews")
    .select("operational_base_latitude, operational_base_longitude")
    .eq("id", workTeamId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  if (
    !data ||
    !hasCoordinates(
      data.operational_base_latitude,
      data.operational_base_longitude
    )
  ) {
    return null
  }

  return {
    latitude: data.operational_base_latitude as number,
    longitude: data.operational_base_longitude as number,
  }
}
