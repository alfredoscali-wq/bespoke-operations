import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ISP_BILLING_DOCUMENT_ISSUER_REQUIRED,
  ISP_BILLING_MONTHLY_CANCELLED,
  ISP_BILLING_MONTHLY_CONFIRM_BLOCKED,
  ISP_BILLING_MONTHLY_CONFIRMED,
  ISP_BILLING_MONTHLY_PERIOD_BILLED,
  ISP_BILLING_MONTHLY_PREPARED,
} from "@/lib/isp/billing-constants"
import {
  createIspBillingDocument,
  issueIspBillingDocument,
} from "@/lib/isp/billing-document-queries"
import {
  confirmableGroups,
  evaluateServicesForMonthlyRun,
  groupBillingRunItems,
  summarizeBillingRunGroups,
} from "@/lib/isp/billing-run-engine"
import {
  conceptsToJson,
  mapBillingRunItemRow,
  mapBillingRunRow,
} from "@/lib/isp/billing-run-mapper"
import type {
  IspBillingRun,
  IspBillingRunDetail,
  IspBillingRunItem,
  IspBillingServiceForRun,
} from "@/lib/isp/billing-run-types"
import {
  billingPeriodLabel,
  billingPeriodStartIso,
  isValidBillingPeriod,
  previousBillingPeriod,
  type BillingPeriod,
} from "@/lib/isp/billing-proration"
import { buildBillingConfigurationStatus, ignoreClientCompanyId } from "@/lib/isp/billing-integrity"
import { getIspBillingSettings } from "@/lib/isp/billing-queries"
import type { Database } from "@/lib/supabase/database.types"

export type IspBillingRunQueriesClient = SupabaseClient<Database>

export class BillingRunConflictError extends Error {
  run: IspBillingRun
  constructor(run: IspBillingRun) {
    super(ISP_BILLING_MONTHLY_PERIOD_BILLED)
    this.name = "BillingRunConflictError"
    this.run = run
  }
}

function mapWriteError(error: { message?: string } | null): string {
  return error?.message || "No se pudo guardar la corrida de facturación."
}

async function loadRunItems(
  client: IspBillingRunQueriesClient,
  companyId: string,
  runId: string
): Promise<IspBillingRunItem[]> {
  const { data, error } = await client
    .from("isp_billing_run_items")
    .select("*")
    .eq("company_id", companyId)
    .eq("run_id", runId)
    .order("customer_name", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map(mapBillingRunItemRow)
    .filter((item): item is IspBillingRunItem => item != null)
}

async function loadRunRow(
  client: IspBillingRunQueriesClient,
  companyId: string,
  runId: string
): Promise<IspBillingRun> {
  const { data, error } = await client
    .from("isp_billing_runs")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", runId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const mapped = data ? mapBillingRunRow(data) : null
  if (!mapped) throw new Error("Corrida de facturación no encontrada.")
  return mapped
}

export function toBillingRunDetail(
  run: IspBillingRun,
  items: IspBillingRunItem[]
): IspBillingRunDetail {
  const groups = groupBillingRunItems(items)
  const summary = summarizeBillingRunGroups(groups)
  return {
    run: {
      ...run,
      totalCustomers: summary.totalCustomers,
      totalDocuments: summary.totalDocuments,
      totalAmount: summary.totalAmount,
      proportionalDocuments: summary.proportionalDocuments,
      errorsCount: summary.errorsCount,
      warningsCount: summary.warningsCount,
    },
    items,
    groups,
    typeSummaries: summary.typeSummaries,
    canConfirm: summary.canConfirm && run.status !== "confirmed" && run.status !== "cancelled",
  }
}

export async function listIspBillingRuns(
  client: IspBillingRunQueriesClient,
  companyId: string
): Promise<IspBillingRun[]> {
  const { data, error } = await client
    .from("isp_billing_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map(mapBillingRunRow)
    .filter((item): item is IspBillingRun => item != null)
}

export async function getIspBillingRun(
  client: IspBillingRunQueriesClient,
  companyId: string,
  runId: string
): Promise<IspBillingRunDetail> {
  const run = await loadRunRow(client, companyId, runId)
  const items = await loadRunItems(client, companyId, runId)
  return toBillingRunDetail(run, items)
}

export async function getIspBillingRunByPeriod(
  client: IspBillingRunQueriesClient,
  companyId: string,
  period: BillingPeriod
): Promise<IspBillingRun | null> {
  const { data, error } = await client
    .from("isp_billing_runs")
    .select("*")
    .eq("company_id", companyId)
    .eq("period_year", period.year)
    .eq("period_month", period.month)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapBillingRunRow(data) : null
}

async function listPreviousBilledServiceIds(
  client: IspBillingRunQueriesClient,
  companyId: string,
  period: BillingPeriod
): Promise<Set<string>> {
  const previous = previousBillingPeriod(period)
  const previousRun = await getIspBillingRunByPeriod(client, companyId, previous)
  if (!previousRun || previousRun.status !== "confirmed") return new Set()
  const { data, error } = await client
    .from("isp_billing_run_items")
    .select("service_id")
    .eq("company_id", companyId)
    .eq("run_id", previousRun.id)
    .eq("status", "billed")
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row) => row.service_id))
}

