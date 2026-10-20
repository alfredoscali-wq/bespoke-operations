import { planLatamAbnetLink } from "@/lib/integrations/latam-tv/client"
import type { LatamCatalogClient } from "@/lib/integrations/latam-tv/identity"
import { abnetPadronCustomerNumber, foldAbnetPadronText } from "@/lib/subscriptions/abnet-tv-padron"

export type PadronLinkCustomer = {
  id: string
  name: string
  externalCustomerCode: string | null
  dni: string | null
  email: string | null
}

export type PadronLinkIdentity =
  | { status: "missing" }
  | { status: "ambiguous" }
  | { status: "ready"; customerId: string; nationalId: string | null; email: string | null }

export type PadronLatamLinkMark =
  | { link: "skip" }
  | { link: "review"; customerId?: string }
  | { link: "absent"; customerId?: string }
  | { link: "ready"; customerId: string }

const PAGE = 1000

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  order: (column: string) => LooseFilter
  range: (
    from: number,
    to: number
  ) => Promise<{
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }>
}

function looseDb(client: unknown) {
  return client as {
    from: (table: string) => { select: (columns: string) => LooseFilter }
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Una lectura de las fichas de la empresa. No escribe y no consulta LATAM.
 */
export async function readPadronLinkCustomers(
  client: unknown,
  companyId: string
): Promise<PadronLinkCustomer[] | null> {
  const rows: PadronLinkCustomer[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await looseDb(client)
      .from("customers")
      .select("id, name, external_customer_code, dni, email")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id")
      .range(from, from + PAGE - 1)
    if (error) return null
    const batch = data ?? []
    for (const row of batch) {
      const id = text(row.id)
      if (!id) continue
      rows.push({
        id,
        name: text(row.name) ?? "",
        externalCustomerCode: text(row.external_customer_code),
        dni: text(row.dni),
        email: text(row.email),
      })
    }
    if (batch.length < PAGE) break
  }
  return rows
}

function readyIdentity(customer: PadronLinkCustomer): PadronLinkIdentity {
  return {
    status: "ready",
    customerId: customer.id,
    nationalId: customer.dni,
    email: customer.email,
  }
}

/**
 * El N° ABNet encuentra la ficha por external_customer_code.
 * Si no hay ninguna, un nombre único en el padrón y en Bespoke aporta DNI y correo.
 * El mismo cliente no puede justificar dos abonos. No modifica datos.
 */
export function resolvePadronLinkIdentities(input: {
  rows: readonly { abnetNumber: string; customerName: string }[]
  customers: readonly PadronLinkCustomer[]
}): Map<string, PadronLinkIdentity> {
  const namesByNumber = new Map<string, Set<string>>()
  for (const row of input.rows) {
    const number = abnetPadronCustomerNumber(row.abnetNumber)
    if (!number) continue
    const name = foldAbnetPadronText(row.customerName)
    const names = namesByNumber.get(number) ?? new Set<string>()
    if (name) names.add(name)
    namesByNumber.set(number, names)
  }

  const byExternal = new Map<string, PadronLinkCustomer[]>()
  for (const customer of input.customers) {
    const number = abnetPadronCustomerNumber(customer.externalCustomerCode)
    if (!number) continue
    const group = byExternal.get(number) ?? []
    group.push(customer)
    byExternal.set(number, group)
  }

  const resolved = new Map<string, PadronLinkIdentity>()
  for (const [number, names] of namesByNumber) {
    const coded = byExternal.get(number) ?? []
    if (coded.length > 1) {
      resolved.set(number, { status: "ambiguous" })
      continue
    }
    if (coded.length === 1) {
      resolved.set(number, readyIdentity(coded[0]))
      continue
    }
    if (names.size !== 1) {
      resolved.set(number, names.size === 0 ? { status: "missing" } : { status: "ambiguous" })
      continue
    }
    const [name] = [...names]
    const named = input.customers.filter((customer) => foldAbnetPadronText(customer.name) === name)
    if (named.length !== 1) {
      resolved.set(number, named.length === 0 ? { status: "missing" } : { status: "ambiguous" })
      continue
    }
    const owner = abnetPadronCustomerNumber(named[0].externalCustomerCode)
    if (owner && owner !== number) {
      resolved.set(number, { status: "ambiguous" })
      continue
    }
    resolved.set(number, readyIdentity(named[0]))
  }

  const owners = new Map<string, string[]>()
  for (const [number, identity] of resolved) {
    if (identity.status !== "ready") continue
    const group = owners.get(identity.customerId) ?? []
    group.push(number)
    owners.set(identity.customerId, group)
  }
  for (const numbers of owners.values()) {
    if (numbers.length < 2) continue
    for (const number of numbers) resolved.set(number, { status: "ambiguous" })
  }
  return resolved
}

/** Traduce la ficha y el catálogo ya leído al estado del padrón. No llama a la red. */
export function classifyPadronLatamLink(input: {
  abnetNumber: string
  identity: PadronLinkIdentity
  catalog: readonly LatamCatalogClient[] | null
}): PadronLatamLinkMark {
  if (input.identity.status === "missing") return { link: "skip" }
  if (input.identity.status === "ambiguous") return { link: "review" }
  if (input.catalog == null) return { link: "review", customerId: input.identity.customerId }
  const plan = planLatamAbnetLink({
    abnetNumber: input.abnetNumber,
    nationalId: input.identity.nationalId,
    email: input.identity.email,
    catalog: input.catalog,
  })
  if (plan.action === "link" || plan.action === "already_linked") {
    return { link: "ready", customerId: input.identity.customerId }
  }
  if (plan.action === "signup") return { link: "absent", customerId: input.identity.customerId }
  return { link: "review", customerId: input.identity.customerId }
}
