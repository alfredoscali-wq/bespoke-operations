import "server-only"

import { recordTaskMobileWorkflowAudit } from "@/lib/audit/tasks-audit.server"
import {
  buildTaskMetadataWithResponses,
  fetchOperationalChecklistTemplate,
  mergeChecklistResponseValue,
  mergeChecklistWithResponses,
  readOperationalChecklistResponses,
} from "@/lib/mobile/v1/tasks/checklist-execution"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import { assertMobileTaskExecutionNotBlockedByActiveIncident } from "@/lib/mobile/v1/tasks/task-active-incident-guard"
import type {
  MobileTaskChecklistItem,
  MobileTaskChecklistResponseRequest,
  MobileTaskChecklistResponseUpdate,
} from "@/lib/mobile/v1/tasks/types"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Json } from "@/lib/supabase/database.types"

function findTemplateItem(
  template: Awaited<ReturnType<typeof fetchOperationalChecklistTemplate>>,
  itemId: string
) {
  return template.find((item) => item.id === itemId) ?? null
}

async function persistChecklistResponses(
  context: Awaited<ReturnType<typeof assertMobileTaskExecutionAccess>>,
  responses: ReturnType<typeof readOperationalChecklistResponses>
): Promise<MobileTaskChecklistItem[]> {
  const template = await fetchOperationalChecklistTemplate(
    context.admin,
    context.auth.companyId,
    context.task.serviceType
  )

  const { data, error } = await context.admin
    .from("tasks")
    .update({
      task_metadata: buildTaskMetadataWithResponses(
        context.task,
        responses
      ) as Json,
    })
    .eq("id", context.task.id)
    .eq("company_id", context.auth.companyId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error || !data) {
    throw error ?? new Error("TASK_UPDATE_FAILED")
  }

  return mergeChecklistWithResponses(template, responses)
}

export async function updateMobileTaskChecklistResponse(
  auth: Parameters<typeof assertMobileTaskExecutionAccess>[0],
  taskId: string,
  request: MobileTaskChecklistResponseRequest
): Promise<MobileTaskChecklistResponseUpdate> {
  const context = await assertMobileTaskExecutionAccess(
    auth,
    taskId,
    request.deviceId,
    { allowedStatuses: ["en-curso"] }
  )

  await assertMobileTaskExecutionNotBlockedByActiveIncident(context)

  const template = await fetchOperationalChecklistTemplate(
    context.admin,
    context.auth.companyId,
    context.task.serviceType
  )

  const templateItem = findTemplateItem(template, request.itemId)

  if (!templateItem) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Ítem de checklist no válido.",
      400
    )
  }

  const currentResponses = readOperationalChecklistResponses(context.task)
  const currentValue = currentResponses[request.itemId]

  if (templateItem.fieldType === "confirmacion") {
    if (request.confirmed === undefined) {
      throw new MobileApiError(
        "INVALID_REQUEST",
        "Debe indicar la confirmación.",
        400
      )
    }
  }

  if (templateItem.fieldType === "entrada-datos") {
    if (request.textValue === undefined) {
      throw new MobileApiError(
        "INVALID_REQUEST",
        "Debe ingresar un valor.",
        400
      )
    }
  }

  if (templateItem.fieldType === "fotografia") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Las fotografías se cargan desde la cámara o galería.",
      400
    )
  }

  const nextResponses = {
    ...currentResponses,
    [request.itemId]: mergeChecklistResponseValue(currentValue, {
      ...(request.confirmed !== undefined ? { confirmed: request.confirmed } : {}),
      ...(request.textValue !== undefined
        ? { textValue: request.textValue?.trim() || "" }
        : {}),
    }),
  }

  const checklist = await persistChecklistResponses(context, nextResponses)
  const updatedTask = mapTaskRowToTask(
    (
      await context.admin
        .from("tasks")
        .select("*")
        .eq("id", context.task.id)
        .maybeSingle()
    ).data!
  )

  try {
    await recordTaskMobileWorkflowAudit({
      auth: context.auth,
      before: context.task,
      after: updatedTask,
      workflowAction: "checklist-response",
      workTeamId: context.workTeamId,
      workTeamName: context.workTeamName,
      mobileDeviceId: context.mobileDeviceId,
      note: `Checklist: ${templateItem.title}`,
    })
  } catch {
    // Non-blocking audit.
  }

  return {
    id: updatedTask.id,
    status: updatedTask.status,
    checklist,
  }
}

export async function appendChecklistPhotoId(
  context: Awaited<ReturnType<typeof assertMobileTaskExecutionAccess>>,
  checklistItemId: string,
  photoId: string
): Promise<MobileTaskChecklistItem[]> {
  const template = await fetchOperationalChecklistTemplate(
    context.admin,
    context.auth.companyId,
    context.task.serviceType
  )

  const templateItem = findTemplateItem(template, checklistItemId)

  if (!templateItem || templateItem.fieldType !== "fotografia") {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Ítem de checklist no válido para fotografía.",
      400
    )
  }

  const currentResponses = readOperationalChecklistResponses(context.task)
  const currentValue = currentResponses[checklistItemId]
  const photoIds = Array.from(
    new Set([...(currentValue?.photoIds ?? []), photoId])
  )

  const nextResponses = {
    ...currentResponses,
    [checklistItemId]: mergeChecklistResponseValue(currentValue, { photoIds }),
  }

  return persistChecklistResponses(context, nextResponses)
}
