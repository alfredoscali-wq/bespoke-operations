import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  mapConsultationManagementRpcError,
  parseConsultationManagementRpcResult,
  type ConsultationManagementErrorCode,
  type ConsultationManagementRpcResult,
} from "@/lib/customer-atenciones/consultation-management"
import {
  CONSULTATION_HARD_DELETE_FAILED_MESSAGE,
  mapConsultationHardDeleteRpcError,
  parseConsultationHardDeleteRpcResult,
  type ConsultationHardDeleteErrorCode,
  type ConsultationHardDeleteRpcResult,
} from "@/lib/customer-atenciones/consultation-hard-delete"
import {
  mapMorosoTrackingRpcError,
  parseMorosoTrackingRpcResult,
  type MorosoTrackingErrorCode,
  type MorosoTrackingRpcResult,
} from "@/lib/customer-atenciones/moroso-management"
import {
  mapConsultationInteractionRpcError,
  parseConsultationInteractionRpcResult,
  type ConsultationInteractionErrorCode,
  type ConsultationInteractionRpcResult,
} from "@/lib/customer-atenciones/consultation-interaction-management"
import {
  mapOtLinkRpcError,
  parseOtLinkRpcResult,
  type OtLinkErrorCode,
  type OtLinkRpcResult,
} from "@/lib/customer-atenciones/ot-link"
import { logOperationError } from "@/lib/operations/user-messages"
import { startPerformanceTrace } from "@/lib/performance"
import {
  addReleaseExpiredTimer,
  getReleaseExpiredStore,
  recordReleaseExpiredQuery,
} from "@/lib/customer-service/performance/release-expired-breakdown"
import {
  emitCustomerInteractionActivities,
  emitCustomerManagementActivities,
  emitCustomerOtLinkedActivity,
} from "@/lib/customer-atenciones/emit-customer-activity"

export type ConsultationManagementServerResult =
  | { ok: true; data: ConsultationManagementRpcResult }
  | {
      ok: false
      status: number
      message: string
      code: ConsultationManagementErrorCode
    }

type AdminRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

async function resolveLatestConsultationEventId(input: {
  companyId: string
  atencionId: string
  employeeId: string
  actionTypes: string[]
}): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("customer_atencion_events")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("customer_atencion_id", input.atencionId)
    .eq("employee_id", input.employeeId)
    .in("action_type", input.actionTypes)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) {
    return null
  }

  return data.id
}

async function callConsultationManagementRpc(
  rpcName: string,
  args: Record<string, unknown>
): Promise<ConsultationManagementServerResult> {
  const perf = startPerformanceTrace(`ATENCION RPC ${rpcName}`, {
    layer: "backend",
  })
  try {
    const admin = createAdminClient()

    const { data, error } = await perf.span(
      "RPC",
      () => (admin as unknown as AdminRpcClient).rpc(rpcName, args),
      { name: rpcName }
    )

    if (error) {
      logOperationError("CONSULTATION MANAGEMENT", error)
      const mapped = mapConsultationManagementRpcError(error.message || "")
      perf.fail(error)
      return {
        ok: false,
        status: mapped.status,
        message: mapped.message,
        code: mapped.code,
      }
    }

    const parsed = perf.spanSync("Parse RPC", () =>
      parseConsultationManagementRpcResult(data)
    )
    if (!parsed) {
      perf.fail()
      return {
        ok: false,
        status: 500,
        message: "No se pudo completar la acción sobre la Consulta.",
        code: "RPC_EMPTY",
      }
    }

    perf.finish()
    return { ok: true, data: parsed }
  } catch (error) {
    perf.fail(error)
    throw error
  }
}

export async function startCustomerAtencionManagement(input: {
  companyId: string
  atencionId: string
  employeeId: string
}): Promise<ConsultationManagementServerResult> {
  const result = await callConsultationManagementRpc(
    "start_customer_atencion_management",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
    }
  )
  if (result.ok && !result.data.idempotent) {
    void emitCustomerManagementActivities({
      companyId: input.companyId,
      employeeId: input.employeeId,
      result: result.data,
      kind: "start",
    })
  }
  return result
}

export async function resolveCustomerAtencionConsultation(input: {
  companyId: string
  atencionId: string
  employeeId: string
  resolution: string
  followUpActions?: string[]
}): Promise<ConsultationManagementServerResult> {
  let result = await callConsultationManagementRpc(
    "resolve_customer_atencion_consultation",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
      p_resolution: input.resolution,
      p_follow_up_actions: input.followUpActions ?? [],
    }
  )
  if (result.ok) {
    const eventId = await resolveLatestConsultationEventId({
      companyId: input.companyId,
      atencionId: input.atencionId,
      employeeId: input.employeeId,
      actionTypes: ["consulta_resuelta"],
    })
    result = { ok: true, data: { ...result.data, eventId } }
    void emitCustomerManagementActivities({
      companyId: input.companyId,
      employeeId: input.employeeId,
      result: result.data,
      resolution: input.resolution,
      kind: "resolve",
    })
  }
  return result
}

