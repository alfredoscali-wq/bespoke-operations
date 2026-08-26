import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED,
  ISP_BILLING_DOCUMENT_DRAFT_ONLY,
  ISP_BILLING_DOCUMENT_ISSUED_LOCKED,
  ISP_BILLING_DOCUMENT_ISSUER_REQUIRED,
  ISP_BILLING_DOCUMENT_NOT_FOUND,
  ISP_BILLING_DOCUMENT_POS_REQUIRED,
} from "@/lib/isp/billing-constants"
import {
  buildBillingConfigurationStatus,
  ignoreClientCompanyId,
  isIspBillingDocumentType,
} from "@/lib/isp/billing-integrity"
import {
  calculateBillingTotals,
  canCancelBillingDocument,
  canEditBillingDocument,
  canIssueBillingDocument,
  itemsFromDraft,
  snapshotCustomerFromRecord,
  todayIsoDate,
  validateBillingDocumentDraft,
} from "@/lib/isp/billing-document-integrity"
import {
  mapBillingDocumentListItem,
  mapBillingDocumentRow,
} from "@/lib/isp/billing-document-mapper"
import type {
  IspBillingCustomerOption,
  IspBillingDocument,
  IspBillingDocumentDraftInput,
  IspBillingDocumentListFilters,
  IspBillingIssueContext,
  IspBillingServiceOption,
} from "@/lib/isp/billing-document-types"
import { getIspBillingSettings } from "@/lib/isp/billing-queries"
import { escapeCustomerSearchPattern } from "@/lib/customers/customer-list"
import type { Database, Json } from "@/lib/supabase/database.types"

export type IspBillingDocumentQueriesClient = SupabaseClient<Database>

function mapWriteError(error: { message?: string } | null): string {
  return error?.message || "No se pudo guardar el comprobante."
}

async function loadDocumentBundle(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  documentId: string
): Promise<IspBillingDocument> {
  const { data, error } = await client
    .from("isp_billing_documents")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(ISP_BILLING_DOCUMENT_NOT_FOUND)

  const [{ data: items, error: itemsError }, { data: events, error: eventsError }] =
    await Promise.all([
      client
        .from("isp_billing_document_items")
        .select("*")
        .eq("company_id", companyId)
        .eq("document_id", documentId)
        .order("sort_order", { ascending: true }),
      client
        .from("isp_billing_document_events")
        .select("*")
        .eq("company_id", companyId)
        .eq("document_id", documentId)
        .order("created_at", { ascending: true }),
    ])
  if (itemsError) throw new Error(itemsError.message)
  if (eventsError) throw new Error(eventsError.message)

  const mapped = mapBillingDocumentRow(data, items ?? [], events ?? [])
  if (!mapped) throw new Error(ISP_BILLING_DOCUMENT_NOT_FOUND)
  return mapped
}

async function replaceDocumentItems(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  documentId: string,
  draftItems: IspBillingDocumentDraftInput["items"]
) {
  const totals = calculateBillingTotals(
    itemsFromDraft(draftItems).map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    }))
  )

  const { error: deleteError } = await client
    .from("isp_billing_document_items")
    .delete()
    .eq("company_id", companyId)
    .eq("document_id", documentId)
  if (deleteError) throw new Error(mapWriteError(deleteError))

  if (totals.lines.length > 0) {
    const { error: insertError } = await client
      .from("isp_billing_document_items")
      .insert(
        totals.lines.map((line, index) => {
          const draft = itemsFromDraft(draftItems)[index]
          return {
            company_id: companyId,
            document_id: documentId,
            service_id: draft?.serviceId ?? null,
            description: draft?.description ?? "",
            quantity: line.quantity,
            unit_price: line.unitPrice,
            discount: line.discount,
            taxable_base: line.taxableBase,
            tax_amount: line.taxAmount,
            tax_type: "",
            tax_rate: line.taxRate,
            line_total: line.lineTotal,
            sort_order: index,
          }
        })
      )
    if (insertError) throw new Error(mapWriteError(insertError))
  }

  return totals
}

