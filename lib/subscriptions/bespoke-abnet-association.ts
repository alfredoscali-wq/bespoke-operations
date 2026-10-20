import { planLatamAbnetLink } from "@/lib/integrations/latam-tv/client"
import type { LatamCatalogClient } from "@/lib/integrations/latam-tv/identity"
import {
  abnetNumberFromExternalCode,
  padAbnetExternalCode,
} from "@/lib/isp/abnet-master-universe"

export const LATAM_LINK_PARTIAL_MESSAGE =
  "Vinculación parcial: LATAM quedó vinculado, pero la ficha de Bespoke no se asoció. No se volvió a sincronizar."

export const NIEVA_ABNET_REPAIR = {
  customerId: "7074bed5-eefb-426c-b456-046d4aec4604",
  customerNumber: "CLI-005771",
  abnetNumber: "6794",
  externalCustomerCode: "00006794",
  iptvId: "28",
  crmId: "6794",
} as const

export type BespokeAbnetAssociationPlan =
  | { outcome: "save"; externalCustomerCode: string }
  | { outcome: "already_saved"; externalCustomerCode: string }
  | {
      outcome: "rejected"
      reason: "identity" | "customer" | "occupied" | "existing_code"
    }

type CodeHolder = {
  id: string
  externalCustomerCode: string | null
}

const PAGE = 1000

type LooseResult = {
  data: Record<string, unknown>[] | null
  error: { message: string } | null
}

type LooseQuery = {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: string) => LooseQuery
  is: (column: string, value: null) => LooseQuery
  order: (column: string) => LooseQuery
  range: (from: number, to: number) => Promise<LooseResult>
  update: (values: { external_customer_code: string }) => LooseWrite
}

type LooseWrite = {
  eq: (column: string, value: string) => LooseWrite
  is: (column: string, value: null) => LooseWrite
  or: (filters: string) => LooseWrite
  select: (columns: string) => Promise<LooseResult>
}

