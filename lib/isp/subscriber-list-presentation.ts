import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { clients360PadronNumberFromId } from "@/lib/isp/clients-360-directory"
import { ISP_SUBSCRIBER_LIST_STATUS_LABELS } from "@/lib/isp/integrity"
import { ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE } from "@/lib/isp/subscriber-removal"
import type { IspCustomerListItem } from "@/lib/isp/types"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import type { Customer } from "@/lib/types/customers"

export type IspListStatusView = {
  label: string
  tone: VisualTone
}

export function ispSubscriberListStatusView(
  item: Pick<IspCustomerListItem, "listStatus" | "serviceCount">
): IspListStatusView {
  if (item.serviceCount === 0) {
    return { label: "Sin servicios", tone: "gray" }
  }

  const toneByStatus: Record<IspCustomerListItem["listStatus"], VisualTone> = {
    activo: "green",
    pendiente: "yellow",
    suspendido: "orange",
    baja: "red",
  }

  return {
    label: ISP_SUBSCRIBER_LIST_STATUS_LABELS[item.listStatus],
    tone: toneByStatus[item.listStatus],
  }
}

export function formatIspServiceCountLabel(count: number): string {
  return `${count} ${count === 1 ? "servicio" : "servicios"}`
}

export function formatIspConnectionCountLabel(count: number): string {
  return `${count} ${count === 1 ? "conexión" : "conexiones"}`
}

export const ISP_BESPOKE_ALTA_PENDING_ABNET_LABEL =
  "Alta Bespoke pendiente de ABNet"

export function presentBespokeListId(
  customerNumber: string | null | undefined
): string | null {
  const match = /^(?:CLI|BES)-(\d+)$/i.exec(customerNumber?.trim() ?? "")
  if (!match || /^0+$/.test(match[1])) return null
  return `Bes-${match[1]}`
}

export const CLIENTS_360_LIST_COLUMNS = [
  "Bespoke",
  "ABNet",
  "Cliente",
  "DNI/CUIT",
  "Plan comercial",
  "Conexiones",
  "Estado",
  "Localidad",
  "Acciones",
] as const

export function clients360BespokeColumnLabel(item: {
  directoryOrigin?: "bespoke" | "padron" | null
  bespokeCustomerNumber?: string | null
}): string | null {
  if (item.directoryOrigin === "padron") return null
  return presentBespokeListId(item.bespokeCustomerNumber)
}

export function clients360ClienteLabel(item: { name: string }): string {
  return item.name.trim()
}

export function clients360AbnetNumberLabel(
  code: string | null | undefined
): string | null {
  return abnetNumberFromExternalCode(code)
}

export const CLIENTS360_EDIT_FORBIDDEN_MESSAGE =
  "No tenés permiso para editar este registro de Clientes 360."

export function clients360ListRowActions(
  item: {
    id?: string | null
    directoryOrigin?: "bespoke" | "padron" | null
  },
  permissions: { canEdit: boolean; canRemove: boolean }
): {
  view: true
  edit: true
  remove: true
  ficha: boolean
  editBlockedReason: string | null
  removeBlockedReason: string | null
} {
  const padronOnly =
    item.directoryOrigin === "padron" ||
    (item.id ? clients360PadronNumberFromId(item.id) != null : false)
  return {
    view: true,
    edit: true,
    remove: true,
    ficha: !padronOnly,
    editBlockedReason: permissions.canEdit ? null : CLIENTS360_EDIT_FORBIDDEN_MESSAGE,
    removeBlockedReason: permissions.canRemove
      ? null
      : ISP_SUBSCRIBER_REMOVAL_FORBIDDEN_MESSAGE,
  }
}

export function formatIspAbonadoCode(
  code: string | null | undefined
): string | null {
  const value = code?.trim()
  return value ? `Abonado #${value}` : null
}

export function formatIspCustomerCodeValue(
  code: string | null | undefined
): string {
  return code?.trim() || ISP_BESPOKE_ALTA_PENDING_ABNET_LABEL
}

export function formatIspCustomerReference(
  code: string | null | undefined
): string {
  return formatIspAbonadoCode(code) ?? ISP_BESPOKE_ALTA_PENDING_ABNET_LABEL
}

export function toggleVisibleSubscriberSelection(
  selectedIds: ReadonlySet<string>,
  visibleIds: readonly string[],
  checked: boolean
): Set<string> {
  const next = new Set(selectedIds)
  for (const id of visibleIds) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  return next
}

export function visibleSubscriberSelectionState(
  selectedIds: ReadonlySet<string>,
  visibleIds: readonly string[]
): "none" | "some" | "all" {
  if (visibleIds.length === 0) return "none"
  const selectedVisible = visibleIds.filter((id) => selectedIds.has(id)).length
  if (selectedVisible === 0) return "none"
  if (selectedVisible === visibleIds.length) return "all"
  return "some"
}

export function mergeSelectedSubscribers(
  current: Map<string, IspCustomerListItem>,
  items: readonly IspCustomerListItem[],
  selectedIds: ReadonlySet<string>
): Map<string, IspCustomerListItem> {
  const next = new Map(current)
  for (const id of [...next.keys()]) {
    if (!selectedIds.has(id)) next.delete(id)
  }
  for (const item of items) {
    if (selectedIds.has(item.id)) next.set(item.id, item)
  }
  return next
}

export function ispListItemToCustomer(item: IspCustomerListItem): Customer {
  return {
    id: item.id,
    customerNumber: item.externalCustomerCode ?? "",
    externalCustomerCode: item.externalCustomerCode ?? undefined,
    dni: item.dni ?? undefined,
    name: item.name,
    phone: item.phone ?? undefined,
    email: item.email ?? undefined,
    whatsapp: item.whatsapp ?? undefined,
    address: item.address ?? undefined,
    locality: item.locality ?? undefined,
    status: item.status,
    validationStatus: "active",
    createdAt: item.createdAt,
    updatedAt: item.lastActivityAt ?? item.createdAt,
  }
}

export function exportIspSubscribersCsv(items: IspCustomerListItem[]): void {
  const headers = [
    "Origen",
    "Nombre",
    "DNI/CUIT",
    "Teléfono",
    "WhatsApp",
    "Email",
    "Domicilio",
    "Localidad",
    "Plan comercial",
    "Estado del padrón",
    "Gratuidad",
    "Conexiones del padrón",
    "Servicios técnicos Bespoke",
    "Conexiones técnicas Bespoke",
  ]

  const rows = items.map((item) => {
    const imported = item.directoryOrigin === "padron"
    return [
      imported ? "Padrón ABNet" : "Ficha Bespoke",
      item.name,
      item.dni ?? "",
      item.phone ?? "",
      item.whatsapp ?? "",
      item.email ?? "",
      item.address ?? "",
      item.locality ?? "",
      item.commercialPlanLabel ?? "",
      item.registryStatusLabel ?? "",
      item.registryGratisLabel ?? "",
      String(item.registryConnectionCount ?? 0),
      String(item.serviceCount),
      String(item.connectionCount),
    ]
  })

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `abonados-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