async function resolveCustomer(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  customerId: string
) {
  const { data, error } = await client
    .from("customers")
    .select("id, name, dni, email, address, locality, customer_number")
    .eq("company_id", companyId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED)

  const { data: subscriber } = await client
    .from("isp_subscribers")
    .select("id")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle()

  return {
    customer: data,
    subscriberId: subscriber?.id ?? null,
    snapshot: snapshotCustomerFromRecord(data),
  }
}

export async function getBillingIssueContext(
  client: IspBillingDocumentQueriesClient,
  companyId: string
): Promise<IspBillingIssueContext> {
  const settings = await getIspBillingSettings(client, companyId)
  const status = buildBillingConfigurationStatus({ settings })
  return {
    issuerLegalName: settings?.legalName ?? "",
    issuerTaxId: settings?.taxId ?? "",
    issuerVatCondition: settings?.vatCondition ?? "",
    issuerTaxAddress: settings?.taxAddress ?? "",
    issuerCity: settings?.city ?? "",
    issuerProvince: settings?.province ?? "",
    issuerPostalCode: settings?.postalCode ?? "",
    issuerLogoUrl: settings?.logoUrl ?? null,
    pointOfSaleId: settings?.pointOfSale?.id ?? "",
    pointOfSaleNumber: settings?.pointOfSale?.number ?? 0,
    companyReady: status.companyReady,
    pointOfSaleReady: status.pointOfSaleReady,
    missing: status.missing.map((item) => item.message),
  }
}

export async function searchBillingCustomers(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  query: string
): Promise<IspBillingCustomerOption[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const pattern = escapeCustomerSearchPattern(trimmed)
  const { data, error } = await client
    .from("customers")
    .select("id, name, dni, email, address, locality, customer_number")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .or(
      `name.ilike.${pattern},dni.ilike.${pattern},customer_number.ilike.${pattern},email.ilike.${pattern},external_customer_code.ilike.${pattern}`
    )
    .order("name", { ascending: true })
    .limit(20)
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const ids = rows.map((row) => row.id)
  const { data: subscribers } = ids.length
    ? await client
        .from("isp_subscribers")
        .select("id, customer_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("customer_id", ids)
    : { data: [] }

  const subscriberByCustomer = new Map(
    (subscribers ?? []).map((row) => [row.customer_id, row.id])
  )

  return rows.map((row) => ({
    id: row.id,
    subscriberId: subscriberByCustomer.get(row.id) ?? null,
    name: row.name,
    dni: row.dni,
    customerNumber: row.customer_number,
    email: row.email,
    address: row.address,
    locality: row.locality,
    snapshot: snapshotCustomerFromRecord(row),
  }))
}

export async function listBillingCustomerServices(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  customerId: string
): Promise<IspBillingServiceOption[]> {
  const { data, error } = await client
    .from("isp_services")
    .select(
      "id, customer_id, plan_name, catalog_code, monthly_fee, commercial_status"
    )
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .neq("commercial_status", "cancelled")
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    planName: row.plan_name,
    catalogCode: row.catalog_code,
    monthlyFee: row.monthly_fee,
    commercialStatus: row.commercial_status,
  }))
}

export async function listIspBillingDocuments(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  filters: IspBillingDocumentListFilters = {}
): Promise<IspBillingDocument[]> {
  let query = client
    .from("isp_billing_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (filters.documentType && isIspBillingDocumentType(filters.documentType)) {
    query = query.eq("document_type", filters.documentType)
  }
  if (filters.status) {
    query = query.eq("status", filters.status)
  }
  if (filters.dateFrom) {
    query = query.gte("issue_date", filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte("issue_date", filters.dateTo)
  }
  if (filters.pointOfSaleId) {
    query = query.eq("point_of_sale_id", filters.pointOfSaleId)
  }
  if (filters.search?.trim()) {
    const pattern = escapeCustomerSearchPattern(filters.search.trim())
    query = query.or(
      `customer_name_snapshot.ilike.${pattern},customer_document_number_snapshot.ilike.${pattern},customer_tax_id_snapshot.ilike.${pattern},formatted_number.ilike.${pattern}`
    )
  }

  const { data, error } = await query.limit(200)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => mapBillingDocumentRow(row))
    .filter((item): item is IspBillingDocument => item != null)
}

export async function getIspBillingDocument(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  documentId: string
): Promise<IspBillingDocument> {
  return loadDocumentBundle(client, companyId, documentId)
}

