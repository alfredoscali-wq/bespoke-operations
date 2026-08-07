/**
 * Sprint 36.0 — local CustomerAtencion patches after mutations.
 * Avoids re-fetching the atencion row when the mutation response already
 * carries the fields the detail header needs.
 */

import { CONSULTATION_DEFER_DEFAULT_RESOLUTION } from "@/lib/customer-atenciones/consultation-management"
import type { ConsultationFollowUpAction } from "@/lib/customer-atenciones/consultation-follow-up"
import {
  isCustomerAtencionNextStep,
  isCustomerAtencionStatus,
} from "@/lib/customer-atenciones/consultation"
import type { ConsultationManagementRpcResult } from "@/lib/customer-atenciones/consultation-management"
import type { ConsultationInteractionMutationResult } from "@/lib/supabase/customer-atenciones-management.browser"
import type {
  CustomerAtencion,
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

function nowIso(): string {
  return new Date().toISOString()
}

function clearExclusiveManagementFields(): Pick<
  CustomerAtencion,
  | "activeManagementEmployeeId"
  | "activeManagementStartedAt"
  | "activeManagementLastActivityAt"
> {
  return {
    activeManagementEmployeeId: null,
    activeManagementStartedAt: null,
    activeManagementLastActivityAt: null,
  }
}

export function buildStartManagementAtencionPatch(input: {
  result: ConsultationManagementRpcResult
  employeeId: string
}): Partial<CustomerAtencion> {
  const startedAt = nowIso()
  return {
    status: input.result.newStatus,
    nextStep: input.result.newNextStep,
    activeManagementEmployeeId: input.employeeId,
    activeManagementStartedAt: startedAt,
    activeManagementLastActivityAt: startedAt,
    updatedAt: startedAt,
  }
}

export function buildDeferAtencionPatch(input: {
  result: ConsultationManagementRpcResult
  detail?: string | null
}): Partial<CustomerAtencion> {
  const updatedAt = nowIso()
  const resolution =
    typeof input.detail === "string" && input.detail.trim()
      ? input.detail.trim()
      : CONSULTATION_DEFER_DEFAULT_RESOLUTION

  return {
    status: input.result.newStatus,
    nextStep: input.result.newNextStep,
    resultado: "requiere_seguimiento",
    resolution,
    ...clearExclusiveManagementFields(),
    updatedAt,
  }
}

export function buildResolveAtencionPatch(input: {
  result: ConsultationManagementRpcResult
  resolution: string
  followUpActions?: ConsultationFollowUpAction[] | string[]
  employeeId: string
}): Partial<CustomerAtencion> {
  const resolvedAt = nowIso()
  return {
    status: input.result.newStatus,
    nextStep: input.result.newNextStep,
    resultado: "resuelta",
    resolution: input.resolution,
    followUpActions: (input.followUpActions ?? []) as ConsultationFollowUpAction[],
    morosoTrackingStatus: null,
    ...clearExclusiveManagementFields(),
    resolvedAt,
    resolvedByEmployeeId: input.employeeId,
    updatedAt: resolvedAt,
  }
}

export function buildInteractionAtencionPatch(
  result: Extract<ConsultationInteractionMutationResult, { success: true }>
): Partial<CustomerAtencion> {
  const updatedAt = nowIso()
  const status: CustomerAtencionStatus | undefined = isCustomerAtencionStatus(
    result.status
  )
    ? result.status
    : undefined
  const nextStep: CustomerAtencionNextStep | null | undefined =
    result.nextStep == null
      ? null
      : isCustomerAtencionNextStep(result.nextStep)
        ? result.nextStep
        : undefined

  const patch: Partial<CustomerAtencion> = {
    updatedAt,
    activeManagementLastActivityAt: result.managementReleased
      ? null
      : updatedAt,
  }

  if (status) {
    patch.status = status
  }
  if (nextStep !== undefined) {
    patch.nextStep = nextStep
  }
  if (result.managementReleased) {
    Object.assign(patch, clearExclusiveManagementFields())
  }

  return patch
}

export function applyAtencionHeaderPatch(
  current: CustomerAtencion,
  patch: Partial<CustomerAtencion>
): CustomerAtencion {
  return {
    ...current,
    ...patch,
  }
}
