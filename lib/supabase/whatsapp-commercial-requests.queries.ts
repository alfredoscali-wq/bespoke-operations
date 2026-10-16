import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import {
  WHATSAPP_OPEN_REQUEST_STATUSES,
  normalizeWhatsappOriginPhone,
  resolveRepeatedWhatsappAcceptance,
  type WhatsappCommercialRequest,
  type WhatsappQuotedComponent,
  type WhatsappRequestStatus,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import type { WhatsappIdentityContact } from "@/lib/subscriptions/whatsapp-customer-identity"

export type SupabaseWhatsappRequestClient = SupabaseClient<Database>

type RequestRow = Database["public"]["Tables"]["tv_whatsapp_commercial_requests"]["Row"]

export type WhatsappRequestQueryResult<T> =
  | { data: T; error: null; duplicate?: boolean }
  | { data: null; error: { code: string; message: string } }

function mapError(error: { code?: string; message: string }): { code: string; message: string } {
  return { code: error.code ?? "UNKNOWN", message: error.message }
}

function mapRow(row: RequestRow): WhatsappCommercialRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    identityStatus: row.identity_status,
    originPhone: row.origin_phone,
    offer: row.offer,
    currentPlanLabel: row.current_plan_label,
    destinationPlanLabel: row.destination_plan_label,
    quotedMonthlyFee: numberOrNull(row.quoted_monthly_fee),
    quotedComponents: mapComponents(row.quoted_components),
    customerAccepted: row.customer_accepted,
    customerAcceptedAt: row.customer_accepted_at,
    status: row.status,
    operatorResult: row.operator_result,
    operatorNotes: row.operator_notes,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function numberOrNull(value: number | null): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapComponents(value: Json): WhatsappQuotedComponent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const record = item as Record<string, Json | undefined>
    const code = typeof record.code === "string" ? record.code : ""
    const action = record.action
    if (!code || (action !== "keep" && action !== "assign" && action !== "cancel")) return []
    const unitPrice = typeof record.unitPrice === "number" ? record.unitPrice : null
    return [{ code, action, unitPrice }]
  })
}

export async function listWhatsappCommercialRequests(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  status: WhatsappRequestStatus | "all"
): Promise<WhatsappRequestQueryResult<WhatsappCommercialRequest[]>> {
  let query = client
    .from("tv_whatsapp_commercial_requests")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (status !== "all") query = query.eq("status", status)
  const { data, error } = await query
  if (error) return { data: null, error: mapError(error) }
  return { data: (data ?? []).map(mapRow), error: null }
}

export async function getWhatsappCommercialRequest(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  id: string
): Promise<WhatsappRequestQueryResult<WhatsappCommercialRequest>> {
  const { data, error } = await client
    .from("tv_whatsapp_commercial_requests")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle()
  if (error) return { data: null, error: mapError(error) }
  if (!data) {
    return { data: null, error: { code: "NOT_FOUND", message: "La solicitud no existe." } }
  }
  return { data: mapRow(data), error: null }
}

export type WhatsappCustomerHistoryItem = {
  id: string
  offer: WhatsappCommercialRequest["offer"]
  status: WhatsappRequestStatus
  quotedMonthlyFee: number | null
  currentPlanLabel: string | null
  destinationPlanLabel: string | null
  createdAt: string
}

export async function listWhatsappIdentityContacts(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  originPhone: string
): Promise<WhatsappRequestQueryResult<WhatsappIdentityContact[]>> {
  const origin = normalizeWhatsappOriginPhone(originPhone)
  if (!companyId.trim() || !origin) return { data: [], error: null }
  // Compara el teléfono guardado y el origen con el mismo normalizador.
  // Un ilike de dígitos contiguos omitiría fichas con espacios o guiones y
  // podría dejar una sola coincidencia aunque exista un duplicado.
  const pageSize = 1000
  const matches: WhatsappIdentityContact[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("customers")
      .select("id, phone, whatsapp")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error: mapError(error) }
    const rows = data ?? []
    for (const row of rows) {
      if (
        normalizeWhatsappOriginPhone(row.phone ?? "") === origin ||
        normalizeWhatsappOriginPhone(row.whatsapp ?? "") === origin
      ) {
        matches.push({
          customerId: row.id,
          phone: row.phone,
          whatsapp: row.whatsapp,
        })
      }
    }
    if (rows.length < pageSize) break
  }
  return { data: matches, error: null }
}

