import {
  formatCustomerAtencionEventActionLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import { getOperationalCategoryForNextStep } from "@/lib/customer-atenciones/shared-inbox"
import type { CustomerAtencionEvent } from "@/lib/types/customer-atencion-events"
import type {
  CustomerAtencion,
  CustomerAtencionMotivo,
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

/** Operational area for expediente display (responsible / intervening). */
export type ConsultationExpedienteAreaKey =
  | "atencion_cliente"
  | "tecnica"
  | "administracion"
  | "ventas"
  | "retenciones"
  | "morosos"
  | "generar_ot"

export type ConsultationExpedienteArea = {
  key: ConsultationExpedienteAreaKey
  label: string
  /** Visual prefix without new icon libraries (spec Sprint 2.9). */
  marker: string
}

const AREA_DISPLAY: Record<ConsultationExpedienteAreaKey, ConsultationExpedienteArea> =
  {
    atencion_cliente: {
      key: "atencion_cliente",
      label: "Atención al Cliente",
      marker: "👤",
    },
    tecnica: {
      key: "tecnica",
      label: "Área Técnica",
      marker: "🛠",
    },
    administracion: {
      key: "administracion",
      label: "Administración",
      marker: "📋",
    },
    ventas: {
      key: "ventas",
      label: "Ventas",
      marker: "💼",
    },
    retenciones: {
      key: "retenciones",
      label: "Retenciones",
      marker: "👤",
    },
    morosos: {
      key: "morosos",
      label: "Morosos",
      marker: "📋",
    },
    generar_ot: {
      key: "generar_ot",
      label: "Área Técnica",
      marker: "🛠",
    },
  }

const ATENCION_FOLLOW_UP_STEPS = new Set<CustomerAtencionNextStep>([
  "seguimiento_cliente",
  "esperar_cliente",
])

/**
 * Present-tense description of the current next_step — never an action verb.
 * Presentation only (UX 2.3).
 */
export type NextStepSituationPresentation = {
  responsibleAreaLabel: string
  managementTypeLabel: string | null
  /** e.g. "Pendiente de gestión" */
  situationLabel: string
}

const NEXT_STEP_SITUATION: Record<
  CustomerAtencionNextStep,
  NextStepSituationPresentation
> = {
  seguimiento_cliente: {
    responsibleAreaLabel: "Atención al Cliente",
    managementTypeLabel: "Contacto con el cliente",
    situationLabel: "Pendiente de contactar al cliente",
  },
  esperar_cliente: {
    responsibleAreaLabel: "Atención al Cliente",
    managementTypeLabel: "Espera de respuesta",
    situationLabel: "Esperando respuesta del cliente",
  },
  realizar_retencion: {
    responsibleAreaLabel: "Atención al Cliente",
    managementTypeLabel: "Retención",
    situationLabel: "Pendiente de retención",
  },
  resolver_consulta_tecnica: {
    responsibleAreaLabel: "Área Técnica",
    managementTypeLabel: null,
    situationLabel: "Pendiente de gestión técnica",
  },
  derivar_admin_facturacion: {
    responsibleAreaLabel: "Administración",
    managementTypeLabel: "Facturación",
    situationLabel: "Pendiente de gestión",
  },
  derivar_admin_morosos: {
    responsibleAreaLabel: "Administración",
    managementTypeLabel: "Deuda / Morosidad",
    situationLabel: "Pendiente de gestión",
  },
  derivar_admin_gestion: {
    responsibleAreaLabel: "Administración",
    managementTypeLabel: "Gestión administrativa",
    situationLabel: "Pendiente de gestión",
  },
  contactar_cliente: {
    responsibleAreaLabel: "Ventas",
    managementTypeLabel: null,
    situationLabel: "Pendiente de gestión comercial",
  },
  generar_ot: {
    responsibleAreaLabel: "Área Técnica",
    managementTypeLabel: "Orden de trabajo",
    situationLabel: "OT pendiente",
  },
}

export function describeNextStepSituation(
  nextStep: CustomerAtencionNextStep | null | undefined
): NextStepSituationPresentation | null {
  if (!nextStep) {
    return null
  }

  return NEXT_STEP_SITUATION[nextStep] ?? null
}

/** Past-tense handoff sentence for timeline narratives. */
export function describeNextStepHandoff(
  nextStep: CustomerAtencionNextStep | null | undefined
): string | null {
  if (!nextStep) {
    return null
  }

  switch (nextStep) {
    case "seguimiento_cliente":
      return "La consulta quedó a cargo de Atención al Cliente para volver a contactar al cliente."
    case "esperar_cliente":
      return "La consulta quedó a la espera de una respuesta del cliente."
    case "realizar_retencion":
      return "La consulta quedó a cargo de Atención al Cliente para realizar una retención."
    case "resolver_consulta_tecnica":
      return "La consulta fue derivada al Área Técnica."
    case "derivar_admin_facturacion":
      return "La consulta fue derivada a Administración para gestionar Facturación."
    case "derivar_admin_morosos":
      return "La consulta fue derivada a Administración para gestionar Deuda / Morosidad."
    case "derivar_admin_gestion":
      return "La consulta fue derivada a Administración para Gestión administrativa."
    case "contactar_cliente":
      return "La consulta fue derivada a Ventas."
    case "generar_ot":
      return "La consulta quedó pendiente de una orden de trabajo."
    default:
      return null
  }
}

const DERIVATION_NEXT_STEPS = new Set<CustomerAtencionNextStep>([
  "resolver_consulta_tecnica",
  "derivar_admin_facturacion",
  "derivar_admin_morosos",
  "derivar_admin_gestion",
  "contactar_cliente",
])

/** Date/time for the Consulta ingress card: 17/07/2026 - 01:29 */
export function formatConsultationIngressDateTime(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const time = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return `${day} - ${time}`
}

/** Date/time for narrative sentences: 17/07/2026 a las 01:29 */
export function formatConsultationNarrativeDateTime(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const time = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return `${day} a las ${time}`
}

function findHandoffEventForNextStep(
  events: readonly CustomerAtencionEvent[],
  nextStep: CustomerAtencionNextStep | null | undefined
): CustomerAtencionEvent | null {
  if (!nextStep) {
    return null
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.newNextStep === nextStep) {
      return event ?? null
    }
  }

  return null
}

export type ConsultationSituationNarrative = {
  statusEmphasis: string
  handoff:
    | {
        kind: "derivation"
        areaLabel: string
        actorName: string
        dateTime: string
      }
    | {
        kind: "atencion"
        description: string
      }
    | null
  managementTypeLabel: string | null
  closingNote: string | null
}

/** Natural-language present-state summary for UX 2.4 (presentation only). */
export function buildConsultationSituationNarrative(
  atencion: Pick<CustomerAtencion, "status" | "nextStep" | "resolution">,
  events: readonly CustomerAtencionEvent[],
  getActorName: (employeeId: string) => string
): ConsultationSituationNarrative {
  const statusEmphasis = formatCustomerAtencionStatusLabel(
    atencion.status
  ).toUpperCase()

  if (atencion.status === "resuelta") {
    return {
      statusEmphasis,
      handoff: null,
      managementTypeLabel: null,
      closingNote: atencion.resolution?.trim() || null,
    }
  }

  const situation = describeNextStepSituation(atencion.nextStep)
  const handoffEvent =
    findHandoffEventForNextStep(events, atencion.nextStep) ??
    (events[0]?.actionType === "consulta_creada" ? events[0] : null)
  const actorName = handoffEvent
    ? getActorName(handoffEvent.employeeId)
    : "—"
  const dateTime = handoffEvent
    ? formatConsultationNarrativeDateTime(handoffEvent.createdAt)
    : "—"

  if (atencion.nextStep && DERIVATION_NEXT_STEPS.has(atencion.nextStep)) {
    return {
      statusEmphasis,
      handoff: {
        kind: "derivation",
        areaLabel: situation?.responsibleAreaLabel ?? "—",
        actorName,
        dateTime,
      },
      managementTypeLabel: situation?.managementTypeLabel ?? null,
      closingNote: null,
    }
  }

  if (atencion.nextStep && situation) {
    let description = ""

    switch (atencion.nextStep) {
      case "seguimiento_cliente":
        description =
          "Se encuentra a cargo de Atención al Cliente para volver a contactar al cliente."
        break
      case "esperar_cliente":
        description = "Se encuentra en espera de respuesta del cliente."
        break
      case "realizar_retencion":
        description =
          "Se encuentra a cargo de Atención al Cliente para realizar una retención."
        break
      case "generar_ot":
        description = "Se encuentra pendiente de una orden de trabajo."
        break
      default:
        description = `Se encuentra bajo gestión de ${situation.responsibleAreaLabel}.`
    }

    return {
      statusEmphasis,
      handoff: { kind: "atencion", description },
      managementTypeLabel: situation.managementTypeLabel,
      closingNote: null,
    }
  }

  return {
    statusEmphasis,
    handoff: null,
    managementTypeLabel: null,
    closingNote: null,
  }
}

export function getConsultationExpedienteAreaForNextStep(
  nextStep: CustomerAtencionNextStep | null | undefined
): ConsultationExpedienteArea {
  if (!nextStep || ATENCION_FOLLOW_UP_STEPS.has(nextStep)) {
    return AREA_DISPLAY.atencion_cliente
  }

  const category = getOperationalCategoryForNextStep(nextStep)
  if (!category) {
    return AREA_DISPLAY.atencion_cliente
  }

  switch (category) {
    case "tecnica":
      return AREA_DISPLAY.tecnica
    case "administracion":
      return AREA_DISPLAY.administracion
    case "contactar_cliente":
      return AREA_DISPLAY.ventas
    case "retenciones":
      return AREA_DISPLAY.retenciones
    case "morosos":
      return AREA_DISPLAY.morosos
    case "generar_ot":
      return AREA_DISPLAY.generar_ot
    default:
      return AREA_DISPLAY.atencion_cliente
  }
}

export function formatConsultationExpedienteAreaLabel(
  area: ConsultationExpedienteArea
): string {
  return `${area.marker} ${area.label}`
}

export function formatConsultationExpedienteAreaPlainLabel(
  area: ConsultationExpedienteArea
): string {
  return area.label
}

/**
 * Area that performed an intervention: inferred from the next step in force
 * when the action was taken (previous next step), falling back to the resulting
 * next step for creation/start handoffs.
 */
export function getInterveningAreaForEvent(
  event: Pick<CustomerAtencionEvent, "previousNextStep" | "newNextStep" | "actionType">
): ConsultationExpedienteArea {
  if (event.actionType === "consulta_creada") {
    return AREA_DISPLAY.atencion_cliente
  }

  if (event.previousNextStep) {
    return getConsultationExpedienteAreaForNextStep(event.previousNextStep)
  }

  if (event.newNextStep) {
    return getConsultationExpedienteAreaForNextStep(event.newNextStep)
  }

  return AREA_DISPLAY.atencion_cliente
}

export function getResponsibleAreaForAtencion(
  atencion: Pick<CustomerAtencion, "status" | "nextStep">
): ConsultationExpedienteArea | null {
  if (atencion.status === "resuelta") {
    return null
  }

  return getConsultationExpedienteAreaForNextStep(atencion.nextStep)
}

export type ConsultationSituationSummary = {
  statusLabel: string
  responsibleAreaLabel: string
  managementTypeLabel: string | null
  /** Descriptive present-tense situation (never an action verb). */
  situationLabel: string
  /** @deprecated Prefer situationLabel; kept for callers that still read it. */
  nextStepLabel: string
  lastInterventionAreaLabel: string
  lastUpdatedAt: string
  lastActorEmployeeId: string | null
  lastComment: string | null
}

export function buildConsultationSituationSummary(
  atencion: Pick<
    CustomerAtencion,
    "status" | "nextStep" | "updatedAt" | "resolution"
  >,
  events: readonly CustomerAtencionEvent[]
): ConsultationSituationSummary {
  const situation = describeNextStepSituation(atencion.nextStep)
  const responsible = getResponsibleAreaForAtencion(atencion)
  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const lastWithComment = findLastEventWithComment(events)

  const responsibleAreaLabel =
    situation?.responsibleAreaLabel ??
    (responsible ? formatConsultationExpedienteAreaPlainLabel(responsible) : "—")

  const situationLabel =
    atencion.status === "resuelta"
      ? "Consulta resuelta"
      : (situation?.situationLabel ?? formatCustomerAtencionStatusLabel(atencion.status))

  return {
    statusLabel: formatCustomerAtencionStatusLabel(atencion.status),
    responsibleAreaLabel,
    managementTypeLabel: situation?.managementTypeLabel ?? null,
    situationLabel,
    nextStepLabel: situationLabel,
    lastInterventionAreaLabel: lastEvent
      ? formatConsultationExpedienteAreaPlainLabel(
          getInterveningAreaForEvent(lastEvent)
        )
      : "—",
    lastUpdatedAt: lastEvent?.createdAt ?? atencion.updatedAt,
    lastActorEmployeeId: lastEvent?.employeeId ?? null,
    lastComment:
      lastWithComment?.detail?.trim() ||
      (atencion.status === "resuelta" ? atencion.resolution?.trim() || null : null),
  }
}

function findLastEventWithComment(
  events: readonly CustomerAtencionEvent[]
): CustomerAtencionEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const detail = events[index]?.detail?.trim()
    if (detail) {
      return events[index] ?? null
    }
  }

  return null
}