export async function createIspBillingDocument(
  client: IspBillingDocumentQueriesClient,
  sessionCompanyId: string,
  draft: IspBillingDocumentDraftInput
): Promise<IspBillingDocument> {
  const companyId = ignoreClientCompanyId(sessionCompanyId, draft.companyId)
  const issues = validateBillingDocumentDraft(draft)
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? "El comprobante no es válido.")
  }
  if (!isIspBillingDocumentType(draft.documentType)) {
    throw new Error("El tipo de comprobante no es válido.")
  }

  const settings = await getIspBillingSettings(client, companyId)
  const status = buildBillingConfigurationStatus({ settings })
  if (!settings || status.incomplete || !settings.pointOfSale) {
    throw new Error(
      status.missing[0]?.message ?? ISP_BILLING_DOCUMENT_ISSUER_REQUIRED
    )
  }

  const { customer, subscriberId, snapshot } = await resolveCustomer(
    client,
    companyId,
    draft.customerId
  )
  void customer

  const totals = calculateBillingTotals(
    itemsFromDraft(draft.items).map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    }))
  )

  const { data, error } = await client
    .from("isp_billing_documents")
    .insert({
      company_id: companyId,
      billing_company_settings_id: settings.id,
      point_of_sale_id: settings.pointOfSale.id,
      document_type: draft.documentType,
      status: "draft",
      authorization_status: "not_required",
      issue_date: draft.issueDate?.trim() || todayIsoDate(),
      due_date: draft.dueDate?.trim() || null,
      number: null,
      formatted_number: null,
      customer_id: draft.customerId,
      subscriber_id: draft.subscriberId?.trim() || subscriberId,
      customer_name_snapshot: snapshot.name,
      customer_document_type_snapshot: snapshot.documentType,
      customer_document_number_snapshot: snapshot.documentNumber,
      customer_tax_id_snapshot: snapshot.taxId,
      customer_vat_condition_snapshot: snapshot.vatCondition,
      customer_tax_address_snapshot: snapshot.taxAddress,
      customer_city_snapshot: snapshot.city,
      customer_province_snapshot: snapshot.province,
      customer_postal_code_snapshot: snapshot.postalCode,
      customer_email_snapshot: snapshot.email,
      issuer_legal_name_snapshot: settings.legalName,
      issuer_tax_id_snapshot: settings.taxId,
      issuer_vat_condition_snapshot: settings.vatCondition ?? "",
      issuer_tax_address_snapshot: settings.taxAddress,
      issuer_city_snapshot: settings.city,
      issuer_province_snapshot: settings.province,
      issuer_postal_code_snapshot: settings.postalCode,
      issuer_phone_snapshot: settings.phone,
      issuer_email_snapshot: settings.email,
      issuer_website_snapshot: settings.website,
      issuer_logo_url_snapshot: settings.logoUrl,
      point_of_sale_number: settings.pointOfSale.number,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      observations: draft.observations?.trim() ?? "",
      cae: null,
      cae_expires_at: null,
      billing_run_id: draft.billingRunId ?? null,
      period_year: draft.periodYear ?? null,
      period_month: draft.periodMonth ?? null,
    })
    .select("*")
    .single()
  if (error) throw new Error(mapWriteError(error))

  await replaceDocumentItems(client, companyId, data.id, draft.items)
  await client.from("isp_billing_document_events").insert({
    company_id: companyId,
    document_id: data.id,
    event_type: "created",
    payload: {
      documentType: draft.documentType,
      customerId: draft.customerId,
    } as Json,
  })

  return loadDocumentBundle(client, companyId, data.id)
}

