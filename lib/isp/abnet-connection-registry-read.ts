import {
  classifyAbnetRegistryLink,
  planAbnetConnectionImport,
  type AbnetConnectionRecord,
} from "@/lib/isp/abnet-connection-registry"
import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

const PAGE = 1000

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  order: (column: string, options?: { ascending: boolean }) => LooseFilter
  range: (
    from: number,
    to: number
  ) => Promise<{
    data: Record<string, unknown>[] | null
    error: { code?: string; message: string } | null
  }>
}

function looseDb(client: unknown) {
  return client as {
    from: (table: string) => { select: (columns: string) => LooseFilter }
    rpc: (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim()
}

export function registryTableMissing(error: { code?: string; message: string } | null) {
  const message = error?.message ?? ""
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("abnet_connection_registry")
  )
}

async function readPages(
  read: (from: number, to: number) => Promise<{
    data: Record<string, unknown>[] | null
    error: { code?: string; message: string } | null
  }>
) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) return { rows: null as Record<string, unknown>[] | null, error }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return { rows, error: null }
}

const REGISTRY_COLUMNS =
  "abnet_connection_id, abnet_customer_number, abnet_client_id, customer_name, service_type, node_name, plan_name, connection_status, raw_status, gratis, incobrable, company_label, alta_at, baja_registered_at, baja_effective_at, baja_reason, suspension_from, suspension_until, suspension_reason, replaced_connection_id"

function mapRecord(row: Record<string, unknown>): AbnetConnectionRecord {
  return {
    abnetConnectionId: text(row.abnet_connection_id),
    abnetCustomerNumber: text(row.abnet_customer_number),
    abnetClientId: text(row.abnet_client_id),
    customerName: text(row.customer_name),
    serviceType: text(row.service_type),
    nodeName: text(row.node_name),
    planName: text(row.plan_name),
    connectionStatus: text(row.connection_status) as AbnetConnectionRecord["connectionStatus"],
    rawStatus: text(row.raw_status),
    gratis: text(row.gratis) as AbnetConnectionRecord["gratis"],
    incobrable: text(row.incobrable) as AbnetConnectionRecord["incobrable"],
    companyLabel: text(row.company_label),
    altaAt: text(row.alta_at) || null,
    bajaRegisteredAt: text(row.baja_registered_at) || null,
    bajaEffectiveAt: text(row.baja_effective_at) || null,
    bajaReason: text(row.baja_reason),
    suspensionFrom: text(row.suspension_from) || null,
    suspensionUntil: text(row.suspension_until) || null,
    suspensionReason: text(row.suspension_reason),
    replacedConnectionId: text(row.replaced_connection_id),
  }
}

export async function loadAbnetConnectionRegistry(client: unknown, companyId: string) {
  const page = await readPages((from, to) =>
    looseDb(client)
      .from("abnet_connection_registry")
      .select(REGISTRY_COLUMNS)
      .eq("company_id", companyId)
      .order("abnet_connection_id", { ascending: true })
      .range(from, to)
  )
  if (page.error) {
    return {
      records: [] as AbnetConnectionRecord[],
      missing: registryTableMissing(page.error),
      error: page.error,
    }
  }
  return {
    records: (page.rows ?? []).map(mapRecord),
    missing: false,
    error: null,
  }
}

export type AbnetLiveCustomerLink = {
  id: string
  name: string
  externalCode: string | null
  locality: string | null
  status: string
  dni: string | null
  phone: string | null
  email: string | null
  customerNumber: string | null
  address: string | null
  contractedPlan: string | null
}

export async function loadLiveAbnetCustomers(client: unknown, companyId: string) {
  const page = await readPages((from, to) =>
    looseDb(client)
      .from("customers")
      .select(
        "id, name, external_customer_code, customer_number, locality, status, dni, phone, email, address, contracted_plan"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to)
  )
  if (page.error) return { customers: [] as AbnetLiveCustomerLink[], error: page.error }
  return {
    customers: (page.rows ?? []).map((row) => ({
      id: text(row.id),
      name: text(row.name),
      externalCode: text(row.external_customer_code) || null,
      locality: text(row.locality) || null,
      status: text(row.status),
      dni: text(row.dni) || null,
      phone: text(row.phone) || null,
      email: text(row.email) || null,
      customerNumber: text(row.customer_number) || null,
      address: text(row.address) || null,
      contractedPlan: text(row.contracted_plan) || null,
    })),
    error: null,
  }
}

