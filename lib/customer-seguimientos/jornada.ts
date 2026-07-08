import {
  formatCustomerAtencionChannelLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionResultadoLabel,
} from "@/lib/customer-atenciones/format"
import { formatCustomerRetencionResultadoLabel } from "@/lib/customer-retenciones/format"
import type { CustomerAtencion } from "@/lib/types/customer-atenciones"
import type { CustomerRetencionJornadaRow } from "@/lib/types/customer-retenciones"
import type { CustomerSeguimientoJornadaRow } from "@/lib/types/customer-seguimientos"

export type JornadaEntryKind = "atencion" | "seguimiento" | "retencion"

export type JornadaEntry = {
  id: string
  kind: JornadaEntryKind
  occurredAt: string
  customerId: string
  customerName: string
  title: string
  subtitle: string
  detail: string
  tone: "green" | "blue" | "neutral"
  atencionResultado?: CustomerAtencion["resultado"]
}

export type JornadaFilter =
  | "all"
  | "atenciones"
  | "resueltas"
  | "seguimientos"
  | "retenciones"

export function buildAtencionJornadaEntry(
  atencion: CustomerAtencion,
  customerName: string
): JornadaEntry {
  return {
    id: atencion.id,
    kind: "atencion",
    occurredAt: atencion.createdAt,
    customerId: atencion.customerId,
    customerName,
    title: "Atención",
    subtitle: `${customerName} · ${formatCustomerAtencionChannelLabel(atencion.channel)}`,
    detail: `${formatCustomerAtencionMotivoLabel(atencion.motivo)} → ${formatCustomerAtencionResultadoLabel(atencion.resultado)}`,
    tone: atencion.resultado === "resuelta" ? "green" : "blue",
    atencionResultado: atencion.resultado,
  }
}

export function buildSeguimientoJornadaEntry(
  seguimiento: CustomerSeguimientoJornadaRow
): JornadaEntry {
  return {
    id: seguimiento.id,
    kind: "seguimiento",
    occurredAt: seguimiento.completedAt,
    customerId: seguimiento.customerId,
    customerName: seguimiento.customerName,
    title: "Seguimiento",
    subtitle: seguimiento.customerName,
    detail: `${seguimiento.completionAction} → Resuelto`,
    tone: "green",
  }
}

export function buildRetencionJornadaEntry(
  retencion: CustomerRetencionJornadaRow
): JornadaEntry {
  return {
    id: retencion.id,
    kind: "retencion",
    occurredAt: retencion.completedAt,
    customerId: retencion.customerId,
    customerName: retencion.customerName,
    title: "Retención",
    subtitle: retencion.customerName,
    detail: `${formatCustomerRetencionResultadoLabel(retencion.resultado)} · ${retencion.resolution}`,
    tone: retencion.resultado === "retenido" ? "green" : "neutral",
  }
}

export function buildJornadaEntries(input: {
  atenciones: Array<{ atencion: CustomerAtencion; customerName: string }>
  seguimientos: CustomerSeguimientoJornadaRow[]
  retenciones?: CustomerRetencionJornadaRow[]
}): JornadaEntry[] {
  const entries = [
    ...input.atenciones.map(({ atencion, customerName }) =>
      buildAtencionJornadaEntry(atencion, customerName)
    ),
    ...input.seguimientos.map(buildSeguimientoJornadaEntry),
    ...(input.retenciones ?? []).map(buildRetencionJornadaEntry),
  ]

  return entries.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  )
}

export function filterJornadaEntries(
  entries: JornadaEntry[],
  filter: JornadaFilter
): JornadaEntry[] {
  switch (filter) {
    case "atenciones":
      return entries.filter((entry) => entry.kind === "atencion")
    case "resueltas":
      return entries.filter(
        (entry) =>
          entry.kind === "atencion" && entry.atencionResultado === "resuelta"
      )
    case "seguimientos":
      return entries.filter((entry) => entry.kind === "seguimiento")
    case "retenciones":
      return entries.filter((entry) => entry.kind === "retencion")
    default:
      return entries
  }
}
