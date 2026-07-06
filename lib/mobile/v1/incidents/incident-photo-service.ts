import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import type {
  MobileIncidentPhotoUploadRequest,
  MobileIncidentPhotoUploadResponse,
} from "@/lib/mobile/v1/incidents/types"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadTaskIncidentPhoto } from "@/lib/supabase/task-incident-photos.queries"
import {
  getTaskIncidentByIdService,
} from "@/lib/task-incidents/task-incident.service"
import { TaskIncidentError } from "@/lib/task-incidents/task-incident-errors"

async function assertMobileIncidentPhotoAccess(
  auth: MobileAuthContext,
  incidentId: string,
  deviceId: string
) {
  const admin = createAdminClient()

  try {
    const incident = await getTaskIncidentByIdService(
      {
        companyId: auth.companyId,
        actorEmployeeId: auth.employeeId,
        client: admin,
      },
      incidentId
    )

    if (incident.companyId !== auth.companyId) {
      throw new MobileApiError(
        "INCIDENT_NOT_FOUND",
        "Incidencia no encontrada.",
        404
      )
    }

    if (incident.employeeId !== auth.employeeId) {
      await assertMobileTaskExecutionAccess(auth, incident.taskId, deviceId, {
        requireActiveShift: false,
      })
    }

    return { admin, incident }
  } catch (error) {
    if (error instanceof TaskIncidentError) {
      throw new MobileApiError(
        error.code === "NOT_FOUND" ? "INCIDENT_NOT_FOUND" : "UNAUTHORIZED",
        error.message,
        error.httpStatus
      )
    }

    throw error
  }
}

export async function uploadMobileIncidentPhoto(
  auth: MobileAuthContext,
  incidentId: string,
  request: MobileIncidentPhotoUploadRequest
): Promise<MobileIncidentPhotoUploadResponse> {
  const { admin, incident } = await assertMobileIncidentPhotoAccess(
    auth,
    incidentId,
    request.deviceId
  )

  console.debug("[Mobile API incident-photos]", {
    incidentId: incident.id,
    fileName: request.file.name,
    mimeType: request.file.type,
    fileSize: request.file.size,
    createdBy: auth.employeeId,
  })

  const uploadResult = await uploadTaskIncidentPhoto(admin, {
    companyId: auth.companyId,
    incidentId: incident.id,
    file: request.file,
    createdBy: auth.employeeId,
  })

  if (uploadResult.error || !uploadResult.data) {
    const errorCode =
      uploadResult.error?.code === "VALIDATION"
        ? "INVALID_REQUEST"
        : uploadResult.error?.code === "FORBIDDEN"
          ? "UNAUTHORIZED"
          : uploadResult.error?.code === "UPLOAD"
            ? "UPLOAD_FAILED"
            : "UPLOAD_FAILED"

    console.warn("[Mobile API incident-photos]", {
      incidentId: incident.id,
      errorCode,
      repositoryCode: uploadResult.error?.code,
      message: uploadResult.error?.message,
    })

    throw new MobileApiError(
      errorCode,
      uploadResult.error?.message ?? "No se pudo subir la fotografía.",
      errorCode === "UNAUTHORIZED" ? 403 : 400
    )
  }

  return {
    photoId: uploadResult.data.id,
    incidentId: incident.id,
    storagePath: uploadResult.data.storagePath,
    fileName: uploadResult.data.fileName ?? null,
    mimeType: uploadResult.data.mimeType ?? null,
    sizeBytes: uploadResult.data.sizeBytes ?? null,
  }
}
