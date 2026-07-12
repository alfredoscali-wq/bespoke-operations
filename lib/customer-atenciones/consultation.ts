import type {
  CustomerAtencionNextStep,
  CustomerAtencionResultado,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

export const CUSTOMER_ATENCION_STATUS_VALUES = [
  "nueva",
  "para_resolver",
  "en_gestion",
  "pendiente",
  "resuelta",
] as const satisfies readonly CustomerAtencionStatus[]

export const CUSTOMER_ATENCION_NEXT_STEP_VALUES = [
  "realizar_retencion",
  "resolver_facturacion",
  "analizar_problema_tecnico",
  "contactar_cliente",
  "esperar_cliente",
  "esperar_administracion",
  "coordinar_retiro",
  "generar_ot",
] as const satisfies readonly CustomerAtencionNextStep[]

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
