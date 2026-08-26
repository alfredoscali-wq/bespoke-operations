import type { Database, Json } from "@/lib/supabase/database.types"
import { isIspBillingDocumentType } from "@/lib/isp/billing-integrity"
import {
  ISP_BILLING_RUN_ITEM_STATUSES,
  ISP_BILLING_RUN_STATUSES,
  type IspBillingRun,
  type IspBillingRunConcept,
  type IspBillingRunItem,
  type IspBillingRunItemStatus,
  type IspBillingRunStatus,
} from "@/lib/isp/billing-run-types"

export type BillingRunRow = Database["public"]["Tables"]["isp_billing_runs"]["Row"]
export type BillingRunItemRow =
  Database["public"]["Tables"]["isp_billing_run_items"]["Row"]

function asNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseConcepts(value: Json): IspBillingRunConcept[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const row = entry as Record<string, unknown>
    const kind = row.kind === "proportional" ? "proportional" : "monthly"
    return [
      {
        kind,
        description: String(row.description ?? ""),
        amount: asNumber(row.amount as number),
        days: typeof row.days === "number" ? row.days : undefined,
        periodLabel: String(row.periodLabel ?? ""),
        serviceId: String(row.serviceId ?? ""),
        contractedMonthlyAmount:
          typeof row.contractedMonthlyAmount === "number"
            ? asNumber(row.contractedMonthlyAmount)
            : undefined,
      },
    ]
  })
}

export function conceptsToJson(concepts: IspBillingRunConcept[]): Json {
  return concepts.map((concept) => ({
    kind: concept.kind,
    description: concept.description,
    amount: concept.amount,
    days: concept.days ?? null,
    periodLabel: concept.periodLabel,
    serviceId: concept.serviceId,
    contractedMonthlyAmount: concept.contractedMonthlyAmount ?? null,
  }))
}

export function mapBillingRunRow(row: BillingRunRow): IspBillingRun | null {
  if (!(ISP_BILLING_RUN_STATUSES as readonly string[]).includes(row.status)) {
    return null
  }
  return {
    id: row.id,
    companyId: row.company_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    status: row.status as IspBillingRunStatus,
    preparedAt: row.prepared_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    totalCustomers: row.total_customers,
    totalDocuments: row.total_documents,
    totalAmount: asNumber(row.total_amount),
    proportionalDocuments: row.proportional_documents,
    errorsCount: row.errors_count,
    warningsCount: row.warnings_count,
    createdBy: row.created_by,
    confirmedBy: row.confirmed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapBillingRunItemRow(row: BillingRunItemRow): IspBillingRunItem | null {
  if (!(ISP_BILLING_RUN_ITEM_STATUSES as readonly string[]).includes(row.status)) {
    return null
  }
  const documentType =
    row.document_type && isIspBillingDocumentType(row.document_type)
      ? row.document_type
      : null
  const concepts = parseConcepts(row.concepts)
  const monthlyAmount = asNumber(row.monthly_amount)
  return {
    id: row.id,
    runId: row.run_id,
    companyId: row.company_id,
    customerId: row.customer_id,
    subscriberId: row.subscriber_id,
    serviceId: row.service_id,
    documentType,
    status: row.status as IspBillingRunItemStatus,
    customerName: row.customer_name,
    serviceName: row.service_name,
    catalogCode: row.catalog_code,
    activationDate: row.activation_date,
    listPrice: row.list_price == null ? null : asNumber(row.list_price),
    monthlyAmount,
    contractedMonthlyAmount: Math.max(
      monthlyAmount,
      ...concepts.map((concept) => concept.contractedMonthlyAmount ?? 0)
    ),
    proportionalDays: row.proportional_days,
    proportionalAmount: asNumber(row.proportional_amount),
    proportionalPeriodLabel: row.proportional_period_label,
    totalAmount: asNumber(row.total_amount),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    suggestedAction: row.suggested_action,
    warningCode: row.warning_code,
    warningMessage: row.warning_message,
    requiresReview: row.requires_review,
    concepts,
    documentId: row.document_id,
    createdAt: row.created_at,
  }
}
