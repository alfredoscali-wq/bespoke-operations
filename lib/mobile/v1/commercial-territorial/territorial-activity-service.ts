import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  createCommercialTerritorialActivity,
  getCommercialTerritorialActivityById,
  listCommercialTerritorialActivities,
} from "@/lib/supabase/commercial-territorial-activities.queries"
import { listCommercialTerritorialActivityTypes } from "@/lib/supabase/commercial-territorial-activity-types.queries"
import { uploadAttachment } from "@/lib/attachments/service.server"
import type {
  CommercialTerritorialActivity,
  CommercialTerritorialActivityType,
  CreateCommercialTerritorialActivityInput,
} from "@/lib/types/commercial-territorial-activity"

export function validateMobileCreateTerritorialActivityRequest(
  body: unknown
): CreateCommercialTerritorialActivityInput {
  if (!body || typeof body !== "object") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Cuerpo JSON inválido.",
      400
    )
  }

  const raw = body as Record<string, unknown>
  const activityTypeId =
    typeof raw.activityTypeId === "string" ? raw.activityTypeId.trim() : ""
  const description =
    typeof raw.description === "string" ? raw.description.trim() : ""
  const observations =
    typeof raw.observations === "string" ? raw.observations : ""
  const latitude = Number(raw.latitude)
  const longitude = Number(raw.longitude)
  const locationSource =
    typeof raw.locationSource === "string" ? raw.locationSource : "gps"

  if (!activityTypeId) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "activityTypeId es obligatorio.",
      400
    )
  }
  if (!description) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "description es obligatorio.",
      400
    )
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "latitude y longitude son obligatorios.",
      400
    )
  }

  return {
    activityTypeId,
    description,
    observations,
    latitude,
    longitude,
    locationSource,
  }
}

export async function listMobileTerritorialActivityTypes(
  auth: MobileAuthContext
): Promise<CommercialTerritorialActivityType[]> {
  const client = createAdminClient()
  const result = await listCommercialTerritorialActivityTypes(
    client,
    auth.companyId,
    { activeOnly: true }
  )
  if (result.error || !result.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      result.error?.message ?? "No se pudieron listar los tipos.",
      500
    )
  }
  return result.data
}

export async function listMobileTerritorialActivities(
  auth: MobileAuthContext
): Promise<CommercialTerritorialActivity[]> {
  const client = createAdminClient()
  const result = await listCommercialTerritorialActivities(
    client,
    auth.companyId,
    { limit: 200 }
  )
  if (result.error || !result.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      result.error?.message ?? "No se pudieron listar las actividades.",
      500
    )
  }
  return result.data
}

export async function createMobileTerritorialActivity(
  auth: MobileAuthContext,
  input: CreateCommercialTerritorialActivityInput
): Promise<CommercialTerritorialActivity> {
  const client = createAdminClient()
  const result = await createCommercialTerritorialActivity(
    client,
    auth.companyId,
    input,
    { employeeId: auth.employeeId }
  )
  if (result.error || !result.data) {
    throw new MobileApiError(
      result.error?.code === "VALIDATION" ? "INVALID_REQUEST" : "INTERNAL_ERROR",
      result.error?.message ?? "No se pudo crear la actividad.",
      result.error?.code === "VALIDATION" ? 400 : 500
    )
  }
  return result.data
}

export async function uploadMobileTerritorialActivityPhoto(
  auth: MobileAuthContext,
  activityId: string,
  file: File
): Promise<{ attachmentId: string }> {
  const client = createAdminClient()
  const existing = await getCommercialTerritorialActivityById(
    client,
    auth.companyId,
    activityId
  )
  if (existing.error || !existing.data) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      existing.error?.message ?? "Actividad no encontrada.",
      404
    )
  }

  const result = await uploadAttachment({
    companyId: auth.companyId,
    module: "commercial",
    recordId: activityId,
    timelineEventId: null,
    uploadedBy: auth.employeeId,
    file,
    originalName: file.name,
    mimeType: file.type || "image/jpeg",
    fileSize: file.size,
  })

  if (result.error || !result.data) {
    throw new MobileApiError(
      "INTERNAL_ERROR",
      result.error?.message ?? "No se pudo subir la foto.",
      500
    )
  }

  return { attachmentId: result.data.id }
}
