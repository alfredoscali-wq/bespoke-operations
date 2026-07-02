import "server-only"

import { uploadTaskEvidencePhoto } from "@/lib/supabase/task-photos.queries"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import { appendChecklistPhotoId } from "@/lib/mobile/v1/tasks/task-checklist-service"
import type {
  MobileTaskChecklistPhotoRequest,
  MobileTaskChecklistPhotoResponse,
} from "@/lib/mobile/v1/tasks/types"

export async function uploadMobileTaskChecklistPhoto(
  auth: Parameters<typeof assertMobileTaskExecutionAccess>[0],
  taskId: string,
  request: MobileTaskChecklistPhotoRequest
): Promise<MobileTaskChecklistPhotoResponse> {
  const context = await assertMobileTaskExecutionAccess(
    auth,
    taskId,
    request.deviceId,
    { allowedStatuses: ["en-curso"] }
  )

  console.debug("[Mobile API checklist-photos]", {
    taskId: context.task.id,
    checklistItemId: request.checklistItemId,
    fileName: request.file.name,
    mimeType: request.file.type,
    fileSize: request.file.size,
    createdBy: context.auth.authUserId,
  })

  const uploadResult = await uploadTaskEvidencePhoto(context.admin, {
    taskId: context.task.id,
    file: request.file,
    description: `Checklist: ${request.checklistItemId}`,
    createdBy: context.auth.authUserId,
    operationalStepId: request.checklistItemId,
  })

  if (uploadResult.error || !uploadResult.data) {
    const errorCode =
      uploadResult.error?.code === "VALIDATION"
        ? "INVALID_REQUEST"
        : "UPLOAD_FAILED"

    console.warn("[Mobile API checklist-photos]", {
      taskId: context.task.id,
      checklistItemId: request.checklistItemId,
      errorCode,
      repositoryCode: uploadResult.error?.code,
      message: uploadResult.error?.message,
    })

    throw new MobileApiError(
      errorCode,
      uploadResult.error?.message ?? "No se pudo subir la fotografía.",
      400
    )
  }

  const checklist = await appendChecklistPhotoId(
    context,
    request.checklistItemId,
    uploadResult.data.id
  )

  return {
    photoId: uploadResult.data.id,
    checklistItemId: request.checklistItemId,
    checklist,
  }
}