export async function loadSharedAbnetNumbers(client: unknown, companyId: string) {
  const page = await readPages((from, to) =>
    looseDb(client)
      .from("customers")
      .select("id, external_customer_code")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to)
  )
  if (page.error) return { numbers: new Set<string>(), error: page.error }
  const counts = new Map<string, number>()
  for (const row of page.rows ?? []) {
    const number = abnetNumberFromExternalCode(text(row.external_customer_code))
    if (!number || number === "99999999") continue
    counts.set(number, (counts.get(number) ?? 0) + 1)
  }
  const numbers = new Set<string>()
  for (const [number, count] of counts) {
    if (count > 1) numbers.add(number)
  }
  return { numbers, error: null }
}

export function toRegistryPayload(record: AbnetConnectionRecord) {
  return {
    abnet_connection_id: record.abnetConnectionId,
    abnet_customer_number: record.abnetCustomerNumber,
    abnet_client_id: record.abnetClientId,
    customer_name: record.customerName,
    service_type: record.serviceType,
    node_name: record.nodeName,
    plan_name: record.planName,
    connection_status: record.connectionStatus,
    raw_status: record.rawStatus,
    gratis: record.gratis,
    incobrable: record.incobrable,
    company_label: record.companyLabel,
    alta_at: record.altaAt,
    baja_registered_at: record.bajaRegisteredAt,
    baja_effective_at: record.bajaEffectiveAt,
    baja_reason: record.bajaReason,
    suspension_from: record.suspensionFrom,
    suspension_until: record.suspensionUntil,
    suspension_reason: record.suspensionReason,
    replaced_connection_id: record.replacedConnectionId,
  }
}

export async function loadAbnetRegistryNoteContext(client: unknown, companyId: string) {
  const [registry, shared] = await Promise.all([
    loadAbnetConnectionRegistry(client, companyId),
    loadSharedAbnetNumbers(client, companyId),
  ])
  if (registry.error || registry.missing || shared.error || registry.records.length === 0) return null
  const counts = new Map<string, number>()
  for (const record of registry.records) {
    counts.set(record.abnetCustomerNumber, (counts.get(record.abnetCustomerNumber) ?? 0) + 1)
  }
  return { counts, shared: shared.numbers, records: registry.records }
}

export function abnetRegistryNoteForExternal(
  context: { counts: Map<string, number>; shared: Set<string> } | null,
  externalCode: string | null | undefined
) {
  if (!context) return null
  const number = abnetNumberFromExternalCode(externalCode)
  return classifyAbnetRegistryLink({
    externalCode,
    sharedNumber: number ? context.shared.has(number) : false,
    connectionCount: number ? context.counts.get(number) ?? 0 : 0,
  }).note
}

export async function confirmAbnetConnectionImport(
  client: unknown,
  companyId: string,
  sourceName: string,
  records: readonly AbnetConnectionRecord[]
) {
  const existing = await loadAbnetConnectionRegistry(client, companyId)
  if (existing.error && !existing.missing) {
    return { data: null, error: existing.error.message }
  }
  const plan = planAbnetConnectionImport(existing.records, {
    records: [...records],
    issues: [],
    headerRowNumber: 1,
  })
  if (plan.invalid > 0) {
    return { data: null, error: "La importación no se aplicó porque hay filas inválidas." }
  }
  const { data, error } = await looseDb(client).rpc("upsert_abnet_connection_registry", {
    p_company_id: companyId,
    p_source_name: sourceName,
    p_rows: records.map(toRegistryPayload),
  })
  if (error) return { data: null, error: error.message }
  return { data: { plan, result: data }, error: null }
}
