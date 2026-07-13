import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

import { isConsultationManagedByEmployee } from "@/lib/customer-atenciones/consultation-management"

export const ADMINISTRATION_FACTURACION_NEXT_STEP =
  "derivar_admin_facturacion" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_GESTION_NEXT_STEP =
  "derivar_admin_gestion" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_MOROSOS_NEXT_STEP =
  "derivar_admin_morosos" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_DEFER_ESPERAR_CLIENTE_NEXT_STEP =
  "esperar_cliente" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP =
  "seguimiento_cliente" as const satisfies CustomerAtencionNextStep

export const ADMINISTRATION_DEFER_GENERAR_OT_NEXT_STEP =
  "generar_ot" as const satisfies CustomerAtencionNextStep

/** Admin circuits managed via the Administración result dialog (not Morosos tracking). */
export const ADMINISTRATION_NEXT_STEPS = [
  ADMINISTRATION_FACTURACION_NEXT_STEP,
  ADMINISTRATION_GESTION_NEXT_STEP,
] as const satisfies readonly CustomerAtencionNextStep[]

export const ADMINISTRATION_KPI_NEXT_STEPS = [
  ADMINISTRATION_FACTURACION_NEXT_STEP,
  ADMINISTRATION_GESTION_NEXT_STEP,
  ADMINISTRATION_MOROSOS_NEXT_STEP,
] as const satisfies readonly CustomerAtencionNextStep[]

export type AdministrationOutcome =
  | "gestion_resuelta"
  | "seguimiento_con_cliente"
  | "esperando_documentacion"
  | "confirmar_baja"

export function isAdministrationConsultation(atencion: {
  nextStep?: CustomerAtencionNextStep | null
}): boolean {
  return (
    atencion.nextStep === ADMINISTRATION_FACTURACION_NEXT_STEP ||
    atencion.nextStep === ADMINISTRATION_GESTION_NEXT_STEP
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
    return { error: "Completá la resolución administrativa." }
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
    | typeof ADMINISTRATION_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP
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
    | typeof ADMINISTRATION_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP
    | typeof ADMINISTRATION_DEFER_GENERAR_OT_NEXT_STEP
} {
  if (outcome === "gestion_resuelta") {
    return { kind: "resolve" }
  }

  if (outcome === "seguimiento_con_cliente") {
    return {
      kind: "defer",
      nextStep: ADMINISTRATION_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP,
    }
  }

  if (outcome === "esperando_documentacion") {
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
