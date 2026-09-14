import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import {
  mapCompanyTaskLocationSettings,
  type CompanyTaskLocationSettings,
} from "@/lib/mobile/v1/tasks/task-location-validation"

/**
 * OT GPS settings for the authenticated tenant only.
 * Missing row → defaults (validation OFF). Never inserts.
 */
export async function loadCompanyTaskLocationSettings(
  client: SupabaseClient,
  companyId: string
): Promise<CompanyTaskLocationSettings> {
  const { data, error } = await client
    .from("company_mobile_settings")
    .select("task_location_validation_enabled, task_radius_meters")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  return mapCompanyTaskLocationSettings(data ?? null)
}
