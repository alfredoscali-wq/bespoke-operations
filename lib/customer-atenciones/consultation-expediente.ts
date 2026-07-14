import {
  formatCustomerAtencionEventActionLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import { getOperationalCategoryForNextStep } from "@/lib/customer-atenciones/shared-inbox"
import type { CustomerAtencionEvent } from "@/lib/types/customer-atencion-events"
import type {
  CustomerAtencion,
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
      label: "Técnica",
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
      label: "Pendiente de generar OT",
      marker: "🛠",
    },
  }

const ATENCION_FOLLOW_UP_STEPS = new Set<CustomerAtencionNextStep>([
  "seguimiento_cliente",
  "esperar_cliente",
])

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
  const responsible = getResponsibleAreaForAtencion(atencion)
  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const lastWithComment = findLastEventWithComment(events)

  return {
    statusLabel: formatCustomerAtencionStatusLabel(atencion.status),
    responsibleAreaLabel: responsible
      ? formatConsultationExpedienteAreaLabel(responsible)
      : "—",
    nextStepLabel: atencion.nextStep
      ? formatCustomerAtencionNextStepLabel(atencion.nextStep)
      : "—",
    lastInterventionAreaLabel: lastEvent
      ? formatConsultationExpedienteAreaLabel(getInterveningAreaForEvent(lastEvent))
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

export type ConsultationTimelineCard = {
  id: string
  createdAt: string
  employeeId: string
  areaLabel: string
  actionLabel: string
  previousStatusLabel: string | null
  newStatusLabel: string | null
  previousNextStepLabel: string | null
  newNextStepLabel: string | null
  comment: string | null
}

export function buildConsultationTimelineCards(
  events: readonly CustomerAtencionEvent[]
): ConsultationTimelineCard[] {
  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt,
    employeeId: event.employeeId,
    areaLabel: formatConsultationExpedienteAreaLabel(
      getInterveningAreaForEvent(event)
    ),
    actionLabel: formatCustomerAtencionEventActionLabel(event.actionType),
    previousStatusLabel: formatOptionalStatus(event.previousStatus),
    newStatusLabel: formatOptionalStatus(event.newStatus),
    previousNextStepLabel: formatOptionalNextStep(event.previousNextStep),
    newNextStepLabel: formatOptionalNextStep(event.newNextStep),
    comment: event.detail?.trim() ? event.detail : null,
  }))
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
