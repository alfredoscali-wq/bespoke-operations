import type {
  CustomerRetencionMotivoBaja,
  CustomerRetencionResultado,
  CustomerRetencionStatus,
} from "@/lib/types/customer-retenciones"
import type { VisualTone } from "@/lib/ui/visual-tokens"

const MOTIVO_BAJA_LABELS: Record<CustomerRetencionMotivoBaja, string> = {
  precio_situacion_economica: "Precio / situación económica",
  problemas_tecnicos: "Problemas técnicos",
  problemas_reiterados_sin_solucion: "Problemas reiterados sin solución",
  mala_atencion: "Mala atención",
  falta_de_respuesta: "Falta de respuesta",
  cambio_de_proveedor: "Cambio de proveedor",
  mudanza: "Mudanza",
  ya_no_necesita_servicio: "Ya no necesita el servicio",
  otro: "Otro",
}

const RESULTADO_LABELS: Record<CustomerRetencionResultado, string> = {
  retenido: "Retenido",
  no_retenido: "No retenido",
}

const STATUS_LABELS: Record<CustomerRetencionStatus, string> = {
  pendiente: "Pendiente",
  finalizada: "Finalizada",
}

export function formatCustomerRetencionMotivoBajaLabel(
  motivo: CustomerRetencionMotivoBaja
): string {
  return MOTIVO_BAJA_LABELS[motivo] ?? motivo
}

export function formatCustomerRetencionResultadoLabel(
  resultado: CustomerRetencionResultado
): string {
  return RESULTADO_LABELS[resultado] ?? resultado
}

export function formatCustomerRetencionStatusLabel(
  status: CustomerRetencionStatus
): string {
  return STATUS_LABELS[status] ?? status
}

export function getCustomerRetencionStatusTone(
  status: CustomerRetencionStatus
): VisualTone {
  return status === "pendiente" ? "amber" : "blue"
}

export function getCustomerRetencionResultadoTone(
  resultado: CustomerRetencionResultado
): VisualTone {
  return resultado === "retenido" ? "green" : "neutral"
}

export const CUSTOMER_RETENCION_MOTIVO_BAJA_OPTIONS = (
  Object.entries(MOTIVO_BAJA_LABELS) as [CustomerRetencionMotivoBaja, string][]
).map(([value, label]) => ({ value, label }))

export const CUSTOMER_RETENCION_RESULTADO_OPTIONS = (
  Object.entries(RESULTADO_LABELS) as [CustomerRetencionResultado, string][]
).map(([value, label]) => ({ value, label }))
