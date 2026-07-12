import type { CustomerAtencionNextStep } from "@/lib/types/customer-atenciones"
import type { ConsultationManagementRpcResult } from "@/lib/customer-atenciones/consultation-management"

export type ConsultationManagementApiResponse =
  | {
      success: true
      atencionId: string
      previousStatus: string
      newStatus: string
      previousNextStep: CustomerAtencionNextStep | null
      newNextStep: CustomerAtencionNextStep | null
      idempotent?: boolean
    }
  | {
      success: false
      message: string
      code?: string
    }

export type ConsultationManagementMutationResult =
  | { success: true; data: ConsultationManagementRpcResult }
  | { success: false; message: string; code?: string }

async function postConsultationManagement(
  path: string,
  body?: Record<string, unknown>
): Promise<ConsultationManagementMutationResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = (await response.json().catch(() => null)) as
    | ConsultationManagementApiResponse
    | null

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      message:
        payload && payload.success === false
          ? payload.message
          : "No se pudo completar la acción sobre la Consulta.",
      code:
        payload && payload.success === false ? payload.code : undefined,
    }
  }

  return {
    success: true,
    data: {
      atencionId: payload.atencionId,
      previousStatus: payload.previousStatus as ConsultationManagementRpcResult["previousStatus"],
      newStatus: payload.newStatus as ConsultationManagementRpcResult["newStatus"],
      previousNextStep: payload.previousNextStep,
      newNextStep: payload.newNextStep,
      idempotent: payload.idempotent,
    },
  }
}

export function startConsultationManagement(
  atencionId: string
): Promise<ConsultationManagementMutationResult> {
  return postConsultationManagement(
    `/api/atencion-cliente/${atencionId}/start-management`
  )
}

export function resolveConsultationManagement(
  atencionId: string,
  resolution: string
): Promise<ConsultationManagementMutationResult> {
  return postConsultationManagement(`/api/atencion-cliente/${atencionId}/resolve`, {
    resolution,
  })
}

export function deferConsultationManagement(
  atencionId: string,
  nextStep: CustomerAtencionNextStep
): Promise<ConsultationManagementMutationResult> {
  return postConsultationManagement(`/api/atencion-cliente/${atencionId}/defer`, {
    nextStep,
  })
}
