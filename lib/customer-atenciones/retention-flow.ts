import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

import { isConsultationManagedByEmployee } from "@/lib/customer-atenciones/consultation-management"

export const RETENTION_NEXT_STEP = "realizar_retencion" as const satisfies CustomerAtencionNextStep

export const RETENTION_FIRM_BAJA_NEXT_STEP =
  "derivar_admin_gestion" as const satisfies CustomerAtencionNextStep

export type RetentionOutcome = "cliente_retenido" | "baja_sigue_firme"

export function isRetentionConsultation(atencion: {
  nextStep?: CustomerAtencionNextStep | null
}): boolean {
  return atencion.nextStep === RETENTION_NEXT_STEP
}

export function isActiveRetentionConsultationForEmployee(
  atencion: {
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
    activeManagementEmployeeId?: string | null
  },
  employeeId: string
): boolean {
  return (
    isRetentionConsultation(atencion) &&
    isConsultationManagedByEmployee(atencion, employeeId)
  )
}

export function validateRetentionRetainedResolution(
  resolution: string | undefined
): string | { error: string } {
  const trimmed = resolution?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá la resolución o solución ofrecida." }
  }

  return trimmed
}

export function validateRetentionFirmBajaDetail(
  detail: string | undefined
): string | { error: string } {
  const trimmed = detail?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá el resultado o motivo del intento de retención." }
  }

  return trimmed
}

export function buildRetentionFirmBajaDeferInput(detail: string): {
  nextStep: typeof RETENTION_FIRM_BAJA_NEXT_STEP
  detail: string
} {
  return {
    nextStep: RETENTION_FIRM_BAJA_NEXT_STEP,
    detail,
  }
}

export function buildRetentionRetainedResolveInput(resolution: string): {
  resolution: string
} {
  return { resolution }
}
