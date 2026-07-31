/**
 * UX-only helpers for Actividad de la Jornada filters / emphasis / narratives.
 * Does not alter DayGestion builders or Indicator Engine.
 */

import type { DayGestion } from "@/lib/activity/day-gestiones"
import type { ExecutiveBrief } from "@/lib/executive"
import { indicatorCount, INDICATOR_IDS } from "@/lib/indicators"

export type DayActivityFilterId =
  | "all"
  | "resolved"
  | "pending"
  | "workorders"
  | "transferred"
  | "sales"
  | "retentions"
  | "new_customers"

export const DAY_ACTIVITY_QUICK_FILTERS: ReadonlyArray<{
  id: DayActivityFilterId
  label: string
}> = [
  { id: "all", label: "Todas" },
  { id: "resolved", label: "Resueltas" },
  { id: "pending", label: "Pendientes" },
  { id: "workorders", label: "OT" },
  { id: "transferred", label: "Derivadas" },
  { id: "sales", label: "Ventas" },
  { id: "retentions", label: "Retenciones" },
  { id: "new_customers", label: "Nuevos clientes" },
]

/**
 * Standard Bespoke executive narrative: Volume → Result → Actions.
 * Never mix these dimensions in one sentence.
 */
export type ProductionSummarySection = {
  title: string
  items: string[]
}

export type ProductionSummary = {
  /** Volume line — how much work was managed. */
  volumeLine: string
  results: ProductionSummarySection | null
  actions: ProductionSummarySection | null
  /** True when there is nothing meaningful to show beyond the empty volume line. */
  isEmpty: boolean
}

function pluralize(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? singular : plural
}

/**
 * Builds the hierarchical production summary from existing Indicator Engine values.
 * Pending = max(0, created − resolved) — same presentation math as KPI cards.
 */
export function buildProductionSummary(
  employeeName: string,
  brief: ExecutiveBrief,
  narrativePrefix: string
): ProductionSummary {
  const get = (id: string) => indicatorCount(brief.snapshot, id)
  const attended = get(INDICATOR_IDS.ATTENTIONS_CREATED)
  const resolved = get(INDICATOR_IDS.ATTENTIONS_RESOLVED)
  const pending = Math.max(0, attended - resolved)
  const transferred = get(INDICATOR_IDS.ATTENTIONS_TRANSFERRED)
  const ot = get(INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED)
  const retentions = get(INDICATOR_IDS.RETENTIONS)
  const sales = get(INDICATOR_IDS.COMMERCIAL_COMPLETED)
  const customers = get(INDICATOR_IDS.CUSTOMERS_CREATED)

  const resultItems: string[] = []
  if (resolved > 0) {
    resultItems.push(
      `${resolved} ${pluralize(resolved, "expediente fue resuelto", "expedientes fueron resueltos")}.`
    )
  }
  if (pending > 0) {
    resultItems.push(
      `${pending} ${pluralize(pending, "permanece pendiente", "permanecen pendientes")}.`
    )
  }

  const actionItems: string[] = []
  if (transferred > 0) {
    actionItems.push(
      `${transferred} ${pluralize(transferred, "derivación a otras áreas", "derivaciones a otras áreas")}.`
    )
  }
  if (ot > 0) {
    actionItems.push(
      `${ot} ${pluralize(ot, "orden de trabajo generada", "órdenes de trabajo generadas")}.`
    )
  }
  if (retentions > 0) {
    actionItems.push(
      `${retentions} ${pluralize(retentions, "retención registrada", "retenciones registradas")}.`
    )
  }
  if (sales > 0) {
    actionItems.push(
      `${sales} ${pluralize(sales, "venta registrada", "ventas registradas")}.`
    )
  }
  if (customers > 0) {
    actionItems.push(
      `${customers} ${pluralize(customers, "cliente nuevo incorporado", "clientes nuevos incorporados")}.`
    )
  }

  const hasResults = resultItems.length > 0
  const hasActions = actionItems.length > 0
  const isEmpty = attended <= 0 && !hasActions

  let volumeLine: string
  if (attended > 0) {
    volumeLine = `${narrativePrefix}, ${employeeName} gestionó ${attended} ${pluralize(attended, "expediente", "expedientes")}.`
  } else if (hasActions) {
    volumeLine = `${narrativePrefix}, ${employeeName} no gestionó expedientes de atención.`
  } else {
    volumeLine = `${narrativePrefix}, ${employeeName} no registró producción relevante.`
  }

  return {
    volumeLine,
    results:
      attended > 0 && hasResults
        ? { title: "Resultado de la gestión", items: resultItems }
        : null,
    actions: hasActions
      ? { title: "Acciones realizadas", items: actionItems }
      : null,
    isEmpty,
  }
}

