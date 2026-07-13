import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

import { isConsultationManagedByEmployee } from "@/lib/customer-atenciones/consultation-management"

export const TECHNICAL_NEXT_STEP =
  "resolver_consulta_tecnica" as const satisfies CustomerAtencionNextStep

export const TECHNICAL_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP =
  "seguimiento_cliente" as const satisfies CustomerAtencionNextStep

export const TECHNICAL_DEFER_GENERAR_OT_NEXT_STEP =
  "generar_ot" as const satisfies CustomerAtencionNextStep

export const TECHNICAL_DEFER_ESPERAR_CLIENTE_NEXT_STEP =
  "esperar_cliente" as const satisfies CustomerAtencionNextStep

export type TechnicalOutcome =
  | "consulta_resuelta"
  | "seguimiento_con_cliente"
  | "pendiente_generar_ot"
  | "esperando_cliente"

export function isTechnicalConsultation(atencion: {
  nextStep?: CustomerAtencionNextStep | null
}): boolean {
  return atencion.nextStep === TECHNICAL_NEXT_STEP
}

export function isActiveTechnicalConsultationForEmployee(
  atencion: {
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
    activeManagementEmployeeId?: string | null
  },
  employeeId: string
): boolean {
  return (
    isTechnicalConsultation(atencion) &&
    isConsultationManagedByEmployee(atencion, employeeId)
  )
}

export function validateTechnicalResolvedResolution(
  resolution: string | undefined
): string | { error: string } {
  const trimmed = resolution?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá el resultado técnico de la consulta." }
  }

  return trimmed
}

export function validateTechnicalDeferDetail(
  detail: string | undefined
): string | { error: string } {
  const trimmed = detail?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá el detalle operativo técnico." }
  }

  return trimmed
}

export function mapTechnicalOutcomeToAction(outcome: TechnicalOutcome): {
  kind: "resolve" | "defer"
  nextStep?:
    | typeof TECHNICAL_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP
    | typeof TECHNICAL_DEFER_GENERAR_OT_NEXT_STEP
    | typeof TECHNICAL_DEFER_ESPERAR_CLIENTE_NEXT_STEP
} {
  if (outcome === "consulta_resuelta") {
    return { kind: "resolve" }
  }

  if (outcome === "seguimiento_con_cliente") {
    return {
      kind: "defer",
      nextStep: TECHNICAL_DEFER_SEGUIMIENTO_CLIENTE_NEXT_STEP,
    }
  }

  if (outcome === "pendiente_generar_ot") {
    return {
      kind: "defer",
      nextStep: TECHNICAL_DEFER_GENERAR_OT_NEXT_STEP,
    }
  }

  return {
    kind: "defer",
    nextStep: TECHNICAL_DEFER_ESPERAR_CLIENTE_NEXT_STEP,
  }
}
