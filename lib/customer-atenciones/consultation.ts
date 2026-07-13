import { validateQuickCustomerInput } from "@/lib/customers/quick-customer"
import type {
  CustomerAtencionNextStep,
  CustomerAtencionResultado,
  CustomerAtencionStatus,
  NewConsultationDecision,
  NewCustomerAtencionInput,
} from "@/lib/types/customer-atenciones"

export const CUSTOMER_ATENCION_STATUS_VALUES = [
  "nueva",
  "para_resolver",
  "en_gestion",
  "pendiente",
  "resuelta",
] as const satisfies readonly CustomerAtencionStatus[]

/**
 * Sprint 2.8 — Próximo Paso options (action to take, not owning area).
 */
export const CUSTOMER_ATENCION_NEXT_STEP_VALUES = [
  "realizar_retencion",
  "resolver_consulta_tecnica",
  "derivar_admin_facturacion",
  "derivar_admin_morosos",
  "derivar_admin_gestion",
  "contactar_cliente",
  "seguimiento_cliente",
  "esperar_cliente",
  "generar_ot",
] as const satisfies readonly CustomerAtencionNextStep[]

/** Internal company work → Para Resolver. */
export const CONSULTATION_INTERNAL_ACTION_NEXT_STEPS = [
  "realizar_retencion",
  "resolver_consulta_tecnica",
  "derivar_admin_facturacion",
  "derivar_admin_morosos",
  "derivar_admin_gestion",
  "contactar_cliente",
  "seguimiento_cliente",
  "generar_ot",
] as const satisfies readonly CustomerAtencionNextStep[]

/**
 * External actor wait → Pendiente status and Pendientes KPI.
 * Only esperar_cliente (client / third party outside the company).
 */
export const CONSULTATION_WAITING_NEXT_STEPS = [
  "esperar_cliente",
] as const satisfies readonly CustomerAtencionNextStep[]

export const CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS =
  CONSULTATION_WAITING_NEXT_STEPS

export const CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS =
  CONSULTATION_INTERNAL_ACTION_NEXT_STEPS

/**
 * "Nuevas" KPI = active consultations created on the reference date.
 * Kept for operational volume; may be redefined or removed later.
 */
export const SHARED_INBOX_NUEVAS_KPI_CREATED_TODAY = true

/** Sprint 2.8 delivered the Próximo Paso menu restructuring. */
export const CONTINUAR_GESTION_MENU_REVIEW_PLANNED = false

export const CONTINUAR_GESTION_DEFAULT_RESOLUTION =
  "Consulta registrada para continuar gestión."

/** Maps legacy/new resultado to initial Consulta status on create. */
export function deriveConsultationStatusFromResultado(
  resultado: CustomerAtencionResultado
): CustomerAtencionStatus {
  if (resultado === "requiere_seguimiento") {
    return "pendiente"
  }

  return "resuelta"
}

/** Maps historical resultado to status for backfill parity. */
export function deriveConsultationStatusFromHistoricalResultado(
  resultado: string
): CustomerAtencionStatus {
  if (resultado === "requiere_seguimiento") {
    return "pendiente"
  }

  if (resultado === "resuelta" || resultado === "ot_creada") {
    return "resuelta"
  }

  return "resuelta"
}

export function deriveNextStepForNewConsultation(
  _resultado: CustomerAtencionResultado
): CustomerAtencionNextStep | null {
  return null
}

export function isCustomerAtencionStatus(
  value: string
): value is CustomerAtencionStatus {
  return (CUSTOMER_ATENCION_STATUS_VALUES as readonly string[]).includes(value)
}

export function isCustomerAtencionNextStep(
  value: string
): value is CustomerAtencionNextStep {
  return (CUSTOMER_ATENCION_NEXT_STEP_VALUES as readonly string[]).includes(value)
}