/** Plain-text form for PDF / CSV-adjacent exports. */
export function formatProductionSummaryPlainText(
  summary: ProductionSummary
): string {
  const parts: string[] = [summary.volumeLine]

  if (summary.results) {
    parts.push("")
    parts.push(summary.results.title)
    for (const item of summary.results.items) {
      parts.push(`• ${item}`)
    }
  }

  if (summary.actions) {
    parts.push("")
    parts.push(summary.actions.title)
    for (const item of summary.actions.items) {
      parts.push(`• ${item}`)
    }
  }

  return parts.join("\n")
}

function textBlob(gestion: DayGestion): string {
  return [
    gestion.title,
    gestion.statusLabel,
    ...gestion.fields.map((field) => `${field.label} ${field.value}`),
  ]
    .join(" ")
    .toLocaleLowerCase("es")
}

export function matchesDayActivityFilter(
  gestion: DayGestion,
  filter: DayActivityFilterId
): boolean {
  if (filter === "all") return true

  const blob = textBlob(gestion)

  switch (filter) {
    case "resolved":
      return gestion.statusTone === "done"
    case "pending":
      return (
        gestion.statusTone === "pending" || gestion.statusTone === "new"
      )
    case "workorders":
      return (
        Boolean(gestion.workOrderId) ||
        blob.includes("ot generada") ||
        blob.includes("orden de trabajo") ||
        gestion.links.some((link) => link.kind === "workorder")
      )
    case "transferred":
      return (
        blob.includes("derivad") ||
        blob.includes("transfer") ||
        gestion.title.toLocaleLowerCase("es").includes("derivada")
      )
    case "sales":
      return (
        blob.includes("venta") ||
        blob.includes("comercial") ||
        gestion.title.toLocaleLowerCase("es").includes("actividad comercial")
      )
    case "retentions":
      return blob.includes("retención") || blob.includes("retencion")
    case "new_customers":
      return (
        blob.includes("cliente nuevo") ||
        blob.includes("cliente creado") ||
        (gestion.domain === "generic" &&
          blob.includes("cliente") &&
          (blob.includes("creado") || blob.includes("nuevo")))
      )
    default:
      return true
  }
}

export type DayGestionEmphasis =
  | "workorder"
  | "sale"
  | "retention"
  | "incident"
  | "new_customer"
  | null

/** Subtle hierarchy for important business outcomes. */
export function resolveDayGestionEmphasis(
  gestion: DayGestion
): DayGestionEmphasis {
  const blob = textBlob(gestion)
  if (
    Boolean(gestion.workOrderId) ||
    blob.includes("ot generada") ||
    gestion.links.some((link) => link.kind === "workorder")
  ) {
    return "workorder"
  }
  if (blob.includes("retención") || blob.includes("retencion")) {
    return "retention"
  }
  if (blob.includes("venta") && blob.includes("concret")) {
    return "sale"
  }
  if (blob.includes("venta") || blob.includes("comercial complet")) {
    return "sale"
  }
  if (blob.includes("incidencia") || blob.includes("crític")) {
    return "incident"
  }
  if (
    blob.includes("cliente nuevo") ||
    blob.includes("cliente creado") ||
    (blob.includes("cliente") && blob.includes("incorpor"))
  ) {
    return "new_customer"
  }
  return null
}

export const DAY_GESTION_EMPHASIS_LABEL: Record<
  Exclude<DayGestionEmphasis, null>,
  string
> = {
  workorder: "Generó OT",
  sale: "Venta",
  retention: "Retención",
  incident: "Incidencia",
  new_customer: "Cliente nuevo",
}
