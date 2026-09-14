import "server-only"

import { mapMobileBootstrapResponse } from "@/lib/mobile/v1/bootstrap/map-bootstrap-response"
import type { MobileBootstrapResponse } from "@/lib/mobile/v1/bootstrap/types"
import {
  MOBILE_API_ERROR_MESSAGES,
  MobileApiError,
} from "@/lib/mobile/v1/errors"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Resolves a tenant for Bespoke Mobile before login.
 * The only selector is companies.mobile_code (already normalized).
 * Branding and operations are loaded for that company_id only — never from
 * client companyId, slug, JWT, session, billing settings, or production fallbacks.
 * Missing company_mobile_settings is mapped to in-memory defaults (no INSERT).
 */
export async function bootstrapMobileCompany(
  companyCode: string
): Promise<MobileBootstrapResponse> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("companies")
    .select("id, name")
    .eq("mobile_code", companyCode)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  if (!data) {
    throw new MobileApiError(
      "COMPANY_NOT_FOUND",
      MOBILE_API_ERROR_MESSAGES.COMPANY_NOT_FOUND,
      404
    )
  }

  const { data: branding, error: brandingError } = await admin
    .from("company_branding")
    .select("logo_url, primary_color, secondary_color")
    .eq("company_id", data.id)
    .maybeSingle()

  if (brandingError) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  const { data: operations, error: operationsError } = await admin
    .from("company_mobile_settings")
    .select(
      "shift_location_validation_enabled, shift_radius_meters, task_location_validation_enabled, task_radius_meters, gps_heartbeat_enabled, gps_heartbeat_interval_seconds"
    )
    .eq("company_id", data.id)
    .maybeSingle()

  if (operationsError) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      MOBILE_API_ERROR_MESSAGES.INTERNAL_ERROR,
      500
    )
  }

  return mapMobileBootstrapResponse({
    companyId: data.id,
    companyName: data.name,
    branding: branding ?? null,
    operations: operations ?? null,
  })
}
