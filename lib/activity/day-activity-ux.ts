/**
 * UX-only helpers for Actividad de la Jornada filters / emphasis.
 * Does not alter DayGestion builders or Indicator Engine.
 */

import type { DayGestion } from "@/lib/activity/day-gestiones"

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
