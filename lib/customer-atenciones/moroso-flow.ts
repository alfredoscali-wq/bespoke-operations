import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
  MorosoTrackingStatus,
} from "@/lib/types/customer-atenciones"

import { isConsultationManagedByEmployee } from "@/lib/customer-atenciones/consultation-management"

export const MOROSO_NEXT_STEP =
  "derivar_admin_morosos" as const satisfies CustomerAtencionNextStep

export const MOROSO_TRACKING_STATUS_VALUES = [
  "cupon_pendiente_enviar",
  "cupon_enviado",
  "esperando_acreditacion",
  "pago_acreditado",
  "servicio_rehabilitado",
] as const satisfies readonly MorosoTrackingStatus[]

export const MOROSO_TRACKING_STATUS_LABELS: Record<MorosoTrackingStatus, string> =
  {
    cupon_pendiente_enviar: "Cupón pendiente de enviar",
    cupon_enviado: "Cupón enviado",
    esperando_acreditacion: "Esperando acreditación",
    pago_acreditado: "Pago acreditado",
    servicio_rehabilitado: "Servicio rehabilitado",
  }

export const DEFAULT_MOROSO_TRACKING_STATUS: MorosoTrackingStatus =
  "cupon_pendiente_enviar"

export function isMorosoTrackingStatus(
  value: string
): value is MorosoTrackingStatus {
  return (MOROSO_TRACKING_STATUS_VALUES as readonly string[]).includes(value)
}

export function isMorosoConsultation(atencion: {
  nextStep?: CustomerAtencionNextStep | null
}): boolean {
  return atencion.nextStep === MOROSO_NEXT_STEP
}

export function isActiveMorosoConsultationForEmployee(
  atencion: {
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
    activeManagementEmployeeId?: string | null
  },
  employeeId: string
): boolean {
  return (
    isMorosoConsultation(atencion) &&
    isConsultationManagedByEmployee(atencion, employeeId)
  )
}

export function resolveMorosoTrackingStatus(
  value: string | null | undefined
): MorosoTrackingStatus {
  if (value && isMorosoTrackingStatus(value)) {
    return value
  }

  return DEFAULT_MOROSO_TRACKING_STATUS
}

export function validateMorosoTrackingStatus(
  value: string | undefined
): MorosoTrackingStatus | { error: string } {
  const trimmed = value?.trim() ?? ""

  if (!trimmed || !isMorosoTrackingStatus(trimmed)) {
    return { error: "Seleccioná un estado de seguimiento válido." }
  }

  return trimmed
}

export const MOROSO_TRACKING_STATUS_OPTIONS = MOROSO_TRACKING_STATUS_VALUES.map(
  (value) => ({
    value,
    label: MOROSO_TRACKING_STATUS_LABELS[value],
  })
)