export async function listWhatsappRequestsForCustomer(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  customerId: string
): Promise<WhatsappRequestQueryResult<WhatsappCustomerHistoryItem[]>> {
  const { data, error } = await client
    .from("tv_whatsapp_commercial_requests")
    .select(
      "id, offer, status, quoted_monthly_fee, current_plan_label, destination_plan_label, created_at"
    )
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  if (error) return { data: null, error: mapError(error) }
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      offer: row.offer,
      status: row.status,
      quotedMonthlyFee: numberOrNull(row.quoted_monthly_fee),
      currentPlanLabel: row.current_plan_label,
      destinationPlanLabel: row.destination_plan_label,
      createdAt: row.created_at,
    })),
    error: null,
  }
}

export async function insertWhatsappCommercialRequest(
  client: SupabaseWhatsappRequestClient,
  request: WhatsappCommercialRequest,
  externalMessageId: string
): Promise<WhatsappRequestQueryResult<WhatsappCommercialRequest>> {
  const messageId = externalMessageId.trim()
  if (!request.companyId.trim() || !messageId) {
    return {
      data: null,
      error: { code: "INVALID", message: "La solicitud no tiene empresa o mensaje." },
    }
  }
  const { data, error } = await client
    .from("tv_whatsapp_commercial_requests")
    .insert({
      id: request.id,
      company_id: request.companyId,
      customer_id: request.customerId,
      identity_status: request.identityStatus,
      origin_phone: request.originPhone,
      offer: request.offer,
      current_plan_label: request.currentPlanLabel,
      destination_plan_label: request.destinationPlanLabel,
      quoted_monthly_fee: request.quotedMonthlyFee,
      quoted_components: request.quotedComponents as Json,
      customer_accepted: request.customerAccepted,
      customer_accepted_at: request.customerAcceptedAt,
      status: request.status,
      external_message_id: messageId,
      created_at: request.createdAt,
      updated_at: request.updatedAt,
    })
    .select("*")
    .maybeSingle()
  if (error?.code === "23505") {
    const existing = await client
      .from("tv_whatsapp_commercial_requests")
      .select("*")
      .eq("company_id", request.companyId)
      .eq("external_message_id", messageId)
      .maybeSingle()
    if (existing.error) return { data: null, error: mapError(existing.error) }
    if (existing.data) return { data: mapRow(existing.data), error: null, duplicate: true }
    const open = await findOpenWhatsappCommercialRequest(
      client,
      request.companyId,
      request.originPhone,
      request.offer
    )
    if (open.error) return { data: null, error: open.error }
    if (
      open.data &&
      resolveRepeatedWhatsappAcceptance({
        companyId: request.companyId,
        originPhone: request.originPhone,
        offer: request.offer,
        existing: {
          companyId: open.data.companyId,
          originPhone: open.data.originPhone,
          offer: open.data.offer,
          status: open.data.status,
          customerId: open.data.customerId,
        },
      }) === "reuse"
    ) {
      return { data: open.data, error: null, duplicate: true }
    }
    return { data: null, error: { code: "CONFLICT", message: "La solicitud ya estaba registrada." } }
  }
  if (error) return { data: null, error: mapError(error) }
  if (!data) {
    return { data: null, error: { code: "INSERT_FAILED", message: "No se pudo registrar la solicitud." } }
  }
  return { data: mapRow(data), error: null, duplicate: false }
}

