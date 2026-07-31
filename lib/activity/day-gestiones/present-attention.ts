import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { ACTIVITY_ACTIONS as LEGACY_CS } from "@/lib/activity-engine/activity-actions"
import {
  findFirstMetaString,
  findLastMetaString,
  groupHasAction,
  type DayGestionRawGroup,
} from "@/lib/activity/day-gestiones/group-events"
import { asBusinessCopy } from "@/lib/activity/day-gestiones/business-copy"
import type {
  DayGestion,
  DayGestionLink,
  DayGestionNameMaps,
  DayGestionStatusTone,
} from "@/lib/activity/day-gestiones/types"
import {
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionNextStepLabel,
  formatCustomerAtencionStatusLabel,
} from "@/lib/customer-atenciones/format"
import type {
  CustomerAtencionMotivo,
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

const CLOSED_ACTIONS = [
  ACTIVITY_EVENT_ACTIONS.ATTENTION_RESOLVED,
  LEGACY_CS.CASE_CLOSED,
] as const

const CREATED_ACTIONS = [
  ACTIVITY_EVENT_ACTIONS.ATTENTION_CREATED,
  LEGACY_CS.CASE_CREATED,
] as const

const CANCEL_STATUSES = new Set(["cancelada", "cancelled", "anulada"])

function formatDuration(fromIso: string, toIso: string): string | null {
  const from = new Date(fromIso).getTime()
  const to = new Date(toIso).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null
  const minutes = Math.round((to - from) / 60_000)
  if (minutes < 1) return "menos de 1 minuto"
  if (minutes === 1) return "1 minuto"
  if (minutes < 60) return `${minutes} minutos`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return hours === 1 ? "1 hora" : `${hours} horas`
  return `${hours}h ${rest}m`
}

function labelMotivo(raw: string | null): string | null {
  if (!raw) return null
  return formatCustomerAtencionMotivoLabel(raw as CustomerAtencionMotivo)
}

function labelStatus(raw: string | null): string | null {
  if (!raw) return null
  return formatCustomerAtencionStatusLabel(raw as CustomerAtencionStatus)
}

function labelNextStep(raw: string | null): string | null {
  if (!raw) return null
  return formatCustomerAtencionNextStepLabel(raw as CustomerAtencionNextStep)
}

function resolveAttentionStatus(group: DayGestionRawGroup): {
  label: string
  tone: DayGestionStatusTone
} {
  const lastStatus =
    findLastMetaString(group.events, "newStatus") ??
    findLastMetaString(group.events, "new_status") ??
    findLastMetaString(group.events, "status") ??
    findFirstMetaString(group.events, "estado_inicial")

  if (groupHasAction(group.events, CLOSED_ACTIONS)) {
    return { label: "Cerrado", tone: "done" }
  }

  if (lastStatus && CANCEL_STATUSES.has(lastStatus.toLowerCase())) {
    return { label: "Cancelado", tone: "cancelled" }
  }

  if (
    lastStatus === "resuelta" ||
    lastStatus === "resolved" ||
    lastStatus === "cerrada"
  ) {
    return { label: "Cerrado", tone: "done" }
  }

  if (groupHasAction(group.events, CREATED_ACTIONS) && group.events.length === 1) {
    return { label: "Nuevo", tone: "new" }
  }

  if (lastStatus) {
    return {
      label: labelStatus(lastStatus) ?? "Pendiente",
      tone: "pending",
    }
  }

  return { label: "Pendiente", tone: "pending" }
}

function resolveAttentionTitle(
  group: DayGestionRawGroup,
  statusTone: DayGestionStatusTone
): string {
  if (statusTone === "done") return "Expediente resuelto"
  if (
    groupHasAction(group.events, [
      ACTIVITY_EVENT_ACTIONS.ATTENTION_TRANSFERRED,
      LEGACY_CS.DERIVATION_CREATED,
    ])
  ) {
    return "Atención derivada"
  }
  if (
    groupHasAction(group.events, [
      ACTIVITY_EVENT_ACTIONS.ATTENTION_WORKORDER_GENERATED,
      LEGACY_CS.OT_CREATED,
    ])
  ) {
    return "OT generada desde atención"
  }
  if (groupHasAction(group.events, CREATED_ACTIONS)) {
    return "Atención registrada"
  }
  return "Gestión de atención"
}

function resolveResultCopy(group: DayGestionRawGroup): string | null {
  const toArea = findLastMetaString(group.events, "to_area")
  const nextStep =
    findLastMetaString(group.events, "new_next_step") ??
    findLastMetaString(group.events, "next_step")
  const nextLabel = labelNextStep(nextStep)

  if (groupHasAction(group.events, CLOSED_ACTIONS)) {
    const cierre =
      findLastMetaString(group.events, "motivoCierre") ??
      findLastMetaString(group.events, "motivo_cierre") ??
      findLastMetaString(group.events, "resolution")
    return cierre?.trim() || "Consulta resuelta."
  }

  if (toArea) {
    return `Derivada al área ${toArea}.`
  }
  if (nextLabel) {
    return `Próximo paso: ${nextLabel}.`
  }

  const last = group.events[group.events.length - 1]
  return (
    asBusinessCopy(last?.description) ??
    asBusinessCopy(last?.title) ??
    null
  )
}

/**
 * Present an attention gestion group as a business card.
 */
export function presentAttentionGestion(
  group: DayGestionRawGroup,
  names: DayGestionNameMaps
): DayGestion {
  const startedAt = group.events[0]!.createdAt
  const endedAt = group.events[group.events.length - 1]!.createdAt
  const status = resolveAttentionStatus(group)
  const title = resolveAttentionTitle(group, status.tone)

  const customerId =
    findFirstMetaString(group.events, "customer_id") ??
    findFirstMetaString(group.events, "customerId")
  const customerName = customerId
    ? names.customers.get(customerId) ?? null
    : null

  const motivoRaw = findFirstMetaString(group.events, "motivo")
  const motivo = labelMotivo(motivoRaw)

  const workOrderId =
    findLastMetaString(group.events, "workOrderId") ??
    findLastMetaString(group.events, "work_order_id") ??
    findLastMetaString(group.events, "task_id")

  const attentionId = group.entityId
  const duration =
    group.events.length > 1 ? formatDuration(startedAt, endedAt) : null
  const result = resolveResultCopy(group)

  const fields = [
    customerName || customerId
      ? {
          label: "Cliente",
          value: customerName ?? "Cliente",
        }
      : null,
    motivo ? { label: "Motivo", value: motivo } : null,
    result ? { label: "Resultado", value: result } : null,
    duration ? { label: "Tiempo", value: duration } : null,
  ].filter((field): field is { label: string; value: string } => Boolean(field))

  const links: DayGestionLink[] = []
  if (customerId) {
    links.push({
      kind: "customer",
      href: `/clientes/${customerId}`,
      label: "Ver Cliente",
    })
  }
  if (attentionId) {
    links.push({
      kind: "attention",
      href: `/atencion-cliente/${attentionId}`,
      label: "Ver Expediente",
    })
  }

  return {
    id: group.key,
    domain: "attention",
    startedAt,
    endedAt,
    title,
    statusLabel: status.label,
    statusTone: status.tone,
    fields,
    links,
    events: group.events,
    customerId,
    attentionId,
    workOrderId,
  }
}
