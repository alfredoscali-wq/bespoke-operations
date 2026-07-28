import "server-only"

import {
  DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS,
} from "@/lib/presence/constants"
import type { PresenceEngineSettings } from "@/lib/presence/types"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Single server authority for the operational presence / geofence radius.
 * Prefer per-company DB settings; fall back to the engine default (150 m).
 */
export async function getOperationalPresenceRadiusMeters(
  companyId: string
): Promise<number> {
  const settings = await getPresenceEngineSettings(companyId)
  return settings.operationalRadiusMeters
}

export async function getPresenceEngineSettings(
  companyId: string
): Promise<PresenceEngineSettings> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("presence_engine_settings")
    .select("company_id, operational_radius_meters, updated_at")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    console.warn("[PresenceEngine] settings lookup failed; using default", {
      companyId,
      message: error.message,
    })
    return {
      companyId,
      operationalRadiusMeters: DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS,
      updatedAt: new Date(0).toISOString(),
    }
  }

  if (!data) {
    return {
      companyId,
      operationalRadiusMeters: DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS,
      updatedAt: new Date(0).toISOString(),
    }
  }

  const radius = Number(data.operational_radius_meters)
  return {
    companyId: data.company_id,
    operationalRadiusMeters:
      Number.isFinite(radius) && radius > 0
        ? Math.round(radius)
        : DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS,
    updatedAt: data.updated_at,
  }
}

/**
 * Ensures a settings row exists (idempotent). Used when admins later configure
 * the radius; Presence 1.0 reads the default without requiring a row.
 */
export async function ensurePresenceEngineSettings(
  companyId: string,
  operationalRadiusMeters: number = DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS
): Promise<PresenceEngineSettings> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("presence_engine_settings")
    .upsert(
      {
        company_id: companyId,
        operational_radius_meters: operationalRadiusMeters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    )
    .select("company_id, operational_radius_meters, updated_at")
    .single()

  if (error || !data) {
    throw new Error(
      error?.message ?? "No se pudo persistir presence_engine_settings."
    )
  }

  return {
    companyId: data.company_id,
    operationalRadiusMeters: data.operational_radius_meters,
    updatedAt: data.updated_at,
  }
}
