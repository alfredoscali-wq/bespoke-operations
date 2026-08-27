import type { SupabaseClient } from "@supabase/supabase-js"

import {
  ISP_BILLING_DOCUMENT_TYPES,
  ISP_BILLING_FORBIDDEN_MESSAGE,
  ISP_BILLING_POS_DUPLICATE_MESSAGE,
} from "@/lib/isp/billing-constants"
import {
  findDuplicatePosNumber,
  ignoreClientCompanyId,
  parsePointOfSaleNumber,
  pickPrimaryPointOfSale,
  validateBillingCompanyDraft,
} from "@/lib/isp/billing-integrity"
import {
  defaultIntegrations,
  mapBillingCompanySettings,
  mapBillingDraftToSettingsInsert,
  mapBillingIntegrationRow,
  mapBillingPointOfSaleRow,
  mapBillingSequenceRow,
} from "@/lib/isp/billing-mapper"
import type {
  IspBillingCompanySettings,
  IspBillingCompanySettingsDraft,
  IspBillingDocumentSequence,
  IspBillingIntegration,
  IspBillingPointOfSale,
  IspBillingPointOfSaleDraft,
} from "@/lib/isp/billing-types"
import type { Database } from "@/lib/supabase/database.types"

export type IspBillingQueriesClient = SupabaseClient<Database>

function mapWriteError(error: { message?: string; code?: string } | null): string {
  const message = error?.message ?? ""
  if (error?.code === "23505" || message.includes("company_number_unique")) {
    return ISP_BILLING_POS_DUPLICATE_MESSAGE
  }
  if (message.includes("one_active")) {
    return "Solo puede haber un punto de venta activo."
  }
  if (message.includes("tax_id_valid") || message.includes("is_valid_ar_cuit")) {
    return "El CUIT no es válido."
  }
  if (message.includes("comprobantes emitidos")) {
    return message
  }
  return message || "No se pudo guardar la configuración fiscal."
}

async function listPointOfSales(
  client: IspBillingQueriesClient,
  companyId: string
): Promise<IspBillingPointOfSale[]> {
  const { data, error } = await client
    .from("isp_billing_point_of_sales")
    .select("*")
    .eq("company_id", companyId)
    .order("number", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapBillingPointOfSaleRow)
}

async function listSequences(
  client: IspBillingQueriesClient,
  companyId: string,
  pointOfSaleId?: string
): Promise<IspBillingDocumentSequence[]> {
  let query = client
    .from("isp_billing_document_sequences")
    .select("*")
    .eq("company_id", companyId)
  if (pointOfSaleId) {
    query = query.eq("point_of_sale_id", pointOfSaleId)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map(mapBillingSequenceRow)
    .filter((item): item is IspBillingDocumentSequence => item != null)
}

async function listIntegrations(
  client: IspBillingQueriesClient,
  companyId: string
): Promise<IspBillingIntegration[]> {
  const { data, error } = await client
    .from("isp_billing_integrations")
    .select("*")
    .eq("company_id", companyId)

  if (error) throw new Error(error.message)
  const mapped = (data ?? [])
    .map(mapBillingIntegrationRow)
    .filter((item): item is IspBillingIntegration => item != null)
  if (mapped.length > 0) return mapped
  return defaultIntegrations()
}

async function ensureIntegrations(
  client: IspBillingQueriesClient,
  companyId: string
): Promise<IspBillingIntegration[]> {
  const { error } = await client.from("isp_billing_integrations").upsert(
    [
      {
        company_id: companyId,
        provider: "arca",
        status: "not_configured",
      },
      {
        company_id: companyId,
        provider: "siro",
        status: "not_configured",
      },
    ],
    { onConflict: "company_id,provider", ignoreDuplicates: true }
  )
  if (error) throw new Error(mapWriteError(error))
  return listIntegrations(client, companyId)
}

async function ensureSequences(
  client: IspBillingQueriesClient,
  companyId: string,
  pointOfSaleId: string,
  drafts: IspBillingCompanySettingsDraft["sequences"]
): Promise<IspBillingDocumentSequence[]> {
  const existing = await listSequences(client, companyId, pointOfSaleId)
  const existingByType = new Map(
    existing.map((item) => [item.documentType, item])
  )

  for (const documentType of ISP_BILLING_DOCUMENT_TYPES) {
    const draft = drafts.find((item) => item.documentType === documentType)
    const nextNumber = Number(draft?.nextNumber ?? 1)
    const current = existingByType.get(documentType)
    if (current) {
      const { error } = await client
        .from("isp_billing_document_sequences")
        .update({ next_number: nextNumber })
        .eq("id", current.id)
        .eq("company_id", companyId)
      if (error) throw new Error(mapWriteError(error))
      continue
    }

    const { error } = await client.from("isp_billing_document_sequences").insert({
      company_id: companyId,
      point_of_sale_id: pointOfSaleId,
      document_type: documentType,
      next_number: Number.isInteger(nextNumber) && nextNumber >= 1 ? nextNumber : 1,
      issued_count: 0,
    })
    if (error) throw new Error(mapWriteError(error))
  }

  return listSequences(client, companyId, pointOfSaleId)
}

export async function getIspBillingSettings(
  client: IspBillingQueriesClient,
  companyId: string
): Promise<IspBillingCompanySettings | null> {
  const { data, error } = await client
    .from("isp_billing_company_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const [pointsOfSale, integrations] = await Promise.all([
    listPointOfSales(client, companyId),
    listIntegrations(client, companyId),
  ])
  const pointOfSale = pickPrimaryPointOfSale(pointsOfSale)
  const sequences = pointOfSale
    ? await listSequences(client, companyId, pointOfSale.id)
    : []

  if (!data) return null

  return mapBillingCompanySettings({
    settings: data,
    pointOfSale,
    sequences,
    integrations,
  })
}

