import { formatCustomerNumber, parseCustomerNumberCounter } from "@/lib/customers/customer-number"

export const ABNET_MASTER_RECENT_SINCE = "2026-09-22T23:59:59.000Z"

export const ABNET_EXTERNAL_CODE_WIDTH = 8

/**
 * Required customers.status for rows created from the ABNet master.
 * It does not mean the customer is commercially active or cancelled.
 * Active/cancelled is decided later from connections, not from master presence.
 */
export const ABNET_MASTER_CUSTOMER_STATUS = "pendiente-activacion"

const PLACEHOLDER_DOCUMENT_DIGITS = new Set([
  "0",
  "0000000",
  "00000000",
  "1111111",
  "11111111",
  "1234567",
  "12345678",
  "4444444",
  "9999999",
  "99999999",
])

export function abnetNumberFromExternalCode(
  code: string | null | undefined
): string | null {
  const trimmed = code?.trim() ?? ""
  if (!/^\d+$/.test(trimmed)) return null
  const normalized = String(Number(trimmed))
  return normalized === "0" ? null : normalized
}

export function padAbnetExternalCode(customerNumber: string): string {
  const digits = customerNumber.trim()
  if (!/^\d+$/.test(digits) || digits === "0") {
    throw new Error("N° Cliente ABNet inválido.")
  }
  return digits.padStart(ABNET_EXTERNAL_CODE_WIDTH, "0")
}

export function normalizeCustomerName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

export function documentDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "")
}

export function isPlaceholderIdentityDocument(
  value: string | null | undefined
): boolean {
  const digits = documentDigits(value)
  if (!digits) return true
  if (PLACEHOLDER_DOCUMENT_DIGITS.has(digits)) return true
  return /^(\d)\1+$/.test(digits)
}

export function isReliableIdentityDocument(
  value: string | null | undefined
): boolean {
  const digits = documentDigits(value)
  return digits.length >= 6 && !isPlaceholderIdentityDocument(value)
}

/**
 * customers has no province column. City and province stay as written in the
 * master and are joined with a separator so both can be read back.
 */
export function packAbnetLocality(
  city: string | null | undefined,
  province: string | null | undefined
): string | null {
  const parts = [city, province]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0)
  return parts.length > 0 ? parts.join(" · ") : null
}

export type AbnetMasterPlan =
  | { action: "linked" }
  | {
      action: "create"
      externalCode: string
      locality: string | null
    }
  | { action: "review"; reason: string }

export function planAbnetMasterRow(input: {
  customerNumber: string
  name: string
  document: string | null
  city: string | null
  province: string | null
  existingAbnetNumbers: ReadonlySet<string>
  existingDocumentDigits: ReadonlySet<string>
  existingNames: ReadonlySet<string>
}): AbnetMasterPlan {
  const number = input.customerNumber.trim()
  if (!/^\d+$/.test(number)) {
    return { action: "review", reason: "N° Cliente no numérico" }
  }

  const normalized = abnetNumberFromExternalCode(number)
  if (!normalized) {
    return { action: "review", reason: "N° Cliente vacío" }
  }

  if (input.existingAbnetNumbers.has(normalized)) {
    return { action: "linked" }
  }

  if (!input.name.trim()) {
    return { action: "review", reason: "Nombre vacío" }
  }

  if (isReliableIdentityDocument(input.document)) {
    const digits = documentDigits(input.document)
    if (input.existingDocumentDigits.has(digits)) {
      return {
        action: "review",
        reason: "Documento coincide con un cliente existente y otro N° ABNet",
      }
    }
  }

  const normalizedName = normalizeCustomerName(input.name)
  if (normalizedName && input.existingNames.has(normalizedName)) {
    return {
      action: "review",
      reason: "Nombre coincide con un cliente existente",
    }
  }

  return {
    action: "create",
    externalCode: padAbnetExternalCode(normalized),
    locality: packAbnetLocality(input.city, input.province),
  }
}

export type UniverseCustomer = {
  id: string
  createdAt: string
  document: string | null
  abnetNumber: string | null
}

export type UniverseTask = {
  customerId: string | null
  createdAt: string
  updatedAt: string
}

export type Clientes360UniversePlan = {
  masterCustomerIds: string[]
  recentAltaCustomerIds: string[]
  noteCustomerIds: string[]
  historicalCustomerIds: string[]
}

export function planClientes360Universe(input: {
  masterNumbers: ReadonlySet<string>
  customers: readonly UniverseCustomer[]
  tasks: readonly UniverseTask[]
  recentSince?: string
}): Clientes360UniversePlan {
  const tasksByCustomer = new Map<string, UniverseTask[]>()
  for (const task of input.tasks) {
    if (!task.customerId) continue
    const current = tasksByCustomer.get(task.customerId) ?? []
    current.push(task)
    tasksByCustomer.set(task.customerId, current)
  }

  const since = input.recentSince ?? ABNET_MASTER_RECENT_SINCE
  const plan: Clientes360UniversePlan = {
    masterCustomerIds: [],
    recentAltaCustomerIds: [],
    noteCustomerIds: [],
    historicalCustomerIds: [],
  }

  for (const customer of input.customers) {
    if (customer.abnetNumber && input.masterNumbers.has(customer.abnetNumber)) {
      plan.masterCustomerIds.push(customer.id)
      continue
    }

    const tasks = tasksByCustomer.get(customer.id) ?? []
    const inWindow =
      customer.createdAt >= since ||
      tasks.some((task) => task.createdAt >= since || task.updatedAt >= since)

    if (!inWindow) {
      plan.historicalCustomerIds.push(customer.id)
      continue
    }

    if (tasks.length === 0 && !isReliableIdentityDocument(customer.document)) {
      plan.noteCustomerIds.push(customer.id)
      continue
    }

    plan.recentAltaCustomerIds.push(customer.id)
  }

  return plan
}

export function nextCustomerNumbers(
  existingCustomerNumbers: readonly string[],
  count: number
): string[] {
  let counter = 0
  for (const customerNumber of existingCustomerNumbers) {
    counter = Math.max(counter, parseCustomerNumberCounter(customerNumber))
  }

  return Array.from({ length: count }, (_, index) =>
    formatCustomerNumber(counter + index + 1)
  )
}
