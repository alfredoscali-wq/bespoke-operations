import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  mapConsultationManagementRpcError,
  parseConsultationManagementRpcResult,
  type ConsultationManagementErrorCode,
  type ConsultationManagementRpcResult,
} from "@/lib/customer-atenciones/consultation-management"
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
