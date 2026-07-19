import {
  formatCustomerAtencionEventActionLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import {
  formatResolveFollowUpClosingNote,
  parseResolveEventDetail,
} from "@/lib/customer-atenciones/consultation-follow-up"
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

/**
 * RC 3.1.7 — inbox column "Situación Actual": current responsibility / outcome,
 * never an imperative action verb ("Derivar a…").
 */
export function formatConsultationInboxSituationLabel(row: {
  status: CustomerAtencionStatus
  nextStep?: CustomerAtencionNextStep | null
}): string {
  if (row.status === "resuelta") {
    return "Consulta resuelta"
  }

  switch (row.nextStep) {
    case "contactar_cliente":
      return "Derivada a Ventas"
    case "resolver_consulta_tecnica":
      return "Derivada a Técnica"
    case "derivar_admin_facturacion":
    case "derivar_admin_morosos":
    case "derivar_admin_gestion":
      return "Derivada a Administración"
    case "esperar_cliente":
      return "Esperando respuesta del cliente"
    case "realizar_retencion":
      return "Pendiente de retención"
    case "generar_ot":
      return "OT pendiente de generar"
    case "seguimiento_cliente":
      return row.status === "en_gestion"
        ? "En gestión por Atención al Cliente"
        : "Pendiente de contactar al cliente"
    default:
      break
  }

  if (row.status === "en_gestion") {
    return "En gestión por Atención al Cliente"
  }

  if (row.status === "nueva") {
    return "Pendiente de atención"
  }

  return formatCustomerAtencionStatusLabel(row.status)
}

/**
 * RC 3.1.8 — compact badge for the "Estado actual" executive card.
 * Aligned with bandeja / responsible area, not imperative actions.
 */
export function formatConsultationEstadoActualBadge(row: {
  status: CustomerAtencionStatus
  nextStep?: CustomerAtencionNextStep | null
  linkedTaskId?: string | null
}): string {
  if (row.linkedTaskId || row.status === "resuelta") {
    return "Resuelta"
  }

  switch (row.nextStep) {
    case "contactar_cliente":
      return "En Ventas"
    case "resolver_consulta_tecnica":
      return "En Técnica"
    case "derivar_admin_facturacion":
    case "derivar_admin_morosos":
    case "derivar_admin_gestion":
      return "En Administración"
    case "esperar_cliente":
      return "Esperando Cliente"
    case "realizar_retencion":
      return "En Atención al Cliente"
    case "generar_ot":
      return "OT pendiente"
    case "seguimiento_cliente":
      return "En Atención al Cliente"
    default:
      break
  }

  if (row.status === "en_gestion" || row.status === "nueva") {
    return "En Atención al Cliente"
  }

  return formatCustomerAtencionStatusLabel(row.status)
}

/**
 * RC 3.2.4 — contextual one-sentence summary for the "Estado actual" card.
 * Describes what is happening now; does not narrate area handoffs.
 * `derivedBy` is ignored (kept for call-site compatibility).
 */
export function formatConsultationEstadoActualSummary(
  row: {
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
    linkedTaskId?: string | null
  },
  _options?: { derivedBy?: string | null }
): string {
  // RC 3.2.7 — OT link closes Atención; Operaciones continues on the work order.
  if (row.linkedTaskId) {
    return "Consulta resuelta. Se generó correctamente una Orden de Trabajo para continuar el proceso operativo."
  }

  if (row.status === "resuelta") {
    return "La consulta fue resuelta correctamente."
  }

  switch (row.nextStep) {
    case "contactar_cliente":
      return "Se está evaluando la solicitud comercial del cliente."
    case "resolver_consulta_tecnica":
      return "Se está analizando el inconveniente técnico informado por el cliente."
    case "derivar_admin_facturacion":
    case "derivar_admin_morosos":
    case "derivar_admin_gestion":
      return "Se está analizando la consulta administrativa o de facturación."
    case "esperar_cliente":
      return "Se está esperando una respuesta del cliente para continuar la gestión."
    case "realizar_retencion":
      return "El operador se encuentra gestionando la consulta."
    case "generar_ot":
      return "La consulta está pendiente de generar una Orden de Trabajo."
    case "seguimiento_cliente":
      return "El operador se encuentra gestionando la consulta."
    default:
      if (row.status === "en_gestion") {
        return "El operador se encuentra gestionando la consulta."
      }
      if (row.status === "nueva") {
        return "La consulta está pendiente de atención."
      }
      return `La consulta se encuentra ${formatCustomerAtencionStatusLabel(row.status).toLowerCase()}.`
  }
}

/** True when "derivada por X" would repeat the area that currently owns the case. */
export function isRedundantEstadoActualDerivation(
  row: {
    status: CustomerAtencionStatus
    nextStep?: CustomerAtencionNextStep | null
  },
  derivedBy: string | null | undefined
): boolean {
  const from = derivedBy?.trim()
  if (!from) {
    return false
  }

  const current =
    describeNextStepSituation(row.nextStep)?.responsibleAreaLabel ??
    (row.status === "resuelta" ? null : "Atención al Cliente")

  if (!current) {
    return false
  }

  return normalizeAreaLabel(from) === normalizeAreaLabel(current)
}

function normalizeAreaLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/^area\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
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

/**
 * Presentation-only expediente reference derived from the consultation id.
 * Does not invent a DB column — short stable display code for the sticky header.
 */
export function formatConsultationExpedienteCode(atencionId: string): string {
  const compact = atencionId.replace(/-/g, "").toUpperCase()
  return `AT-${compact.slice(0, 5)}`
}

/** Relative age for prioritization: "Hace 2 horas", "Hace 3 días", etc. */
export function formatConsultationRelativeAge(
  isoDate: string,
  now: Date = new Date()
): string {
  const created = new Date(isoDate).getTime()
  if (Number.isNaN(created)) {
    return "—"
  }

  const diffMs = Math.max(0, now.getTime() - created)
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) {
    return "Hace unos segundos"
  }
  if (minutes < 60) {
    return minutes === 1 ? "Hace 1 minuto" : `Hace ${minutes} minutos`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return hours === 1 ? "Hace 1 hora" : `Hace ${hours} horas`
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return days === 1 ? "Hace 1 día" : `Hace ${days} días`
  }

  const weeks = Math.floor(days / 7)
  if (weeks < 5) {
    return weeks === 1 ? "Hace 1 semana" : `Hace ${weeks} semanas`
  }

  const months = Math.floor(days / 30)
  if (months < 12) {
    return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`
  }

  const years = Math.floor(days / 365)
  return years === 1 ? "Hace 1 año" : `Hace ${years} años`
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
        /** Area that performed the derivation (e.g. Atención al Cliente). */
        fromAreaLabel: string
        actorName: string
        dateTime: string
        dateTimeIso: string | null
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
        fromAreaLabel: handoffEvent
          ? formatConsultationExpedienteAreaPlainLabel(
              getInterveningAreaForEvent(handoffEvent)
            )
          : "Atención al Cliente",
        actorName,
        dateTime,
        dateTimeIso: handoffEvent?.createdAt ?? null,
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

/** Plain paragraphs for the sticky situation band (UX 2.7). */
export function formatConsultationSituationBand(
  narrative: ConsultationSituationNarrative
): string[] {
  const paragraphs: string[] = [
    `La consulta se encuentra ${narrative.statusEmphasis}.`,
  ]

  if (narrative.handoff?.kind === "derivation") {
    let line = `Actualmente está asignada a ${narrative.handoff.areaLabel}`
    if (narrative.managementTypeLabel) {
      line += ` (${narrative.managementTypeLabel})`
    }
    line += `. Derivada por ${narrative.handoff.actorName} el ${narrative.handoff.dateTime}.`
    paragraphs.push(line)
  } else if (narrative.handoff?.kind === "atencion") {
    const description = narrative.handoff.description.trim()
    paragraphs.push(
      description.toLowerCase().startsWith("se encuentra")
        ? `Actualmente ${description.charAt(0).toLowerCase()}${description.slice(1)}`
        : description
    )
  } else if (narrative.closingNote) {
    paragraphs.push(narrative.closingNote)
  }

  return paragraphs
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
  const lastEvent =
    [...events].reverse().find((event) => !isConsultationTimelineNoiseEvent(event)) ??
    null
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
    lastComment: (() => {
      if (lastWithComment?.detail?.trim()) {
        if (lastWithComment.actionType === "consulta_resuelta") {
          return (
            parseResolveEventDetail(lastWithComment.detail).resolution || null
          )
        }
        return lastWithComment.detail.trim()
      }
      return atencion.status === "resuelta"
        ? atencion.resolution?.trim() || null
        : null
    })(),
  }
}

function findLastEventWithComment(
  events: readonly CustomerAtencionEvent[]
): CustomerAtencionEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (!event || isConsultationTimelineNoiseEvent(event)) {
      continue
    }
    const detail = event.detail?.trim()
    if (detail) {
      return event
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
  /** Uppercase expediente event title (UX 2.7). */
  eventTitle: string
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

/** RC 3.1.4 — UI-only ownership take; not real operational work. */
export function isConsultationTimelineNoiseEvent(
  event: Pick<CustomerAtencionEvent, "actionType">
): boolean {
  return event.actionType === "gestion_iniciada"
}

export function buildConsultationTimelineCards(
  events: readonly CustomerAtencionEvent[],
  context: ConsultationTimelineContext = {}
): ConsultationTimelineCard[] {
  return events
    .filter((event) => !isConsultationTimelineNoiseEvent(event))
    .map((event) => buildTimelineCard(event, context))
}

function resolveExpedienteEventTitle(
  event: Pick<
    CustomerAtencionEvent,
    "actionType" | "previousNextStep" | "newNextStep"
  >
): string {
  switch (event.actionType) {
    case "consulta_creada":
      return "CREACIÓN DE LA CONSULTA"
    case "gestion_iniciada":
      return "INICIO DE GESTIÓN"
    case "consulta_resuelta":
      return "CIERRE DE CONSULTA"
    case "consulta_ot_vinculada":
      return "GENERACIÓN DE OT"
    case "gestion_liberada_por_inactividad":
      return "GESTIÓN LIBERADA POR INACTIVIDAD"
    case "gestion_registrada":
    case "consulta_pendiente": {
      const area = getInterveningAreaForEvent(event)
      switch (area.key) {
        case "administracion":
        case "morosos":
          return event.actionType === "consulta_pendiente"
            ? "RESPUESTA DE ADMINISTRACIÓN"
            : "GESTIÓN ADMINISTRATIVA"
        case "tecnica":
        case "generar_ot":
          return "ANÁLISIS TÉCNICO"
        case "ventas":
          return "GESTIÓN COMERCIAL"
        case "retenciones":
          return "GESTIÓN DE RETENCIÓN"
        default:
          return "CONTACTO CON CLIENTE"
      }
    }
    case "proximo_paso_cambiado": {
      switch (event.newNextStep) {
        case "seguimiento_cliente":
          return "CONTACTO CON CLIENTE"
        case "esperar_cliente":
          return "ESPERA DE RESPUESTA DEL CLIENTE"
        case "realizar_retencion":
          return "DERIVACIÓN A RETENCIÓN"
        case "resolver_consulta_tecnica":
          return "DERIVACIÓN A ÁREA TÉCNICA"
        case "derivar_admin_facturacion":
        case "derivar_admin_morosos":
        case "derivar_admin_gestion":
          return "DERIVACIÓN A ADMINISTRACIÓN"
        case "contactar_cliente":
          return "DERIVACIÓN A VENTAS"
        case "generar_ot":
          return "GENERACIÓN DE OT"
        default:
          return "ACTUALIZACIÓN DE LA GESTIÓN"
      }
    }
    default:
      return "REGISTRO EN EL EXPEDIENTE"
  }
}

function buildTimelineCard(
  event: CustomerAtencionEvent,
  context: ConsultationTimelineContext
): ConsultationTimelineCard {
  const area = getInterveningAreaForEvent(event)
  const areaLabel = formatConsultationExpedienteAreaPlainLabel(area)
  const comment = event.detail?.trim() ? event.detail.trim() : null
  const eventTitle = resolveExpedienteEventTitle(event)
  const base = {
    id: event.id,
    createdAt: event.createdAt,
    employeeId: event.employeeId,
    areaLabel,
    eventTitle,
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
        commentLabel: comment ? "Información registrada" : null,
      }

    case "consulta_pendiente":
      return {
        ...base,
        narrativeLead: "dejó la consulta pendiente de continuación.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Resultado de esa gestión" : null,
      }

    case "consulta_resuelta": {
      const resolved = parseResolveEventDetail(comment ?? event.detail)
      const followUpNote = formatResolveFollowUpClosingNote(
        resolved.followUpActions
      )
      return {
        ...base,
        narrativeLead: "resolvió la consulta.",
        facts: [],
        closingNote: followUpNote ?? "Consulta resuelta.",
        comment:
          resolved.resolution ||
          context.resolution?.trim() ||
          null,
        commentLabel: "Resultado de esa gestión",
      }
    }

    case "proximo_paso_cambiado":
      return {
        ...base,
        narrativeLead: "actualizó el estado de la gestión.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Información registrada" : null,
      }

    case "consulta_ot_vinculada":
      return {
        ...base,
        narrativeLead: "vinculó una orden de trabajo y cerró la consulta en Atención.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote:
          "Consulta resuelta. El seguimiento continúa en Operaciones.",
        comment,
        commentLabel: comment ? "Información registrada" : null,
      }

    case "gestion_liberada_por_inactividad":
      return {
        ...base,
        narrativeLead: "liberó la gestión por inactividad.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote:
          event.detail?.trim() ||
          "El bloqueo exclusivo se liberó automáticamente.",
        comment: null,
        commentLabel: null,
      }

    default:
      return {
        ...base,
        narrativeLead: "registró un evento en la consulta.",
        facts: [{ label: "Área", value: areaLabel }],
        closingNote: describeNextStepHandoff(event.newNextStep),
        comment,
        commentLabel: comment ? "Información registrada" : null,
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
