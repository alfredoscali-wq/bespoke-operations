import { ISP_SUBSCRIBER_LIST_STATUS_LABELS } from "@/lib/isp/integrity"
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

export function formatIspAbonadoCode(
  code: string | null | undefined
): string | null {
  const value = code?.trim()
  return value ? `Abonado #${value}` : null
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
    "Nombre",
    "DNI/CUIT",
    "Teléfono",
    "WhatsApp",
    "Email",
    "Domicilio",
    "Localidad",
    "Estado",
    "Cantidad de servicios",
    "Cantidad de conexiones",
  ]

  const rows = items.map((item) => [
    item.name,
    item.dni ?? "",
    item.phone ?? "",
    item.whatsapp ?? "",
    item.email ?? "",
    item.address ?? "",
    item.locality ?? "",
    ispSubscriberListStatusView(item).label,
    String(item.serviceCount),
    String(item.connectionCount),
  ])

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
