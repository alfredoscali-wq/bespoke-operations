import {
  isIspBillingDocumentType,
  isIspBillingVatCondition,
} from "@/lib/isp/billing-integrity"
import {
  defaultAuthorizationStatus,
  isIspBillingAuthorizationStatus,
  isIspBillingCustomerDocumentType,
  isIspBillingDocumentEventType,
  isIspBillingDocumentStatus,
} from "@/lib/isp/billing-document-integrity"
import type {
  IspBillingDocument,
  IspBillingDocumentEvent,
  IspBillingDocumentItem,
  IspBillingDocumentListItem,
} from "@/lib/isp/billing-document-types"
import { displayBillingDocumentStatus } from "@/lib/isp/billing-document-integrity"
import type { Database } from "@/lib/supabase/database.types"

export type BillingDocumentRow =
  Database["public"]["Tables"]["isp_billing_documents"]["Row"]
export type BillingDocumentItemRow =
  Database["public"]["Tables"]["isp_billing_document_items"]["Row"]
export type BillingDocumentEventRow =
  Database["public"]["Tables"]["isp_billing_document_events"]["Row"]

function asNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function mapBillingDocumentItemRow(
  row: BillingDocumentItemRow
): IspBillingDocumentItem {
  return {
    id: row.id,
    companyId: row.company_id,
    documentId: row.document_id,
    serviceId: row.service_id,
    description: row.description,
    quantity: asNumber(row.quantity),
    unitPrice: asNumber(row.unit_price),
    discount: asNumber(row.discount),
    taxableBase: asNumber(row.taxable_base),
    taxAmount: asNumber(row.tax_amount),
    taxType: row.tax_type,
    taxRate: asNumber(row.tax_rate),
    lineTotal: asNumber(row.line_total),
    sortOrder: row.sort_order,
  }
}

export function mapBillingDocumentEventRow(
  row: BillingDocumentEventRow
): IspBillingDocumentEvent | null {
  if (!isIspBillingDocumentEventType(row.event_type)) return null
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {}
  return {
    id: row.id,
    eventType: row.event_type,
    payload,
    createdAt: row.created_at,
  }
}

export function mapBillingDocumentRow(
  row: BillingDocumentRow,
  items: BillingDocumentItemRow[] = [],
  events: BillingDocumentEventRow[] = []
): IspBillingDocument | null {
  if (!isIspBillingDocumentType(row.document_type)) return null
  const status = isIspBillingDocumentStatus(row.status) ? row.status : "draft"
  const authorizationStatus = isIspBillingAuthorizationStatus(
    row.authorization_status
  )
    ? row.authorization_status
    : defaultAuthorizationStatus(row.document_type)

  return {
    id: row.id,
    companyId: row.company_id,
    billingCompanySettingsId: row.billing_company_settings_id,
    pointOfSaleId: row.point_of_sale_id,
    documentType: row.document_type,
    status,
    authorizationStatus,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    number: row.number,
    formattedNumber: row.formatted_number,
    customerId: row.customer_id,
    subscriberId: row.subscriber_id,
    customerNameSnapshot: row.customer_name_snapshot,
    customerDocumentTypeSnapshot: isIspBillingCustomerDocumentType(
      row.customer_document_type_snapshot
    )
      ? row.customer_document_type_snapshot
      : "dni",
    customerDocumentNumberSnapshot: row.customer_document_number_snapshot,
    customerTaxIdSnapshot: row.customer_tax_id_snapshot,
    customerVatConditionSnapshot: row.customer_vat_condition_snapshot,
    customerTaxAddressSnapshot: row.customer_tax_address_snapshot,
    customerCitySnapshot: row.customer_city_snapshot,
    customerProvinceSnapshot: row.customer_province_snapshot,
    customerPostalCodeSnapshot: row.customer_postal_code_snapshot,
    customerEmailSnapshot: row.customer_email_snapshot,
    issuerLegalNameSnapshot: row.issuer_legal_name_snapshot,
    issuerTaxIdSnapshot: row.issuer_tax_id_snapshot,
    issuerVatConditionSnapshot: isIspBillingVatCondition(
      row.issuer_vat_condition_snapshot
    )
      ? row.issuer_vat_condition_snapshot
      : row.issuer_vat_condition_snapshot,
    issuerTaxAddressSnapshot: row.issuer_tax_address_snapshot,
    issuerCitySnapshot: row.issuer_city_snapshot,
    issuerProvinceSnapshot: row.issuer_province_snapshot,
    issuerPostalCodeSnapshot: row.issuer_postal_code_snapshot,
    issuerPhoneSnapshot: row.issuer_phone_snapshot,
    issuerEmailSnapshot: row.issuer_email_snapshot,
    issuerWebsiteSnapshot: row.issuer_website_snapshot,
    issuerLogoUrlSnapshot: row.issuer_logo_url_snapshot,
    pointOfSaleNumber: row.point_of_sale_number,
    subtotal: asNumber(row.subtotal),
    discountTotal: asNumber(row.discount_total),
    taxTotal: asNumber(row.tax_total),
    total: asNumber(row.total),
    observations: row.observations,
    cae: row.cae,
    caeExpiresAt: row.cae_expires_at,
    billingRunId: row.billing_run_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items
      .slice()
      .sort((left, right) => left.sort_order - right.sort_order)
      .map(mapBillingDocumentItemRow),
    events: events
      .slice()
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map(mapBillingDocumentEventRow)
      .filter((item): item is IspBillingDocumentEvent => item != null),
  }
}

export function mapBillingDocumentListItem(
  document: IspBillingDocument
): IspBillingDocumentListItem {
  const display = displayBillingDocumentStatus(document)
  return {
    id: document.id,
    documentType: document.documentType,
    status: document.status,
    authorizationStatus: document.authorizationStatus,
    issueDate: document.issueDate,
    formattedNumber: document.formattedNumber,
    customerNameSnapshot: document.customerNameSnapshot,
    customerDocumentNumberSnapshot: document.customerDocumentNumberSnapshot,
    customerTaxIdSnapshot: document.customerTaxIdSnapshot,
    total: document.total,
    pointOfSaleNumber: document.pointOfSaleNumber,
    displayStatusLabel: display.label,
  }
}