export function isConsultationInternalActionNextStep(
  nextStep: CustomerAtencionNextStep
): boolean {
  return (CONSULTATION_INTERNAL_ACTION_NEXT_STEPS as readonly string[]).includes(
    nextStep
  )
}

export function isConsultationWaitingNextStep(
  nextStep: CustomerAtencionNextStep
): boolean {
  return (CONSULTATION_WAITING_NEXT_STEPS as readonly string[]).includes(nextStep)
}

export function isConsultationExternalWaitNextStep(
  nextStep: CustomerAtencionNextStep
): boolean {
  return (CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS as readonly string[]).includes(
    nextStep
  )
}

export function isConsultationParaResolverKpiNextStep(
  nextStep: CustomerAtencionNextStep
): boolean {
  return (CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS as readonly string[]).includes(
    nextStep
  )
}

export function resolveInitialConsultationStatusFromNextStep(
  nextStep: CustomerAtencionNextStep
): CustomerAtencionStatus {
  if (isConsultationWaitingNextStep(nextStep)) {
    return "pendiente"
  }

  return "para_resolver"
}

export function resolveLegacyResultadoFromDecision(
  decision: NewConsultationDecision
): CustomerAtencionResultado {
  if (decision === "resolver_ahora") {
    return "resuelta"
  }

  return "requiere_seguimiento"
}

export type NewConsultationCreationFields = {
  status: CustomerAtencionStatus
  nextStep: CustomerAtencionNextStep | null
  resultado: CustomerAtencionResultado
  resolution: string
}

export function buildNewConsultationCreationFields(
  input: Pick<
    NewCustomerAtencionInput,
    "decision" | "detail" | "resolution" | "nextStep"
  >
): NewConsultationCreationFields | { error: string } {
  if (input.decision === "resolver_ahora") {
    const resolution = input.resolution?.trim() ?? ""

    if (!resolution) {
      return { error: "Completá la resolución de la consulta." }
    }

    return {
      status: "resuelta",
      nextStep: null,
      resultado: "resuelta",
      resolution,
    }
  }

  const nextStep = input.nextStep

  if (!nextStep) {
    return { error: "Seleccioná el próximo paso para continuar la gestión." }
  }

  if (!isCustomerAtencionNextStep(nextStep)) {
    return { error: "Próximo paso inválido." }
  }

  return {
    status: resolveInitialConsultationStatusFromNextStep(nextStep),
    nextStep,
    resultado: resolveLegacyResultadoFromDecision("continuar_gestion"),
    resolution: CONTINUAR_GESTION_DEFAULT_RESOLUTION,
  }
}

export function validateNewConsultationInput(
  input: NewCustomerAtencionInput
): string | null {
  const customerId = input.customerId?.trim() ?? ""
  const quickCustomer = input.quickCustomer

  if (customerId && quickCustomer) {
    return "Indicá un cliente existente o datos manuales, no ambos."
  }

  if (!customerId && !quickCustomer) {
    return "Seleccioná un cliente o completá los datos del cliente no registrado."
  }

  if (quickCustomer) {
    const quickCustomerError = validateQuickCustomerInput(quickCustomer)

    if (quickCustomerError) {
      return quickCustomerError
    }
  }

  if (!input.channel) {
    return "Seleccioná el canal."
  }

  if (!input.motivo) {
    return "Seleccioná el motivo."
  }

  if (!input.detail.trim()) {
    return "Completá la descripción de la consulta."
  }

  if (input.decision === "resolver_ahora" && input.nextStep) {
    return "Una consulta resuelta no puede tener próximo paso."
  }

  const creation = buildNewConsultationCreationFields(input)

  if ("error" in creation) {
    return creation.error
  }

  if (creation.status === "resuelta" && creation.nextStep !== null) {
    return "Una consulta resuelta no puede tener próximo paso."
  }

  if (
    (creation.status === "para_resolver" || creation.status === "pendiente") &&
    !creation.nextStep
  ) {
    return "Completá el próximo paso para continuar la gestión."
  }

  return null
}
