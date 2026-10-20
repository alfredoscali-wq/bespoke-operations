import {
  isPendingActivationListCustomer,
  planClients360CustomerActivation,
} from "@/lib/customers/customer-operational"
import { isCustomerStatusActive } from "@/lib/customers/format"
import {
  clients360EntryForCustomer,
  type Clients360DirectoryCustomer,
  type Clients360DirectoryEntry,
} from "@/lib/isp/clients-360-directory"
import type { IspCustomerListItem } from "@/lib/isp/types"
import { didTaskReuseExistingCustomer } from "@/lib/tasks/work-order-customer-resolve"

export {
  CUSTOMER_ALREADY_ACTIVE_MESSAGE,
  CUSTOMER_NOT_PENDING_ACTIVATION_MESSAGE,
  planClients360CustomerActivation,
} from "@/lib/customers/customer-operational"

export const CLIENTS360_ACTIVATION_FORBIDDEN_MESSAGE =
  "No tenés permiso para activar este cliente."

export function releasedInstallationCustomerIds(
  tasks: readonly { customerId: string; metadata: unknown }[]
): Set<string> {
  const ids = new Set<string>()
  for (const task of tasks) {
    const customerId = task.customerId.trim()
    if (!customerId) continue
    const metadata =
      task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
        ? (task.metadata as Record<string, unknown>)
        : undefined
    if (didTaskReuseExistingCustomer(metadata)) continue
    ids.add(customerId)
  }
  return ids
}

export function withoutPendingActivationEntries(
  entries: readonly Clients360DirectoryEntry[],
  pendingIds: ReadonlySet<string>
): Clients360DirectoryEntry[] {
  if (pendingIds.size === 0) return [...entries]
  return entries.filter(
    (entry) => !entry.customerId || !pendingIds.has(entry.customerId)
  )
}

export function appendReleasedActivationCustomers(
  entries: readonly Clients360DirectoryEntry[],
  customers: readonly Clients360DirectoryCustomer[],
  releasedIds: ReadonlySet<string>,
  removedIds: ReadonlySet<string> = new Set()
): { entries: Clients360DirectoryEntry[]; addedIds: Set<string> } {
  const shown = new Set(
    entries.flatMap((entry) => (entry.customerId ? [entry.customerId] : []))
  )
  const next = [...entries]
  const addedIds = new Set<string>()
  for (const customer of customers) {
    if (!releasedIds.has(customer.id) || shown.has(customer.id)) continue
    if (removedIds.has(customer.id)) continue
    if (!isCustomerStatusActive(customer.status)) continue
    if (
      isPendingActivationListCustomer({
        status: customer.status,
        externalCustomerCode: customer.externalCode ?? undefined,
      })
    ) {
      continue
    }
    next.push(clients360EntryForCustomer(customer))
    shown.add(customer.id)
    addedIds.add(customer.id)
  }
  next.sort(
    (left, right) =>
      left.name.localeCompare(right.name, "es") || left.id.localeCompare(right.id)
  )
  return { entries: next, addedIds }
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

export function filterPendingActivationCustomers<
  T extends {
    name: string
    dni?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    locality?: string | null
    externalCustomerCode?: string | null
    bespokeCustomerNumber?: string | null
  },
>(
  rows: readonly T[],
  input: { search?: string; locality?: string }
): T[] {
  const search = fold(input.search?.trim() ?? "")
  const locality = input.locality?.trim().toLowerCase() ?? ""
  return rows.filter((row) => {
    if (locality && locality !== "all" && (row.locality ?? "").trim().toLowerCase() !== locality) {
      return false
    }
    if (!search) return true
    const haystack = fold(
      [
        row.name,
        row.dni ?? "",
        row.phone ?? "",
        row.email ?? "",
        row.address ?? "",
        row.locality ?? "",
        row.externalCustomerCode ?? "",
        row.bespokeCustomerNumber ?? "",
      ].join(" ")
    )
    return haystack.includes(search)
  })
}

export function pageClients360Rows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number
): { rows: T[]; page: number; pageSize: number; total: number } {
  const total = rows.length
  const size = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, page), pageCount)
  const from = (current - 1) * size
  return { rows: rows.slice(from, from + size), page: current, pageSize: size, total }
}

export function presentPendingActivationListItem(row: {
  id: string
  name: string
  dni?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  locality?: string | null
  status: string
  createdAt?: string | null
  externalCustomerCode?: string | null
  bespokeCustomerNumber?: string | null
  contractedPlan?: string | null
}): IspCustomerListItem {
  const plan = row.contractedPlan?.trim() || undefined
  return {
    id: row.id,
    name: row.name,
    dni: row.dni ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    locality: row.locality ?? null,
    status: row.status,
    createdAt: row.createdAt ?? "",
    externalCustomerCode: row.externalCustomerCode ?? null,
    bespokeCustomerNumber: row.bespokeCustomerNumber ?? null,
    serviceCount: 0,
    connectionCount: 0,
    listStatus: "pendiente",
    serviceOverview: plan ?? "",
    accountSituation: null,
    lastActivityAt: null,
    directoryOrigin: "bespoke",
    commercialPlanLabel: plan,
    activationState: "pending",
  }
}
