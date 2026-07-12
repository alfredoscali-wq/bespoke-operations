import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

import { isConsultationManagedByEmployee } from "@/lib/customer-atenciones/consultation-management"

export const ADMINISTRATION_RESOLVE_FACTURACION_NEXT_STEP =
  "resolver_facturacion" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_WAIT_NEXT_STEP =
  "esperar_administracion" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_DEFER_ESPERAR_CLIENTE_NEXT_STEP =
  "esperar_cliente" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_DEFER_GENERAR_OT_NEXT_STEP =
  "generar_ot" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_NEXT_STEPS = [
  ADMINISTRATION_RESOLVE_FACTURACION_NEXT_STEP,
  ADMINISTRATION_WAIT_NEXT_STEP,
] as const satisfies readonly CustomerAtencionNextStep[]

export type AdministrationOutcome =
  | "facturacion_resuelta"
  | "cliente_con_deuda"
  | "esperando_documentacion"
  | "confirmar_baja"

export function isAdministrationConsultation(atencion: {
  nextStep?: CustomerAtencionNextStep | null
}): boolean {
  return (
    atencion.nextStep === ADMINISTRATION_RESOLVE_FACTURACION_NEXT_STEP ||
    atencion.nextStep === ADMINISTRATION_WAIT_NEXT_STEP
  )
}

export function isActiveAdministrationConsultationForEmployee(
  atencion: {
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
    activeManagementEmployeeId?: string | null
  },
  employeeId: string
): boolean {
  return (
    isAdministrationConsultation(atencion) &&
    isConsultationManagedByEmployee(atencion, employeeId)
  )
}

export function validateAdministrationResolvedResolution(
  resolution: string | undefined
): string | { error: string } {
  const trimmed = resolution?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá la resolución de facturación." }
  }

  return trimmed
}

export function validateAdministrationDeferDetail(
  detail: string | undefined
): string | { error: string } {
  const trimmed = detail?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá el detalle operativo de la gestión." }
  }

  return trimmed
}

export function buildAdministrationResolvedInput(resolution: string): {
  resolution: string
} {
  return { resolution }
}

export function buildAdministrationDeferInput(
  nextStep:
    | typeof ADMINISTRATION_DEFER_ESPERAR_CLIENTE_NEXT_STEP
    | typeof ADMINISTRATION_DEFER_GENERAR_OT_NEXT_STEP,
  detail: string
): {
  nextStep: typeof nextStep
  detail: string
} {
  return { nextStep, detail }
}

export function mapAdministrationOutcomeToAction(outcome: AdministrationOutcome): {
  kind: "resolve" | "defer"
  nextStep?:
    | typeof ADMINISTRATION_DEFER_ESPERAR_CLIENTE_NEXT_STEP
    | typeof ADMINISTRATION_DEFER_GENERAR_OT_NEXT_STEP
} {
  if (outcome === "facturacion_resuelta") {
    return { kind: "resolve" }
  }

  if (outcome === "cliente_con_deuda" || outcome === "esperando_documentacion") {
    return {
      kind: "defer",
      nextStep: ADMINISTRATION_DEFER_ESPERAR_CLIENTE_NEXT_STEP,
    }
  }

  return {
    kind: "defer",
    nextStep: ADMINISTRATION_DEFER_GENERAR_OT_NEXT_STEP,
  }
}