export async function cancelCustomerAtencionManagement(input: {
  companyId: string
  atencionId: string
  employeeId: string
}): Promise<ConsultationManagementServerResult> {
  return callConsultationManagementRpc("cancel_customer_atencion_management", {
    p_company_id: input.companyId,
    p_atencion_id: input.atencionId,
    p_employee_id: input.employeeId,
  })
}

export async function touchCustomerAtencionManagementActivity(input: {
  companyId: string
  atencionId: string
  employeeId: string
}): Promise<ConsultationManagementServerResult> {
  return callConsultationManagementRpc(
    "touch_customer_atencion_management_activity",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
    }
  )
}

export async function releaseExpiredCustomerAtencionManagements(input: {
  companyId: string
}): Promise<
  | { ok: true; releasedCount: number; timeoutMinutes: number }
  | {
      ok: false
      status: number
      message: string
      code: ConsultationManagementErrorCode
    }
> {
  const admin = createAdminClient()

  const rpcStarted =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()
  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "release_expired_customer_atencion_managements",
    { p_company_id: input.companyId }
  )
  const rpcEnded =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()
  const rpcDuration = rpcEnded - rpcStarted

  // Sprint 31.0 — optional release-expired breakdown (no-op when inactive).
  if (getReleaseExpiredStore()) {
    addReleaseExpiredTimer("rpcMs", rpcDuration)
    recordReleaseExpiredQuery("rpc.release_expired", rpcDuration)
  }

  if (error) {
    logOperationError("CONSULTATION MANAGEMENT", error)
    const mapped = mapConsultationManagementRpcError(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message: mapped.message,
      code: mapped.code,
    }
  }

  const parseStarted =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null
  const releasedCount =
    typeof record?.released_count === "number" ? record.released_count : 0
  const timeoutMinutes =
    typeof record?.timeout_minutes === "number" ? record.timeout_minutes : 15
  const parseEnded =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now()
  if (getReleaseExpiredStore()) {
    addReleaseExpiredTimer("parseMs", parseEnded - parseStarted)
  }

  return { ok: true, releasedCount, timeoutMinutes }
}

export async function deferCustomerAtencionConsultation(input: {
  companyId: string
  atencionId: string
  employeeId: string
  nextStep: string
  detail?: string | null
}): Promise<ConsultationManagementServerResult> {
  let result = await callConsultationManagementRpc(
    "defer_customer_atencion_consultation",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
      p_next_step: input.nextStep,
      p_detail: input.detail ?? null,
    }
  )
  if (result.ok) {
    const eventId = await resolveLatestConsultationEventId({
      companyId: input.companyId,
      atencionId: input.atencionId,
      employeeId: input.employeeId,
      actionTypes: ["consulta_pendiente"],
    })
    result = { ok: true, data: { ...result.data, eventId } }
    void emitCustomerManagementActivities({
      companyId: input.companyId,
      employeeId: input.employeeId,
      result: result.data,
      detail: input.detail,
      kind: "defer",
    })
    if (result.data.newNextStep === "contactar_cliente") {
      try {
        const { deriveCommercialOpportunityFromCustomerService } = await import(
          "@/lib/commercial/derive-from-customer-service"
        )
        await deriveCommercialOpportunityFromCustomerService({
          companyId: input.companyId,
          atencionId: input.atencionId,
          employeeId: input.employeeId,
          detail: input.detail,
        })
      } catch (error) {
        logOperationError("COMMERCIAL DERIVATION", error)
      }
    }
  }
  return result
}

export type MorosoTrackingServerResult =
  | { ok: true; data: MorosoTrackingRpcResult }
  | {
      ok: false
      status: number
      message: string
      code: MorosoTrackingErrorCode
    }

async function callMorosoTrackingRpc(
  args: Record<string, unknown>
): Promise<MorosoTrackingServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "update_customer_atencion_moroso_tracking",
    args
  )

  if (error) {
    logOperationError("MOROSO TRACKING", error)
    const mapped = mapMorosoTrackingRpcError(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message: mapped.message,
      code: mapped.code,
    }
  }

  const parsed = parseMorosoTrackingRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: "No se pudo actualizar el seguimiento de morosos.",
      code: "RPC_EMPTY",
    }
  }

  return { ok: true, data: parsed }
}