export async function updateIspBillingDocument(
  client: IspBillingDocumentQueriesClient,
  sessionCompanyId: string,
  documentId: string,
  draft: IspBillingDocumentDraftInput
): Promise<IspBillingDocument> {
  const companyId = ignoreClientCompanyId(sessionCompanyId, draft.companyId)
  const current = await loadDocumentBundle(client, companyId, documentId)
  if (!canEditBillingDocument(current.status)) {
    throw new Error(
      current.status === "issued"
        ? ISP_BILLING_DOCUMENT_ISSUED_LOCKED
        : ISP_BILLING_DOCUMENT_DRAFT_ONLY
    )
  }

  const issues = validateBillingDocumentDraft(draft)
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? "El comprobante no es válido.")
  }
  if (!isIspBillingDocumentType(draft.documentType)) {
    throw new Error("El tipo de comprobante no es válido.")
  }

  const settings = await getIspBillingSettings(client, companyId)
  if (!settings?.pointOfSale) {
    throw new Error(ISP_BILLING_DOCUMENT_POS_REQUIRED)
  }

  const { subscriberId, snapshot } = await resolveCustomer(
    client,
    companyId,
    draft.customerId
  )
  const totals = await replaceDocumentItems(
    client,
    companyId,
    documentId,
    draft.items
  )

  const { error } = await client
    .from("isp_billing_documents")
    .update({
      document_type: draft.documentType,
      billing_company_settings_id: settings.id,
      point_of_sale_id: settings.pointOfSale.id,
      point_of_sale_number: settings.pointOfSale.number,
      issue_date: draft.issueDate?.trim() || current.issueDate,
      due_date: draft.dueDate?.trim() || null,
      customer_id: draft.customerId,
      subscriber_id: draft.subscriberId?.trim() || subscriberId,
      customer_name_snapshot: snapshot.name,
      customer_document_type_snapshot: snapshot.documentType,
      customer_document_number_snapshot: snapshot.documentNumber,
      customer_tax_id_snapshot: snapshot.taxId,
      customer_vat_condition_snapshot: snapshot.vatCondition,
      customer_tax_address_snapshot: snapshot.taxAddress,
      customer_city_snapshot: snapshot.city,
      customer_province_snapshot: snapshot.province,
      customer_postal_code_snapshot: snapshot.postalCode,
      customer_email_snapshot: snapshot.email,
      issuer_legal_name_snapshot: settings.legalName,
      issuer_tax_id_snapshot: settings.taxId,
      issuer_vat_condition_snapshot: settings.vatCondition ?? "",
      issuer_tax_address_snapshot: settings.taxAddress,
      issuer_city_snapshot: settings.city,
      issuer_province_snapshot: settings.province,
      issuer_postal_code_snapshot: settings.postalCode,
      issuer_phone_snapshot: settings.phone,
      issuer_email_snapshot: settings.email,
      issuer_website_snapshot: settings.website,
      issuer_logo_url_snapshot: settings.logoUrl,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      tax_total: totals.taxTotal,
      total: totals.total,
      observations: draft.observations?.trim() ?? "",
      cae: null,
    })
    .eq("id", documentId)
    .eq("company_id", companyId)
    .eq("status", "draft")
  if (error) throw new Error(mapWriteError(error))

  await client.from("isp_billing_document_events").insert({
    company_id: companyId,
    document_id: documentId,
    event_type: "updated",
    payload: { documentType: draft.documentType } as Json,
  })

  return loadDocumentBundle(client, companyId, documentId)
}

export async function issueIspBillingDocument(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  documentId: string
): Promise<IspBillingDocument> {
  const current = await loadDocumentBundle(client, companyId, documentId)
  if (!canIssueBillingDocument(current.status)) {
    throw new Error("Solo se pueden emitir comprobantes en borrador.")
  }
  if (current.items.length === 0) {
    throw new Error("El comprobante debe tener al menos un concepto.")
  }

  const { error } = await client.rpc("issue_isp_billing_document", {
    p_document_id: documentId,
  })
  if (error) throw new Error(error.message)
  return loadDocumentBundle(client, companyId, documentId)
}

export async function cancelIspBillingDocument(
  client: IspBillingDocumentQueriesClient,
  companyId: string,
  documentId: string
): Promise<IspBillingDocument> {
  const current = await loadDocumentBundle(client, companyId, documentId)
  if (!canCancelBillingDocument(current.status)) {
    throw new Error("Este comprobante no se puede anular.")
  }
  const { error } = await client.rpc("cancel_isp_billing_document", {
    p_document_id: documentId,
  })
  if (error) throw new Error(error.message)
  return loadDocumentBundle(client, companyId, documentId)
}

export function toBillingDocumentList(items: IspBillingDocument[]) {
  return items.map(mapBillingDocumentListItem)
}

export function assertNoCae(document: IspBillingDocument): boolean {
  return document.cae == null
}
