import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  mapConsultationManagementRpcError,
  parseConsultationManagementRpcResult,
  type ConsultationManagementErrorCode,
  type ConsultationManagementRpcResult,
} from "@/lib/customer-atenciones/consultation-management"
import {
  mapMorosoTrackingRpcError,
  parseMorosoTrackingRpcResult,
  type MorosoTrackingErrorCode,
  type MorosoTrackingRpcResult,
} from "@/lib/customer-atenciones/moroso-management"
import {
  mapOtLinkRpcError,
  parseOtLinkRpcResult,
  type OtLinkErrorCode,
  type OtLinkRpcResult,
} from "@/lib/customer-atenciones/ot-link"
import { logOperationError } from "@/lib/operations/user-messages"

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

async function callConsultationManagementRpc(
  rpcName: string,
  args: Record<string, unknown>
): Promise<ConsultationManagementServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    rpcName,
    args
  )

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

  const parsed = parseConsultationManagementRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: "No se pudo completar la acción sobre la Consulta.",
      code: "RPC_EMPTY",
    }
  }

  return { ok: true, data: parsed }
}

export async function startCustomerAtencionManagement(input: {
  companyId: string
  atencionId: string
  employeeId: string
}): Promise<ConsultationManagementServerResult> {
  return callConsultationManagementRpc("start_customer_atencion_management", {
    p_company_id: input.companyId,
    p_atencion_id: input.atencionId,
    p_employee_id: input.employeeId,
  })
}

export async function resolveCustomerAtencionConsultation(input: {
  companyId: string
  atencionId: string
  employeeId: string
  resolution: string
}): Promise<ConsultationManagementServerResult> {
  return callConsultationManagementRpc("resolve_customer_atencion_consultation", {
    p_company_id: input.companyId,
    p_atencion_id: input.atencionId,
    p_employee_id: input.employeeId,
    p_resolution: input.resolution,
  })
}

export async function deferCustomerAtencionConsultation(input: {
  companyId: string
  atencionId: string
  employeeId: string
  nextStep: string
  detail?: string | null
}): Promise<ConsultationManagementServerResult> {
  return callConsultationManagementRpc("defer_customer_atencion_consultation", {
    p_company_id: input.companyId,
    p_atencion_id: input.atencionId,
    p_employee_id: input.employeeId,
    p_next_step: input.nextStep,
    p_detail: input.detail ?? null,
  })
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

  return { ok: true, data: parsed }
}
