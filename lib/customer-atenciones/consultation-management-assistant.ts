/**
 * RC 3.1 — Management assistant helpers (copy + return detection).
 * Pure UX/presentation; does not change workflow rules.
 */

import {
  formatConsultationExpedienteAreaPlainLabel,
  getInterveningAreaForEvent,
} from "@/lib/customer-atenciones/consultation-expediente"
import { isAdministrationConsultation } from "@/lib/customer-atenciones/administration-flow"
import { isRetentionConsultation } from "@/lib/customer-atenciones/retention-flow"
import { isTechnicalConsultation } from "@/lib/customer-atenciones/technical-flow"
import type { CustomerAtencionEvent } from "@/lib/types/customer-atencion-events"
import type {
  CustomerAtencion,
  CustomerAtencionNextStep,
} from "@/lib/types/customer-atenciones"

export type ManagementAssistantReturnKind =
  | "tecnica"
  | "administracion"
  | "ventas"
  | "retenciones"

export type ManagementAssistantReturn = {
  kind: ManagementAssistantReturnKind
  headline: string
  summary: string | null
  dateTime: string
  actorEmployeeId: string | null
}

export type ManagementAssistantOptionId =
  | "resolve"
  | "esperar_cliente"
  | "seguimiento_cliente"
  | "resolver_consulta_tecnica"
  | "derivar_admin_gestion"
  | "derivar_admin_facturacion"
  | "derivar_admin_morosos"
  | "contactar_cliente"
  | "realizar_retencion"
  | "link_ot"
  | "moroso_tracking"

/** Natural-language option labels for the guided assistant. */
export function getManagementAssistantOptionLabel(
  id: ManagementAssistantOptionId,
  context?: { afterTecnica?: boolean }
): string {
  if (context?.afterTecnica) {
    if (id === "resolve") {
      return "Informar al cliente y cerrar la consulta."
    }
    if (id === "resolver_consulta_tecnica") {
      return "Solicitar una nueva revisión técnica."
    }
  }

  switch (id) {
    case "resolve":
      return "La consulta quedó resuelta."
    case "esperar_cliente":
      return "Esperar respuesta del cliente"
    case "seguimiento_cliente":
      return "Requiere contacto con el cliente"
    case "resolver_consulta_tecnica":
      return "Se envía al área Técnica."
    case "derivar_admin_gestion":
      return "Se envía a Administración."
    case "derivar_admin_facturacion":
      return "Se envía a Administración por un tema de facturación."
    case "derivar_admin_morosos":
      return "Se envía a Administración por gestión de morosos."
    case "contactar_cliente":
      return "Se envía al área de Ventas."
    case "realizar_retencion":
      return "El cliente solicita la baja del servicio."
    case "link_ot":
      return "Crear Orden de Trabajo"
    case "moroso_tracking":
      return "Registrar un avance en la gestión de morosos."
  }
}

/** What will happen after confirming the selected option. */
export function getManagementAssistantNextStepMessage(
  id: ManagementAssistantOptionId
): string {
  switch (id) {
    case "resolve":
      return "La consulta quedará cerrada y registrada en el historial."
    case "esperar_cliente":
      return "La consulta quedará esperando la respuesta del cliente."
    case "seguimiento_cliente":
      return "La consulta quedará pendiente de contacto con el cliente."
    case "resolver_consulta_tecnica":
      return "La consulta será enviada al área Técnica para su análisis."
    case "derivar_admin_gestion":
    case "derivar_admin_facturacion":
      return "La consulta será enviada a Administración para su gestión."
    case "derivar_admin_morosos":
      return "La consulta será enviada a Administración para la gestión de morosos."
    case "contactar_cliente":
      return "La consulta será enviada al área de Ventas."
    case "realizar_retencion":
      return "Se iniciará el proceso de retención."
    case "link_ot":
      return "Se abrirá el formulario de Nueva Orden de Trabajo con los datos de la consulta."
    case "moroso_tracking":
      return "Se registrará el avance de la gestión de morosos en el expediente."
  }
}

/**
 * RC 3.2.8 — options that register a management action and require written detail.
 * link_ot / moroso_tracking keep specialized UIs.
 */
export function managementAssistantOptionRequiresDetail(
  id: ManagementAssistantOptionId
): boolean {
  return (
    id === "resolve" ||
    id === "esperar_cliente" ||
    id === "seguimiento_cliente" ||
    id === "resolver_consulta_tecnica" ||
    id === "derivar_admin_gestion" ||
    id === "derivar_admin_facturacion" ||
    id === "derivar_admin_morosos" ||
    id === "contactar_cliente" ||
    id === "realizar_retencion"
  )
}

/** RC 3.2.8 — follow-up actions only apply when resolving. */
export function managementAssistantOptionShowsFollowUp(
  id: ManagementAssistantOptionId
): boolean {
  return id === "resolve"
}

