import type { ProjectWorkReportWorkOrder } from "@/lib/projects/work-report/types"

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export type ProjectWorkReportClientMeta = {
  label: string
  value: string
}

/** Fields the client-facing OT section must never print. */
export const PROJECT_WORK_REPORT_CLIENT_HIDDEN_LABELS = [
  "Cuadrilla",
  "Supervisor",
  "Técnico/s",
  "Inicio",
  "Fin",
  "Ubicación",
  "Código OT",
  "Trabajo",
] as const

export function projectWorkReportWorkOrderDate(
  order: Pick<ProjectWorkReportWorkOrder, "startDate" | "date">
): string | null {
  return order.startDate ?? order.date
}

export function projectWorkReportClientMeta(
  order: ProjectWorkReportWorkOrder
): ProjectWorkReportClientMeta[] {
  const fields: ProjectWorkReportClientMeta[] = []
  if (order.status) {
    fields.push({ label: "Estado", value: order.status })
  }
  const fecha = projectWorkReportWorkOrderDate(order)
  if (fecha) {
    fields.push({ label: "Fecha", value: fecha })
  }
  if (order.workType) {
    fields.push({ label: "Tipo de trabajo", value: order.workType })
  }
  return fields
}

export function isProjectWorkReportTechnicalCaption(
  value?: string | null
): boolean {
  const text = value?.trim() ?? ""
  if (!text) {
    return false
  }
  if (UUID_PATTERN.test(text)) {
    return true
  }
  if (/^\s*checklist\s*:/i.test(text)) {
    return true
  }
  return false
}

export function countProjectWorkReportPdfPages(pdf: Uint8Array): number {
  return (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [])
    .length
}
