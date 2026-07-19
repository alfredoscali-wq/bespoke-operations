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
  resolution: string,
  followUpActions: string[] = []
): Promise<ConsultationManagementMutationResult> {
  return postConsultationManagement(`/api/atencion-cliente/${atencionId}/resolve`, {
    resolution,
    followUpActions,
  })
}

export function cancelConsultationManagement(
  atencionId: string
): Promise<ConsultationManagementMutationResult> {
  return postConsultationManagement(
    `/api/atencion-cliente/${atencionId}/cancel-management`
  )
}

export function touchConsultationManagementActivity(
  atencionId: string
): Promise<ConsultationManagementMutationResult> {
  return postConsultationManagement(
    `/api/atencion-cliente/${atencionId}/touch-management`
  )
}

export async function releaseExpiredConsultationManagements(): Promise<
  | { success: true; releasedCount: number; timeoutMinutes: number }
  | { success: false; message: string; code?: string }
> {
  const response = await fetch(
    "/api/atencion-cliente/release-expired-managements",
    { method: "POST" }
  )

  const payload = (await response.json().catch(() => null)) as
    | {
        success: true
        releasedCount: number
        timeoutMinutes: number
      }
    | {
        success: false
        message: string
        code?: string
      }
    | null

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      message:
        payload && payload.success === false
          ? payload.message
          : "No se pudieron liberar gestiones expiradas.",
      code:
        payload && payload.success === false ? payload.code : undefined,
    }
  }

  return {
    success: true,
    releasedCount: payload.releasedCount,
    timeoutMinutes: payload.timeoutMinutes,
  }
}

export function deferConsultationManagement(
  atencionId: string,
  nextStep: CustomerAtencionNextStep,
  detail?: string
): Promise<ConsultationManagementMutationResult> {
  const body: Record<string, unknown> = { nextStep }
  if (detail !== undefined) {
    body.detail = detail
  }

  return postConsultationManagement(`/api/atencion-cliente/${atencionId}/defer`, body)
}

export type MorosoTrackingApiResponse =
  | {
      success: true
      atencionId: string
      previousTrackingStatus: string | null
      newTrackingStatus: string
    }
  | {
      success: false
      message: string
      code?: string
    }

export type MorosoTrackingMutationResult =
  | {
      success: true
      atencionId: string
      previousTrackingStatus: string | null
      newTrackingStatus: string
    }
  | { success: false; message: string; code?: string }

export async function updateMorosoTrackingManagement(
  atencionId: string,
  trackingStatus: string
): Promise<MorosoTrackingMutationResult> {
  const response = await fetch(`/api/atencion-cliente/${atencionId}/moroso-tracking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingStatus }),
  })

  const payload = (await response.json().catch(() => null)) as
    | MorosoTrackingApiResponse
    | null

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      message:
        payload && payload.success === false
          ? payload.message
          : "No se pudo actualizar el seguimiento de morosos.",
      code:
        payload && payload.success === false ? payload.code : undefined,
    }
  }

  return {
    success: true,
    atencionId: payload.atencionId,
    previousTrackingStatus: payload.previousTrackingStatus,
    newTrackingStatus: payload.newTrackingStatus,
  }
}

export type OtLinkApiResponse =
  | {
      success: true
      atencionId: string
      linkedTaskId: string
      linkedTaskCode: string
      otLinkedAt: string
      otLinkedByEmployeeId: string
    }
  | {
      success: false
      message: string
      code?: string
    }

export type OtLinkMutationResult =
  | {
      success: true
      atencionId: string
      linkedTaskId: string
      linkedTaskCode: string
      otLinkedAt: string
      otLinkedByEmployeeId: string
    }
  | { success: false; message: string; code?: string }

export async function linkConsultationOtManagement(
  atencionId: string,
  taskId: string
): Promise<OtLinkMutationResult> {
  const response = await fetch(`/api/atencion-cliente/${atencionId}/link-ot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId }),
  })

  const payload = (await response.json().catch(() => null)) as
    | OtLinkApiResponse
    | null

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      message:
        payload && payload.success === false
          ? payload.message
          : "No se pudo vincular la OT a la consulta.",
      code:
        payload && payload.success === false ? payload.code : undefined,
    }
  }

  return {
    success: true,
    atencionId: payload.atencionId,
    linkedTaskId: payload.linkedTaskId,
    linkedTaskCode: payload.linkedTaskCode,
    otLinkedAt: payload.otLinkedAt,
    otLinkedByEmployeeId: payload.otLinkedByEmployeeId,
  }
}

export type ConsultationHardDeleteApiResponse =
  | {
      success: true
      atencionId: string
      deletedEvents: number
      clearedSeguimientos: number
    }
  | {
      success: false
      message: string
      code?: string
    }

export type ConsultationHardDeleteMutationResult =
  | {
      success: true
      atencionId: string
      deletedEvents: number
      clearedSeguimientos: number
    }
  | { success: false; message: string; code?: string }

export async function permanentDeleteConsultationManagement(
  atencionId: string
): Promise<ConsultationHardDeleteMutationResult> {
  const response = await fetch(
    `/api/atencion-cliente/${atencionId}/permanent-delete`,
    {
      method: "POST",
    }
  )

  const payload = (await response.json().catch(() => null)) as
    | ConsultationHardDeleteApiResponse
    | null

  if (!response.ok || !payload || payload.success !== true) {
    return {
      success: false,
      message:
        payload && payload.success === false
          ? payload.message
          : "No se pudo eliminar la consulta. Intente nuevamente.",
      code:
        payload && payload.success === false ? payload.code : undefined,
    }
  }

  return {
    success: true,
    atencionId: payload.atencionId,
    deletedEvents: payload.deletedEvents,
    clearedSeguimientos: payload.clearedSeguimientos,
  }
}
