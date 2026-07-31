import "server-only"

import {
  recordAttentionCreatedActivity,
  recordAttentionResolvedActivity,
  recordAttentionStatusChangedActivity,
  recordAttentionTransferredActivity,
  recordAttentionUpdatedActivity,
  recordAttentionWorkOrderGeneratedActivity,
} from "@/lib/activity/domain/attention-activity"
import type { ActivityActorContext } from "@/lib/activity/resolve-activity-actor"
import {
  buildCaseClosedActivity,
  buildCaseCreatedActivity,
  buildCustomerInteractionActivity,
  buildDerivationCreatedActivity,
  buildFollowUpCreatedActivity,
  buildNextStepChangedActivity,
  buildNoteCreatedActivity,
  buildOtCreatedActivity,
  buildStatusChangedActivity,
  resolveDerivationAreas,
} from "@/lib/customer-atenciones/customer-activity-events"
import {
  buildCustomerInteractionActivityDescription,
  buildCustomerInteractionActivityTitle,
  isCustomerInteractionMedium,
  type CustomerInteractionMedium,
} from "@/lib/customer-atenciones/customer-interaction-catalog"
import { registerCustomerActivitySafe } from "@/lib/customer-atenciones/register-customer-activity"
import type { ConsultationManagementRpcResult } from "@/lib/customer-atenciones/consultation-management"
import type { ConsultationInteractionRpcResult } from "@/lib/customer-atenciones/consultation-interaction-management"
import type { OtLinkRpcResult } from "@/lib/customer-atenciones/ot-link"
import { createAdminClient } from "@/lib/supabase/admin"

function attentionActor(
  companyId: string,
  employeeId?: string | null
): ActivityActorContext {
  return {
    companyId,
    employeeId: employeeId ?? null,
    appUserId: null,
  }
}

async function resolveEmployeeDisplayName(
  employeeId: string
): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("employees")
    .select("first_name, last_name, preferred_name")
    .eq("id", employeeId)
    .maybeSingle()

  if (!data) {
    return "Un operador"
  }

  const preferred =
    typeof data.preferred_name === "string" ? data.preferred_name.trim() : ""
  if (preferred) {
    return preferred
  }

  const full = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim()
  return full || "Un operador"
}

async function resolveAtencionCustomerId(
  atencionId: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("customer_atenciones")
    .select("customer_id")
    .eq("id", atencionId)
    .maybeSingle()

  return typeof data?.customer_id === "string" ? data.customer_id : null
}

export async function emitCustomerCaseCreatedActivity(input: {
  companyId: string
  entityId: string
  employeeId?: string | null
  customerId: string
  motivo: string
  canal: string
  estadoInicial: string
  prioridad?: string | null
  nextStep?: string | null
  actor?: ActivityActorContext | null
}): Promise<void> {
  const payload = buildCaseCreatedActivity({
    customerId: input.customerId,
    motivo: input.motivo,
    canal: input.canal,
    estadoInicial: input.estadoInicial,
    prioridad: input.prioridad,
    nextStep: input.nextStep,
  })
  await registerCustomerActivitySafe({
    companyId: input.companyId,
    entityId: input.entityId,
    employeeId: input.employeeId,
    ...payload,
  })
  const actor =
    input.actor ?? attentionActor(input.companyId, input.employeeId)
  void recordAttentionCreatedActivity({
    actor,
    attentionId: input.entityId,
    status: input.estadoInicial,
  })
}

export async function emitCustomerFollowUpCreatedActivity(input: {
  companyId: string
  entityId: string
  employeeId?: string | null
  seguimientoId: string
  tipo?: string | null
  resultado?: string | null
  nextStep?: string | null
}): Promise<void> {
  const payload = buildFollowUpCreatedActivity({
    seguimientoId: input.seguimientoId,
    tipo: input.tipo,
    resultado: input.resultado,
    nextStep: input.nextStep,
  })
  await registerCustomerActivitySafe({
    companyId: input.companyId,
    entityId: input.entityId,
    employeeId: input.employeeId,
    ...payload,
  })
}

export async function emitCustomerManagementActivities(input: {
  companyId: string
  employeeId: string
  result: ConsultationManagementRpcResult
  detail?: string | null
  resolution?: string | null
  kind: "resolve" | "defer" | "start"
  actor?: ActivityActorContext | null
}): Promise<void> {
  const { result, companyId, employeeId } = input
  const base = {
    companyId,
    entityId: result.atencionId,
    employeeId,
  }
  const actor = input.actor ?? attentionActor(companyId, employeeId)

  if (result.previousStatus !== result.newStatus) {
    const payload = buildStatusChangedActivity({
      oldStatus: result.previousStatus,
      newStatus: result.newStatus,
    })
    await registerCustomerActivitySafe({ ...base, ...payload })
  }

  if (result.previousNextStep !== result.newNextStep) {
    const payload = buildNextStepChangedActivity({
      previousNextStep: result.previousNextStep,
      newNextStep: result.newNextStep,
    })
    await registerCustomerActivitySafe({ ...base, ...payload })
  }

  if (input.kind === "defer") {
    const areas = resolveDerivationAreas({
      previousNextStep: result.previousNextStep,
      newNextStep: result.newNextStep,
    })
    if (areas) {
      const payload = buildDerivationCreatedActivity({
        fromArea: areas.fromArea,
        toArea: areas.toArea,
        motivo: input.detail ?? null,
      })
      await registerCustomerActivitySafe({ ...base, ...payload })
      void recordAttentionTransferredActivity({
        actor,
        attentionId: result.atencionId,
        oldEmployeeId: null,
        newEmployeeId: employeeId,
      })
    }
  }

  if (input.kind === "resolve" && result.newStatus === "resuelta") {
    const payload = buildCaseClosedActivity({
      resultado: "resuelta",
      motivoCierre: input.resolution ?? null,
    })
    await registerCustomerActivitySafe({ ...base, ...payload })
    void recordAttentionResolvedActivity({
      actor,
      attentionId: result.atencionId,
      oldStatus: result.previousStatus,
    })
  } else if (result.previousStatus !== result.newStatus) {
    void recordAttentionStatusChangedActivity({
      actor,
      attentionId: result.atencionId,
      oldStatus: result.previousStatus,
      newStatus: result.newStatus,
    })
  } else if (
    result.previousNextStep !== result.newNextStep &&
    input.kind !== "defer"
  ) {
    void recordAttentionUpdatedActivity({
      actor,
      attentionId: result.atencionId,
      changedFields: ["nextStep"],
    })
  }
}