export async function updateCustomerAtencionMorosoTracking(input: {
  companyId: string
  atencionId: string
  employeeId: string
  trackingStatus: string
}): Promise<MorosoTrackingServerResult> {
  return callMorosoTrackingRpc({
    p_company_id: input.companyId,
    p_atencion_id: input.atencionId,
    p_employee_id: input.employeeId,
    p_tracking_status: input.trackingStatus,
  })
}

export type ConsultationInteractionServerResult =
  | { ok: true; data: ConsultationInteractionRpcResult }
  | {
      ok: false
      status: number
      message: string
      code: ConsultationInteractionErrorCode
    }

export async function registerCustomerAtencionInteraction(input: {
  companyId: string
  atencionId: string
  employeeId: string
  interactionKind: string
  interactionResult?: string | null
  detail: string
  nextActionAt?: string | null
  clientInteraction?: {
    medio: string
    nextStep?: string | null
    customerId?: string | null
  } | null
}): Promise<ConsultationInteractionServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "register_customer_atencion_interaction",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
      p_interaction_kind: input.interactionKind,
      p_interaction_result: input.interactionResult ?? null,
      p_detail: input.detail,
      p_next_action_at: input.nextActionAt ?? null,
    }
  )

  if (error) {
    logOperationError("CONSULTATION INTERACTION", error)
    const mapped = mapConsultationInteractionRpcError(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message: mapped.message,
      code: mapped.code,
    }
  }

  const parsed = parseConsultationInteractionRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: "No se pudo registrar la interacción.",
      code: "RPC_EMPTY",
    }
  }

  void emitCustomerInteractionActivities({
    companyId: input.companyId,
    employeeId: input.employeeId,
    interactionKind: input.interactionKind,
    detail: input.detail,
    interactionResult: input.interactionResult,
    nextActionAt: input.nextActionAt,
    result: parsed,
    clientInteraction: input.clientInteraction ?? null,
  })

  const derivedNextStep =
    input.clientInteraction?.nextStep?.trim() || parsed.nextStep
  if (derivedNextStep === "contactar_cliente") {
    try {
      const { deriveCommercialOpportunityFromCustomerService } = await import(
        "@/lib/commercial/derive-from-customer-service"
      )
      await deriveCommercialOpportunityFromCustomerService({
        companyId: input.companyId,
        atencionId: input.atencionId,
        employeeId: input.employeeId,
        detail: input.detail,
      })
    } catch (error) {
      logOperationError("COMMERCIAL DERIVATION", error)
    }
  }

  return { ok: true, data: parsed }
}

export type OtLinkServerResult =
  | { ok: true; data: OtLinkRpcResult }
  | {
      ok: false
      status: number
      message: string
      code: OtLinkErrorCode
    }

export async function linkCustomerAtencionToTask(input: {
  companyId: string
  atencionId: string
  employeeId: string
  taskId: string
}): Promise<OtLinkServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "link_customer_atencion_to_task",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
      p_task_id: input.taskId,
    }
  )

  if (error) {
    logOperationError("OT LINK", error)
    const mapped = mapOtLinkRpcError(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message: mapped.message,
      code: mapped.code,
    }
  }

  const parsed = parseOtLinkRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: "No se pudo vincular la OT a la consulta.",
      code: "RPC_EMPTY",
    }
  }

  void emitCustomerOtLinkedActivity({
    companyId: input.companyId,
    employeeId: input.employeeId,
    result: parsed,
  })

  return { ok: true, data: parsed }
}

export type ConsultationHardDeleteServerResult =
  | { ok: true; data: ConsultationHardDeleteRpcResult }
  | {
      ok: false
      status: number
      message: string
      code: ConsultationHardDeleteErrorCode
    }

export async function hardDeleteCustomerAtencionConsultation(input: {
  companyId: string
  atencionId: string
  employeeId: string
}): Promise<ConsultationHardDeleteServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "hard_delete_customer_atencion_consultation",
    {
      p_company_id: input.companyId,
      p_atencion_id: input.atencionId,
      p_employee_id: input.employeeId,
    }
  )

  if (error) {
    logOperationError("CONSULTATION HARD DELETE", error)
    const mapped = mapConsultationHardDeleteRpcError(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message: mapped.message,
      code: mapped.code,
    }
  }

  const parsed = parseConsultationHardDeleteRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: CONSULTATION_HARD_DELETE_FAILED_MESSAGE,
      code: "RPC_EMPTY",
    }
  }

  return { ok: true, data: parsed }
}