function looseDb(client: unknown) {
  return client as {
    from: (table: string) => LooseQuery
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function sameNumber(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = abnetNumberFromExternalCode(left)
  const b = abnetNumberFromExternalCode(right)
  return Boolean(a && b && a === b)
}

export function planBespokeAbnetAssociation(input: {
  customerId: string
  expectedCustomerId: string
  abnetNumber: string
  expectedIptvId: string
  expectedCrmId: string
  nationalId: string | null
  email: string | null
  currentExternalCode: string | null
  holders: readonly CodeHolder[]
  catalog: readonly LatamCatalogClient[]
}): BespokeAbnetAssociationPlan {
  if (!input.customerId || input.customerId !== input.expectedCustomerId) {
    return { outcome: "rejected", reason: "customer" }
  }
  const number = abnetNumberFromExternalCode(input.abnetNumber)
  const expectedIptv = abnetNumberFromExternalCode(input.expectedIptvId)
  const expectedCrm = abnetNumberFromExternalCode(input.expectedCrmId)
  if (!number || !expectedIptv || !expectedCrm) {
    return { outcome: "rejected", reason: "identity" }
  }
  const identity = planLatamAbnetLink({
    abnetNumber: number,
    nationalId: input.nationalId,
    email: input.email,
    catalog: input.catalog,
  })
  if (
    (identity.action !== "link" && identity.action !== "already_linked") ||
    identity.iptvId !== expectedIptv ||
    identity.crmId !== expectedCrm
  ) {
    return { outcome: "rejected", reason: "identity" }
  }
  const current = abnetNumberFromExternalCode(input.currentExternalCode)
  if (text(input.currentExternalCode) && !current) {
    return { outcome: "rejected", reason: "existing_code" }
  }
  if (current && current !== number) {
    return { outcome: "rejected", reason: "existing_code" }
  }
  const occupied = input.holders.some(
    (holder) => holder.id !== input.customerId && sameNumber(holder.externalCustomerCode, number)
  )
  if (occupied) return { outcome: "rejected", reason: "occupied" }
  const externalCustomerCode = padAbnetExternalCode(number)
  if (current === number) return { outcome: "already_saved", externalCustomerCode }
  return { outcome: "save", externalCustomerCode }
}

export function planNievaAbnetRepair(input: {
  customerId: string
  customerNumber: string
  nationalId: string | null
  email: string | null
  currentExternalCode: string | null
  holders: readonly CodeHolder[]
  catalog: readonly LatamCatalogClient[]
}): BespokeAbnetAssociationPlan {
  if (
    input.customerId !== NIEVA_ABNET_REPAIR.customerId ||
    input.customerNumber !== NIEVA_ABNET_REPAIR.customerNumber
  ) {
    return { outcome: "rejected", reason: "customer" }
  }
  return planBespokeAbnetAssociation({
    customerId: input.customerId,
    expectedCustomerId: NIEVA_ABNET_REPAIR.customerId,
    abnetNumber: NIEVA_ABNET_REPAIR.abnetNumber,
    expectedIptvId: NIEVA_ABNET_REPAIR.iptvId,
    expectedCrmId: NIEVA_ABNET_REPAIR.crmId,
    nationalId: input.nationalId,
    email: input.email,
    currentExternalCode: input.currentExternalCode,
    holders: input.holders,
    catalog: input.catalog,
  })
}

export type BespokeAbnetAssociationResult =
  | { outcome: "saved"; externalCustomerCode: string }
  | { outcome: "already_saved"; externalCustomerCode: string }
  | {
      outcome: "partial"
      reason: "identity" | "customer" | "occupied" | "existing_code" | "update_failed"
    }

async function readPages(
  read: (from: number, to: number) => Promise<LooseResult>
): Promise<Record<string, unknown>[] | null> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) return null
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

export async function associateConfirmedAbnetCustomer(
  client: unknown,
  input: {
    companyId: string
    customerId: string
    abnetNumber: string
    iptvId: string
    crmId: string
    catalog: readonly LatamCatalogClient[]
  }
): Promise<BespokeAbnetAssociationResult> {
  const customerPage = await looseDb(client)
    .from("customers")
    .select("id, dni, email, external_customer_code")
    .eq("id", input.customerId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .range(0, 0)
  if (customerPage.error) return { outcome: "partial", reason: "update_failed" }
  const customer = customerPage.data?.[0]
  if (!customer || text(customer.id) !== input.customerId) {
    return { outcome: "partial", reason: "customer" }
  }
  const holdersPage = await readPages((from, to) =>
    looseDb(client)
      .from("customers")
      .select("id, external_customer_code")
      .eq("company_id", input.companyId)
      .is("deleted_at", null)
      .order("id")
      .range(from, to)
  )
  if (!holdersPage) return { outcome: "partial", reason: "update_failed" }
  const plan = planBespokeAbnetAssociation({
    customerId: text(customer.id),
    expectedCustomerId: input.customerId,
    abnetNumber: input.abnetNumber,
    expectedIptvId: input.iptvId,
    expectedCrmId: input.crmId,
    nationalId: text(customer.dni) || null,
    email: text(customer.email) || null,
    currentExternalCode: text(customer.external_customer_code) || null,
    holders: holdersPage.map((row) => ({
      id: text(row.id),
      externalCustomerCode: text(row.external_customer_code) || null,
    })),
    catalog: input.catalog,
  })
  if (plan.outcome === "rejected") return { outcome: "partial", reason: plan.reason }
  if (plan.outcome === "already_saved") {
    return { outcome: "already_saved", externalCustomerCode: plan.externalCustomerCode }
  }
  const updated = await looseDb(client)
    .from("customers")
    .update({ external_customer_code: plan.externalCustomerCode })
    .eq("id", input.customerId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .or("external_customer_code.is.null,external_customer_code.eq.")
    .select("id")
  if (updated.error || !updated.data?.some((row) => text(row.id) === input.customerId)) {
    return { outcome: "partial", reason: "update_failed" }
  }
  return { outcome: "saved", externalCustomerCode: plan.externalCustomerCode }
}