export type ConsultationTimelineFact = {
  label: string
  value: string
}

export type ConsultationTimelineCard = {
  id: string
  createdAt: string
  employeeId: string
  areaLabel: string
  /** Short lead after the operator name, e.g. "creó la consulta." */
  narrativeLead: string
  facts: ConsultationTimelineFact[]
  /** Closing narrative sentence (handoff, resolution summary, etc.). */
  closingNote: string | null
  comment: string | null
  commentLabel: string | null
  /** Legacy fields kept for any remaining callers. */
  actionLabel: string
  previousStatusLabel: string | null
  newStatusLabel: string | null
  previousNextStepLabel: string | null
  newNextStepLabel: string | null
}

export type ConsultationTimelineContext = {
  motivo?: CustomerAtencionMotivo | null
  detail?: string | null
  resolution?: string | null
}

export function buildConsultationTimelineCards(
  events: readonly CustomerAtencionEvent[],
  context: ConsultationTimelineContext = {}
): ConsultationTimelineCard[] {
  return events.map((event) => buildTimelineCard(event, context))
}

function buildTimelineCard(
  event: CustomerAtencionEvent,
  context: ConsultationTimelineContext
): ConsultationTimelineCard {
  const area = getInterveningAreaForEvent(event)
  const areaLabel = formatConsultationExpedienteAreaPlainLabel(area)
  const comment = event.detail?.trim() ? event.detail.trim() : null
  const base = {
    id: event.id,
    createdAt: event.createdAt,
    employeeId: event.employeeId,
    areaLabel,
    actionLabel: formatCustomerAtencionEventActionLabel(event.actionType),
    previousStatusLabel: formatOptionalStatus(event.previousStatus),
    newStatusLabel: formatOptionalStatus(event.newStatus),
    previousNextStepLabel: formatOptionalNextStep(event.previousNextStep),
    newNextStepLabel: formatOptionalNextStep(event.newNextStep),
  }

  switch (event.actionType) {
    case "consulta_creada": {
      const facts: ConsultationTimelineFact[] = []
      if (context.motivo) {
        facts.push({
          label: "Motivo",
          value: formatCustomerAtencionMotivoLabel(context.motivo),
        })
      }
      if (context.detail?.trim()) {
        facts.push({ label: "Detalle", value: context.detail.trim() })
      }

      return {
        ...base,
        narrativeLead: "creó la consulta.",
        facts,
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment: null,
        commentLabel: null,
      }
    }

    case "gestion_iniciada":
      return {
        ...base,
        narrativeLead: "tomó la consulta e inició la gestión.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: null,
        comment: null,
        commentLabel: null,
      }

    case "gestion_registrada":
      return {
        ...base,
        narrativeLead: "registró una intervención.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Gestión realizada" : null,
      }

    case "consulta_pendiente":
      return {
        ...base,
        narrativeLead: "dejó la consulta pendiente de continuación.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Resultado" : null,
      }

    case "consulta_resuelta":
      return {
        ...base,
        narrativeLead: "resolvió la consulta.",
        facts: [],
        closingNote: "Consulta resuelta.",
        comment: comment ?? context.resolution?.trim() ?? null,
        commentLabel: "Motivo de cierre",
      }

    case "proximo_paso_cambiado":
      return {
        ...base,
        narrativeLead: "actualizó el estado de la gestión.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Observaciones" : null,
      }

    case "consulta_ot_vinculada":
      return {
        ...base,
        narrativeLead: "vinculó una orden de trabajo a la consulta.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: null,
        comment,
        commentLabel: comment ? "Detalle" : null,
      }

    default:
      return {
        ...base,
        narrativeLead: "registró un evento en la consulta.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Detalle" : null,
      }
  }
}

function formatOptionalStatus(
  status: CustomerAtencionStatus | null | undefined
): string | null {
  if (!status) {
    return null
  }

  return formatCustomerAtencionStatusLabel(status)
}

function formatOptionalNextStep(
  nextStep: CustomerAtencionNextStep | null | undefined
): string | null {
  if (!nextStep) {
    return null
  }

  return formatCustomerAtencionNextStepLabel(nextStep)
}
