import { canonicalizeActivityModule } from "@/lib/indicators/module-aliases"
import { formatActivityModuleLabel } from "@/lib/activity/activity-viewer-labels"
import { asBusinessCopy } from "@/lib/activity/day-gestiones/business-copy"
import {
  findFirstMetaString,
  findLastMetaString,
  type DayGestionRawGroup,
} from "@/lib/activity/day-gestiones/group-events"
import type {
  DayGestion,
  DayGestionLink,
  DayGestionNameMaps,
  DayGestionStatusTone,
} from "@/lib/activity/day-gestiones/types"

function genericTitle(group: DayGestionRawGroup): string {
  const last = group.events[group.events.length - 1]
  const first = group.events[0]
  const title =
    asBusinessCopy(last?.title) ?? asBusinessCopy(first?.title)
  if (title) return title

  const moduleLabel = formatActivityModuleLabel(
    canonicalizeActivityModule(first?.module ?? "activity")
  )
  return `Actividad en ${moduleLabel}`
}

function genericStatus(group: DayGestionRawGroup): {
  label: string
  tone: DayGestionStatusTone
} {
  const actions = group.events.map((event) => event.action)
  if (actions.some((action) => /cancel|deleted|archiv/i.test(action))) {
    return { label: "Cancelado", tone: "cancelled" }
  }
  if (
    actions.some((action) =>
      /finished|resolved|completed|closed|finaliz/i.test(action)
    )
  ) {
    return { label: "Finalizado", tone: "done" }
  }
  if (
    actions.some((action) => /created|\.create/i.test(action)) &&
    group.events.length === 1
  ) {
    return { label: "Nuevo", tone: "new" }
  }
  return { label: "Pendiente", tone: "pending" }
}

function entityHref(
  entityType: string,
  entityId: string
): DayGestionLink | null {
  switch (entityType) {
    case "customer":
      return {
        kind: "customer",
        href: `/clientes/${entityId}`,
        label: "Ver Cliente",
      }
    case "project":
      return {
        kind: "project",
        href: `/obras/${entityId}`,
        label: "Ver Obra",
      }
    case "request":
      return {
        kind: "request",
        href: `/gestion-comercial?solicitud=${entityId}`,
        label: "Ver Solicitud",
      }
    case "workorder":
    case "task":
      return {
        kind: "workorder",
        href: `/tareas/${entityId}`,
        label: "Ver OT",
      }
    case "employee":
      return {
        kind: "employee",
        href: `/rrhh/${entityId}`,
        label: "Ver Empleado",
      }
    default:
      return null
  }
}

/**
 * Generic business card for non-attention domains (V1).
 * Groups by entity; uses title/description already on events.
 */
export function presentGenericGestion(
  group: DayGestionRawGroup,
  names: DayGestionNameMaps
): DayGestion {
  const startedAt = group.events[0]!.createdAt
  const endedAt = group.events[group.events.length - 1]!.createdAt
  const status = genericStatus(group)
  const last = group.events[group.events.length - 1]!
  const result =
    asBusinessCopy(last.description) ||
    (group.events.length > 1
      ? `${group.events.length} actualizaciones en esta gestión.`
      : null)

  const customerId =
    findFirstMetaString(group.events, "customer_id") ??
    findFirstMetaString(group.events, "customerId")
  const customerName = customerId
    ? names.customers.get(customerId) ?? null
    : null

  const workOrderId =
    findLastMetaString(group.events, "workOrderId") ??
    findLastMetaString(group.events, "task_id") ??
    (group.entityType === "workorder" || group.entityType === "task"
      ? group.entityId
      : null)

  const fields = [
    customerName
      ? { label: "Cliente", value: customerName }
      : null,
    {
      label: "Área",
      value: formatActivityModuleLabel(
        canonicalizeActivityModule(group.events[0]!.module)
      ),
    },
    result ? { label: "Resultado", value: result } : null,
  ].filter((field): field is { label: string; value: string } => Boolean(field))

  const links: DayGestionLink[] = []
  if (customerId) {
    links.push({
      kind: "customer",
      href: `/clientes/${customerId}`,
      label: "Ver Cliente",
    })
  }
  if (group.entityId) {
    const link = entityHref(group.entityType, group.entityId)
    if (link) links.push(link)
  }
  if (workOrderId && !links.some((link) => link.kind === "workorder")) {
    links.push({
      kind: "workorder",
      href: `/tareas/${workOrderId}`,
      label: "Ver OT",
    })
  }

  return {
    id: group.key,
    domain: "generic",
    startedAt,
    endedAt,
    title: genericTitle(group),
    statusLabel: status.label,
    statusTone: status.tone,
    fields,
    links,
    events: group.events,
    customerId,
    attentionId: null,
    workOrderId,
  }
}