export async function emitCustomerInteractionActivities(input: {
  companyId: string
  employeeId: string
  interactionKind: string
  detail: string
  interactionResult?: string | null
  nextActionAt?: string | null
  result: ConsultationInteractionRpcResult
  actor?: ActivityActorContext | null
  /** Sprint 1.1C — when present, emit CUSTOMER_INTERACTION instead of FOLLOW_UP. */
  clientInteraction?: {
    medio: string
    nextStep?: string | null
    customerId?: string | null
  } | null
}): Promise<void> {
  const base = {
    companyId: input.companyId,
    entityId: input.result.atencionId,
    employeeId: input.employeeId,
  }
  const actor =
    input.actor ?? attentionActor(input.companyId, input.employeeId)

  void recordAttentionUpdatedActivity({
    actor,
    attentionId: input.result.atencionId,
    changedFields: [input.interactionKind || "interaction"],
  })

  if (input.interactionKind === "note") {
    const payload = buildNoteCreatedActivity({
      length: input.detail.trim().length,
      hasAttachments: false,
    })
    await registerCustomerActivitySafe({ ...base, ...payload })
    return
  }

  if (input.interactionKind === "contact") {
    const medioRaw = input.clientInteraction?.medio?.trim() ?? ""
    const medium: CustomerInteractionMedium = isCustomerInteractionMedium(
      medioRaw
    )
      ? medioRaw
      : "otro"
    const resultado =
      input.interactionResult?.trim() ||
      input.clientInteraction?.medio ||
      "otro"
    const employeeName = await resolveEmployeeDisplayName(input.employeeId)
    const customerId =
      input.clientInteraction?.customerId?.trim() ||
      (await resolveAtencionCustomerId(input.result.atencionId))
    const nextStep =
      input.clientInteraction?.nextStep?.trim() ||
      input.result.nextStep ||
      null

    const title = buildCustomerInteractionActivityTitle(medium)
    const description = buildCustomerInteractionActivityDescription({
      employeeName,
      medium,
      result: resultado,
    })
    const payload = buildCustomerInteractionActivity({
      title,
      description,
      medio: medium,
      resultado,
      nextStep,
      expedienteId: input.result.atencionId,
      customerId,
    })
    await registerCustomerActivitySafe({ ...base, ...payload })
    return
  }

  if (input.interactionKind === "process") {
    const payload = buildFollowUpCreatedActivity({
      seguimientoId: input.result.eventId,
      tipo: input.interactionKind,
      resultado: input.interactionResult ?? null,
      nextStep: input.result.nextStep,
    })
    await registerCustomerActivitySafe({ ...base, ...payload })
  }
}

export async function emitCustomerOtLinkedActivity(input: {
  companyId: string
  employeeId: string
  result: OtLinkRpcResult
  actor?: ActivityActorContext | null
}): Promise<void> {
  const admin = createAdminClient()
  const actor =
    input.actor ?? attentionActor(input.companyId, input.employeeId)
  const { data: task } = await admin
    .from("tasks")
    .select("id, project_id, priority")
    .eq("id", input.result.linkedTaskId)
    .maybeSingle()

  const otPayload = buildOtCreatedActivity({
    taskId: input.result.linkedTaskId,
    projectId: task?.project_id ?? null,
    technology: null,
    priority: task?.priority ?? null,
  })
  await registerCustomerActivitySafe({
    companyId: input.companyId,
    entityId: input.result.atencionId,
    employeeId: input.employeeId,
    ...otPayload,
  })

  void recordAttentionWorkOrderGeneratedActivity({
    actor,
    attentionId: input.result.atencionId,
    workOrderId: input.result.linkedTaskId,
  })

  const { data: atencion } = await admin
    .from("customer_atenciones")
    .select("status, resultado, resolution")
    .eq("id", input.result.atencionId)
    .maybeSingle()

  if (atencion?.status === "resuelta") {
    const closed = buildCaseClosedActivity({
      resultado: atencion.resultado ?? "ot_creada",
      motivoCierre: atencion.resolution || "Consulta vinculada a OT",
    })
    await registerCustomerActivitySafe({
      companyId: input.companyId,
      entityId: input.result.atencionId,
      employeeId: input.employeeId,
      ...closed,
    })
    void recordAttentionResolvedActivity({
      actor,
      attentionId: input.result.atencionId,
      oldStatus: null,
    })
  }
}