export async function hasWhatsappInboundMessage(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  externalMessageId: string
): Promise<"seen" | "missing" | "unavailable"> {
  const messageId = externalMessageId.trim()
  if (!companyId.trim() || !messageId) return "unavailable"
  const { data, error } = await client
    .from("tv_whatsapp_processed_messages")
    .select("external_message_id")
    .eq("company_id", companyId)
    .eq("external_message_id", messageId)
    .maybeSingle()
  if (error) return "unavailable"
  return data ? "seen" : "missing"
}

export async function claimWhatsappInboundMessage(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  externalMessageId: string
): Promise<"new" | "duplicate" | "unavailable"> {
  const messageId = externalMessageId.trim()
  if (!companyId.trim() || !messageId) return "unavailable"
  const { error } = await client.from("tv_whatsapp_processed_messages").insert({
    company_id: companyId,
    external_message_id: messageId,
  })
  if (!error) return "new"
  if (error.code === "23505") return "duplicate"
  if (error.code === "42P01" || error.code === "PGRST205") return "unavailable"
  return "unavailable"
}

export async function findOpenWhatsappCommercialRequest(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  originPhone: string,
  offer: WhatsappCommercialRequest["offer"]
): Promise<{ data: WhatsappCommercialRequest | null; error: { code: string; message: string } | null }> {
  const phone = normalizeWhatsappOriginPhone(originPhone)
  if (!companyId.trim() || !phone) return { data: null, error: null }
  const { data, error } = await client
    .from("tv_whatsapp_commercial_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("origin_phone", phone)
    .eq("offer", offer)
    .in("status", [...WHATSAPP_OPEN_REQUEST_STATUSES])
    .order("created_at", { ascending: true })
    .limit(1)
  if (error) return { data: null, error: mapError(error) }
  return { data: data?.[0] ? mapRow(data[0]) : null, error: null }
}

export async function listWhatsappLedgerKeys(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  prefix: string
): Promise<{ ok: true; keys: string[] } | { ok: false }> {
  const normalized = prefix.trim()
  if (!companyId.trim() || !normalized) return { ok: false }
  const pattern = `${normalized.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
  const { data, error } = await client
    .from("tv_whatsapp_processed_messages")
    .select("external_message_id")
    .eq("company_id", companyId)
    .like("external_message_id", pattern)
  if (error) return { ok: false }
  return {
    ok: true,
    keys: (data ?? [])
      .map((row) => row.external_message_id)
      .filter((key) => key.startsWith(normalized)),
  }
}

export async function deleteWhatsappLedgerKey(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  externalMessageId: string
): Promise<"released" | "unavailable"> {
  const messageId = externalMessageId.trim()
  if (!companyId.trim() || !messageId) return "unavailable"
  const { error } = await client
    .from("tv_whatsapp_processed_messages")
    .delete()
    .eq("company_id", companyId)
    .eq("external_message_id", messageId)
  return error ? "unavailable" : "released"
}

export async function updateWhatsappCommercialRequest(
  client: SupabaseWhatsappRequestClient,
  companyId: string,
  request: WhatsappCommercialRequest
): Promise<WhatsappRequestQueryResult<WhatsappCommercialRequest>> {
  const { data, error } = await client
    .from("tv_whatsapp_commercial_requests")
    .update({
      status: request.status,
      operator_result: request.operatorResult,
      operator_notes: request.operatorNotes,
      resolved_by: request.resolvedBy,
      resolved_at: request.resolvedAt,
      updated_at: request.updatedAt,
    })
    .eq("id", request.id)
    .eq("company_id", companyId)
    .select("*")
    .maybeSingle()
  if (error) return { data: null, error: mapError(error) }
  if (!data) {
    return { data: null, error: { code: "NOT_FOUND", message: "La solicitud no existe." } }
  }
  return { data: mapRow(data), error: null }
}
