import {
  type AbnetCustomerRecord,
} from "@/lib/isp/abnet-customer-registry"

const PAGE = 1000

type LooseFilter = {
  eq: (column: string, value: string) => LooseFilter
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

function flag(value: unknown): boolean {
  return value === true || value === "true"
}

export function customerRegistryTableMissing(error: { code?: string; message: string } | null) {
  const message = error?.message ?? ""
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    message.includes("abnet_customer_registry")
  )
}

const COLUMNS =
  "abnet_customer_number, customer_name, document_number, document_type, document_review, email, phone, address, city, province, commercial_status, person_type, tax_condition, abnet_client_id, source_balance, notes, review_required, review_reason"

function mapRecord(row: Record<string, unknown>): AbnetCustomerRecord {
  const reviewRequired = flag(row.review_required)
  const documentReview = flag(row.document_review) || reviewRequired
  return {
    customerNumber: text(row.abnet_customer_number),
    name: reviewRequired ? "" : text(row.customer_name),
    document: reviewRequired || documentReview ? null : text(row.document_number) || null,
    documentType: reviewRequired ? "" : text(row.document_type),
    documentReview,
    email: reviewRequired ? "" : text(row.email),
    phone: reviewRequired ? "" : text(row.phone),
    address: reviewRequired ? "" : text(row.address),
    city: reviewRequired ? "" : text(row.city),
    province: reviewRequired ? "" : text(row.province),
    commercialStatus: reviewRequired ? "" : text(row.commercial_status),
    personType: reviewRequired ? "" : text(row.person_type),
    taxCondition: reviewRequired ? "" : text(row.tax_condition),
    abnetClientId: text(row.abnet_client_id),
    sourceBalance: reviewRequired ? "" : text(row.source_balance),
    notes: reviewRequired ? "" : text(row.notes),
    reviewRequired,
    reviewReason: text(row.review_reason) || null,
  }
}

export function toCustomerRegistryPayload(record: AbnetCustomerRecord) {
  return {
    abnet_customer_number: record.customerNumber,
    customer_name: record.name,
    document_number: record.document ?? "",
    document_type: record.documentType,
    document_review: record.documentReview,
    email: record.email,
    phone: record.phone,
    address: record.address,
    city: record.city,
    province: record.province,
    commercial_status: record.commercialStatus,
    person_type: record.personType,
    tax_condition: record.taxCondition,
    abnet_client_id: record.abnetClientId,
    source_balance: record.sourceBalance,
    notes: record.notes,
    review_required: record.reviewRequired,
    review_reason: record.reviewReason ?? "",
  }
}

export async function loadAbnetCustomerRegistry(client: unknown, companyId: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const page = await looseDb(client)
      .from("abnet_customer_registry")
      .select(COLUMNS)
      .eq("company_id", companyId)
      .order("abnet_customer_number", { ascending: true })
      .range(from, from + PAGE - 1)
    if (page.error) {
      return {
        records: [] as AbnetCustomerRecord[],
        missing: customerRegistryTableMissing(page.error),
        error: page.error,
      }
    }
    const batch = page.data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return { records: rows.map(mapRecord), missing: false, error: null }
}

export async function confirmAbnetCustomerImport(
  client: unknown,
  companyId: string,
  sourceName: string,
  records: readonly AbnetCustomerRecord[]
) {
  const { data, error } = await looseDb(client).rpc("upsert_abnet_customer_registry", {
    p_company_id: companyId,
    p_source_name: sourceName,
    p_rows: records.map(toCustomerRegistryPayload),
  })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