async function loadServicesForRun(
  client: IspBillingRunQueriesClient,
  companyId: string
): Promise<IspBillingServiceForRun[]> {
  const { data: services, error } = await client
    .from("isp_services")
    .select(
      "id, customer_id, plan_name, catalog_code, monthly_fee, list_price, activation_date, commercial_status"
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)

  const rows = services ?? []
  const customerIds = [...new Set(rows.map((row) => row.customer_id))]
  if (customerIds.length === 0) return []

  const [{ data: customers, error: customerError }, { data: subscribers, error: subscriberError }] =
    await Promise.all([
      client
        .from("customers")
        .select("id, name, dni, email, address, locality")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("id", customerIds),
      client
        .from("isp_subscribers")
        .select("id, customer_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .in("customer_id", customerIds),
    ])
  if (customerError) throw new Error(customerError.message)
  if (subscriberError) throw new Error(subscriberError.message)

  const customerById = new Map((customers ?? []).map((row) => [row.id, row]))
  const subscriberByCustomer = new Map(
    (subscribers ?? []).map((row) => [row.customer_id, row.id])
  )

  return rows.flatMap((row) => {
    const customer = customerById.get(row.customer_id)
    if (!customer) return []
    return [
      {
        id: row.id,
        customerId: row.customer_id,
        subscriberId: subscriberByCustomer.get(row.customer_id) ?? null,
        customerName: customer.name,
        customerDni: customer.dni,
        customerEmail: customer.email,
        customerAddress: customer.address,
        customerLocality: customer.locality,
        planName: row.plan_name,
        catalogCode: row.catalog_code,
        monthlyFee: row.monthly_fee,
        listPrice: row.list_price,
        activationDate: row.activation_date,
        commercialStatus: row.commercial_status,
      },
    ]
  })
}

export async function prepareIspBillingRun(
  client: IspBillingRunQueriesClient,
  sessionCompanyId: string,
  input: { year: number; month: number; companyId?: string; createdBy?: string | null }
): Promise<IspBillingRunDetail> {
  const companyId = ignoreClientCompanyId(sessionCompanyId, input.companyId)
  const period = { year: input.year, month: input.month }
  if (!isValidBillingPeriod(period)) {
    throw new Error("El período de facturación no es válido.")
  }

  const existing = await getIspBillingRunByPeriod(client, companyId, period)
  if (existing?.status === "confirmed") {
    throw new BillingRunConflictError(existing)
  }

  const settings = await getIspBillingSettings(client, companyId)
  const config = buildBillingConfigurationStatus({ settings })
  const services = await loadServicesForRun(client, companyId)
  const previousBilled = await listPreviousBilledServiceIds(client, companyId, period)
  const evaluated = evaluateServicesForMonthlyRun({
    services,
    period,
    issuerVatCondition: settings?.vatCondition,
    issuerReady: Boolean(settings && config.companyReady),
    pointOfSaleReady: config.pointOfSaleReady,
    previousBilledServiceIds: previousBilled,
  })

  let runId = existing?.id
  if (!runId) {
    const { data, error } = await client
      .from("isp_billing_runs")
      .insert({
        company_id: companyId,
        period_year: period.year,
        period_month: period.month,
        status: "preparing",
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single()
    if (error) throw new Error(mapWriteError(error))
    runId = data.id
  } else {
    const { error } = await client
      .from("isp_billing_runs")
      .update({
        status: "preparing",
        cancelled_at: null,
        confirmed_at: null,
        confirmed_by: null,
      })
      .eq("id", runId)
      .eq("company_id", companyId)
    if (error) throw new Error(mapWriteError(error))
    const { error: deleteError } = await client
      .from("isp_billing_run_items")
      .delete()
      .eq("run_id", runId)
      .eq("company_id", companyId)
    if (deleteError) throw new Error(mapWriteError(deleteError))
  }

  if (evaluated.length > 0) {
    const { error: insertError } = await client.from("isp_billing_run_items").insert(
      evaluated.map((item) => ({
        run_id: runId,
        company_id: companyId,
        customer_id: item.customerId,
        subscriber_id: item.subscriberId,
        service_id: item.serviceId,
        document_type: item.documentType,
        status: item.status,
        customer_name: item.customerName,
        service_name: item.serviceName,
        catalog_code: item.catalogCode,
        activation_date: item.activationDate,
        list_price: item.listPrice,
        monthly_amount: item.monthlyAmount,
        proportional_days: item.proportionalDays,
        proportional_amount: item.proportionalAmount,
        proportional_period_label: item.proportionalPeriodLabel,
        total_amount: item.totalAmount,
        error_code: item.errorCode,
        error_message: item.errorMessage,
        suggested_action: item.suggestedAction,
        warning_code: item.warningCode,
        warning_message: item.warningMessage,
        requires_review: item.requiresReview,
        concepts: conceptsToJson(item.concepts),
        document_id: null,
      }))
    )
    if (insertError) throw new Error(mapWriteError(insertError))
  }

  const items = await loadRunItems(client, companyId, runId)
  const summary = summarizeBillingRunGroups(groupBillingRunItems(items))
  const nextStatus = summary.errorsCount > 0 ? "with_errors" : "in_review"
  const { error: updateError } = await client
    .from("isp_billing_runs")
    .update({
      status: nextStatus,
      prepared_at: new Date().toISOString(),
      total_customers: summary.totalCustomers,
      total_documents: summary.totalDocuments,
      total_amount: summary.totalAmount,
      proportional_documents: summary.proportionalDocuments,
      errors_count: summary.errorsCount,
      warnings_count: summary.warningsCount,
    })
    .eq("id", runId)
    .eq("company_id", companyId)
  if (updateError) throw new Error(mapWriteError(updateError))

  return getIspBillingRun(client, companyId, runId)
}

export async function cancelIspBillingRun(
  client: IspBillingRunQueriesClient,
  companyId: string,
  runId: string
): Promise<IspBillingRunDetail> {
  const current = await getIspBillingRun(client, companyId, runId)
  if (current.run.status === "confirmed") {
    throw new Error("Una corrida confirmada no se puede cancelar.")
  }
  if (current.items.some((item) => item.documentId)) {
    throw new Error("La corrida ya tiene comprobantes asociados.")
  }
  const { error } = await client
    .from("isp_billing_runs")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("company_id", companyId)
  if (error) throw new Error(mapWriteError(error))
  return getIspBillingRun(client, companyId, runId)
}

export async function confirmIspBillingRun(
  client: IspBillingRunQueriesClient,
  companyId: string,
  runId: string,
  confirmedBy?: string | null
): Promise<IspBillingRunDetail> {
  const current = await getIspBillingRun(client, companyId, runId)
  if (current.run.status === "confirmed") return current
  if (current.run.status === "cancelled") {
    throw new Error("No se puede confirmar una corrida cancelada.")
  }
  if (!current.canConfirm) {
    throw new Error(ISP_BILLING_MONTHLY_CONFIRM_BLOCKED)
  }
  if (!current.run.periodYear || !current.run.periodMonth) {
    throw new Error("El período de la corrida no es válido.")
  }

  const settings = await getIspBillingSettings(client, companyId)
  const config = buildBillingConfigurationStatus({ settings })
  if (!settings || config.incomplete || !settings.pointOfSale) {
    throw new Error(
      config.missing[0]?.message ?? ISP_BILLING_DOCUMENT_ISSUER_REQUIRED
    )
  }

  const period = {
    year: current.run.periodYear,
    month: current.run.periodMonth,
  }
  const issueDate = billingPeriodStartIso(period)
  const observation = `Facturación ${billingPeriodLabel(period)}`

  for (const group of confirmableGroups(current.groups)) {
    if (group.items.some((item) => item.documentId) || !group.documentType) continue
    const draftItems = group.concepts
      .filter((concept) => concept.amount > 0 && concept.description.trim())
      .map((concept) => ({
        serviceId: concept.serviceId,
        description: concept.description,
        quantity: 1,
        unitPrice: concept.amount,
        discount: 0,
      }))
    if (draftItems.length === 0) continue

    const document = await createIspBillingDocument(client, companyId, {
      documentType: group.documentType,
      customerId: group.customerId,
      subscriberId: group.subscriberId,
      issueDate,
      observations: observation,
      items: draftItems,
      billingRunId: runId,
      periodYear: period.year,
      periodMonth: period.month,
    })
    const issued = await issueIspBillingDocument(client, companyId, document.id)
    const readyIds = group.items
      .filter((item) => item.status === "ready")
      .map((item) => item.id)
    if (readyIds.length > 0) {
      const { error } = await client
        .from("isp_billing_run_items")
        .update({
          document_id: issued.id,
          status: "billed",
        })
        .eq("company_id", companyId)
        .eq("run_id", runId)
        .in("id", readyIds)
      if (error) throw new Error(mapWriteError(error))
    }
  }

  const { error } = await client
    .from("isp_billing_runs")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: confirmedBy ?? null,
    })
    .eq("id", runId)
    .eq("company_id", companyId)
  if (error) throw new Error(mapWriteError(error))

  return getIspBillingRun(client, companyId, runId)
}

export function billingRunPrepareMessage(): string {
  return ISP_BILLING_MONTHLY_PREPARED
}

export function billingRunConfirmMessage(): string {
  return ISP_BILLING_MONTHLY_CONFIRMED
}

export function billingRunCancelMessage(): string {
  return ISP_BILLING_MONTHLY_CANCELLED
}