export async function listIspBillingPointOfSales(
  client: IspBillingQueriesClient,
  companyId: string
): Promise<IspBillingPointOfSale[]> {
  return listPointOfSales(client, companyId)
}

export async function upsertIspBillingPointOfSale(
  client: IspBillingQueriesClient,
  companyId: string,
  draft: IspBillingPointOfSaleDraft
): Promise<IspBillingPointOfSale> {
  const existing = await listPointOfSales(client, companyId)
  const number = parsePointOfSaleNumber(draft.number)
  if (number == null) {
    throw new Error("El número de punto de venta debe ser numérico.")
  }

  const current =
    existing.find((item) => item.id === draft.id) ??
    pickPrimaryPointOfSale(existing)

  if (
    findDuplicatePosNumber({
      companyId,
      number,
      currentId: current?.id,
      existing,
    })
  ) {
    throw new Error(ISP_BILLING_POS_DUPLICATE_MESSAGE)
  }

  if (draft.active) {
    const { error: deactivateError } = await client
      .from("isp_billing_point_of_sales")
      .update({ active: false })
      .eq("company_id", companyId)
      .neq("id", current?.id ?? "00000000-0000-0000-0000-000000000000")
    if (deactivateError) throw new Error(mapWriteError(deactivateError))
  }

  if (current) {
    const { data, error } = await client
      .from("isp_billing_point_of_sales")
      .update({
        number,
        description: draft.description.trim(),
        active: draft.active,
      })
      .eq("id", current.id)
      .eq("company_id", companyId)
      .select("*")
      .single()
    if (error) throw new Error(mapWriteError(error))
    return mapBillingPointOfSaleRow(data)
  }

  const { data, error } = await client
    .from("isp_billing_point_of_sales")
    .insert({
      company_id: companyId,
      number,
      description: draft.description.trim(),
      active: draft.active,
    })
    .select("*")
    .single()
  if (error) throw new Error(mapWriteError(error))
  return mapBillingPointOfSaleRow(data)
}

export async function upsertIspBillingSettings(
  client: IspBillingQueriesClient,
  sessionCompanyId: string,
  draft: IspBillingCompanySettingsDraft,
  bodyCompanyId?: string
): Promise<IspBillingCompanySettings> {
  const companyId = ignoreClientCompanyId(sessionCompanyId, bodyCompanyId)
  const current = await getIspBillingSettings(client, companyId)
  const existingPosNumbers = (await listPointOfSales(client, companyId))
    .filter((item) => item.id !== current?.pointOfSale?.id)
    .map((item) => item.number)

  const issues = validateBillingCompanyDraft(draft, {
    existingPosNumbers,
    existingSequences: current?.sequences ?? [],
  })
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? ISP_BILLING_FORBIDDEN_MESSAGE)
  }

  const payload = mapBillingDraftToSettingsInsert(companyId, draft)
  if (!payload.logo_url && current?.logoUrl) {
    payload.logo_url = current.logoUrl
  }
  const { data: saved, error } = await client
    .from("isp_billing_company_settings")
    .upsert(payload, { onConflict: "company_id" })
    .select("*")
    .single()
  if (error) throw new Error(mapWriteError(error))

  const pointOfSale = await upsertIspBillingPointOfSale(
    client,
    companyId,
    draft.pointOfSale
  )
  const sequences = await ensureSequences(
    client,
    companyId,
    pointOfSale.id,
    draft.sequences
  )
  const integrations = await ensureIntegrations(client, companyId)

  return mapBillingCompanySettings({
    settings: saved,
    pointOfSale,
    sequences,
    integrations,
  })
}