/** RC 3.2.8 — placeholder for the unified "Detalle de la gestión" field. */
export function getManagementAssistantDetailPlaceholder(
  id: ManagementAssistantOptionId
): string {
  switch (id) {
    case "resolve":
      return "Describa cómo fue resuelta la consulta."
    case "esperar_cliente":
      return "Describa qué se solicitó al cliente y qué respuesta se espera. Ej.: se solicitó reiniciar el equipo; se pidió enviar fotografías; el cliente realizará una prueba esta noche."
    case "seguimiento_cliente":
      return "Describa el contacto pendiente o la información que debe tratarse con el cliente."
    case "resolver_consulta_tecnica":
      return "Describa el diagnóstico realizado y la información que necesita conocer el área técnica."
    case "derivar_admin_gestion":
    case "derivar_admin_facturacion":
    case "derivar_admin_morosos":
      return "Describa la gestión que deberá realizar Administración."
    case "contactar_cliente":
      return "Describa la oportunidad comercial detectada o la solicitud del cliente."
    case "realizar_retencion":
      return "Describa el motivo informado por el cliente y cualquier información relevante para Retenciones."
    case "link_ot":
      return "Describa el contexto operativo que debe conocer el equipo al generar la OT."
    case "moroso_tracking":
      return "Describa el avance registrado en la gestión de morosos."
  }
}

export function managementAssistantOptionToNextStep(
  id: ManagementAssistantOptionId
): CustomerAtencionNextStep | null {
  switch (id) {
    case "esperar_cliente":
      return "esperar_cliente"
    case "seguimiento_cliente":
      return "seguimiento_cliente"
    case "resolver_consulta_tecnica":
      return "resolver_consulta_tecnica"
    case "derivar_admin_gestion":
      return "derivar_admin_gestion"
    case "derivar_admin_facturacion":
      return "derivar_admin_facturacion"
    case "derivar_admin_morosos":
      return "derivar_admin_morosos"
    case "contactar_cliente":
      return "contactar_cliente"
    case "realizar_retencion":
      return "realizar_retencion"
    default:
      return null
  }
}

function formatReturnDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Detects when Atención is continuing after another area responded.
 * Does not invent DB fields — uses last pending/registered intervention area.
 */
export function detectManagementAssistantReturn(
  atencion: Pick<CustomerAtencion, "status" | "nextStep">,
  events: readonly CustomerAtencionEvent[]
): ManagementAssistantReturn | null {
  if (atencion.status === "resuelta") {
    return null
  }

  // Still owned by a specialized area — not a "return to Atención" moment.
  if (
    isTechnicalConsultation(atencion) ||
    isAdministrationConsultation(atencion) ||
    isRetentionConsultation(atencion) ||
    atencion.nextStep === "contactar_cliente"
  ) {
    return null
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event) continue

    if (
      event.actionType !== "consulta_pendiente" &&
      event.actionType !== "gestion_registrada"
    ) {
      continue
    }

    const area = getInterveningAreaForEvent(event)
    const areaLabel = formatConsultationExpedienteAreaPlainLabel(area)
    const summary = event.detail?.trim() || null
    const dateTime = formatReturnDateTime(event.createdAt)
    const actorEmployeeId = event.employeeId

    if (area.key === "tecnica" || area.key === "generar_ot") {
      return {
        kind: "tecnica",
        headline: "El área Técnica finalizó el análisis.",
        summary,
        dateTime,
        actorEmployeeId,
      }
    }

    if (area.key === "administracion" || area.key === "morosos") {
      return {
        kind: "administracion",
        headline: "Administración respondió la gestión.",
        summary,
        dateTime,
        actorEmployeeId,
      }
    }

    if (area.key === "ventas") {
      return {
        kind: "ventas",
        headline: "Ventas respondió la gestión.",
        summary,
        dateTime,
        actorEmployeeId,
      }
    }

    if (area.key === "retenciones") {
      return {
        kind: "retenciones",
        headline: `${areaLabel} respondió la gestión.`,
        summary,
        dateTime,
        actorEmployeeId,
      }
    }

    // Atención-only interventions — no return banner.
    return null
  }

  return null
}

/** Initial guided options for general Atención management (no OT). */
export const MANAGEMENT_ASSISTANT_INITIAL_OPTIONS: ManagementAssistantOptionId[] =
  [
    "resolve",
    "esperar_cliente",
    "resolver_consulta_tecnica",
    "derivar_admin_gestion",
    "contactar_cliente",
    "realizar_retencion",
  ]

/** Options after Técnica returned work to Atención. */
export function getManagementAssistantOptionsAfterTecnica(
  nextStep: CustomerAtencionNextStep | null | undefined
): ManagementAssistantOptionId[] {
  const options: ManagementAssistantOptionId[] = []

  if (nextStep === "generar_ot") {
    options.push("link_ot")
  }

  options.push("resolve", "esperar_cliente", "seguimiento_cliente")

  // New technical review only when not already waiting on OT link alone.
  options.push("resolver_consulta_tecnica")

  return options
}

/** Options after Administración / Ventas / Retenciones returned. */
export function getManagementAssistantOptionsAfterAreaReturn(
  kind: Exclude<ManagementAssistantReturnKind, "tecnica">,
  nextStep?: CustomerAtencionNextStep | null
): ManagementAssistantOptionId[] {
  const options: ManagementAssistantOptionId[] = [
    "resolve",
    "esperar_cliente",
    "seguimiento_cliente",
  ]

  if (kind === "administracion") {
    options.push("resolver_consulta_tecnica", "realizar_retencion")
  }

  if (kind === "ventas") {
    if (nextStep === "generar_ot") {
      options.unshift("link_ot")
    }
    options.push("resolver_consulta_tecnica")
  }

  if (kind === "retenciones") {
    options.push("derivar_admin_gestion", "resolver_consulta_tecnica")
  }

  return options
}
