import type { Json } from "@/lib/supabase/database.types"
import { mapIspServiceRow } from "@/lib/isp/mapper"
import { resolveEffectiveCommercialStatus } from "@/lib/isp/subscriber-service-integrity"
import type { IspQueriesClient } from "@/lib/isp/queries"
import { ISP_CONNECTION_NOT_FOUND_MESSAGE } from "@/lib/isp/connection-delete"
import type {
  IspConnectionDraft,
  IspSubscriberServiceResult,
  IspUnconnectedServiceOption,
} from "@/lib/isp/types"

function rpcError(error: { message?: string } | null): never {
  throw new Error(error?.message || "No se pudo completar la operación ISP.")
}

function asResult(data: unknown): IspSubscriberServiceResult {
  const result = (data ?? {}) as {
    customerId?: string
    serviceId?: string
    connectionId?: string | null
    replacedServiceId?: string | null
  }
  return {
    customerId: result.customerId ?? "",
    serviceId: result.serviceId ?? "",
    connectionId: result.connectionId ?? null,
    replacedServiceId: result.replacedServiceId ?? null,
  }
}

export function connectionDraftToPayload(
  draft: Partial<IspConnectionDraft>,
  options?: { includePassword?: boolean }
) {
  return {
    connectionType: draft.connectionType ?? "",
    pppoeUsername: draft.pppoeUsername ?? "",
    pppoePassword:
      options?.includePassword === false ? "" : (draft.pppoePassword ?? ""),
    technicalProfile: draft.technicalProfile ?? "",
    technicalProfileId: draft.technicalProfileId || null,
    ipAddress: draft.ipAddress ?? "",
    prefixLength: draft.prefixLength ?? "",
    gateway: draft.gateway ?? "",
    vlan: draft.vlan ?? "",
    coreName: draft.coreName ?? "",
    coreProfileId: draft.coreProfileId || null,
    technicalStatus: draft.technicalStatus,
  }
}

export async function createIspSubscriberService(
  client: IspQueriesClient,
  payload: {
    customerId: string
    catalogId: string
    monthlyFee?: string | number | null
    activationDate?: string | null
    commercialStatus?: string | null
    notes?: string | null
    includeConnection: boolean
    replacedServiceId?: string | null
    connection?: Partial<IspConnectionDraft>
  }
): Promise<IspSubscriberServiceResult> {
  const { commercialStatus: _ignoredCommercialStatus, connection, ...rest } =
    payload
  const { data, error } = await client.rpc("create_isp_subscriber_service", {
    p_payload: {
      ...rest,
      connection: connection
        ? connectionDraftToPayload(connection)
        : undefined,
    } as Json,
  })
  if (error) rpcError(error)
  return asResult(data)
}

export async function createIspServiceConnection(
  client: IspQueriesClient,
  payload: {
    serviceId: string
    connection: Partial<IspConnectionDraft>
  }
): Promise<{ serviceId: string; connectionId: string | null }> {
  const { data, error } = await client.rpc("create_isp_service_connection", {
    p_payload: {
      serviceId: payload.serviceId,
      connection: connectionDraftToPayload(payload.connection),
    } as Json,
  })
  if (error) rpcError(error)
  const result = (data ?? {}) as {
    serviceId?: string
    connectionId?: string | null
  }
  return {
    serviceId: result.serviceId ?? payload.serviceId,
    connectionId: result.connectionId ?? null,
  }
}

export async function updateIspContractedService(
  client: IspQueriesClient,
  payload: {
    serviceId: string
    monthlyFee?: string | number | null
    activationDate?: string | null
    commercialStatus?: string | null
    notes?: string | null
  }
): Promise<{ serviceId: string }> {
  const { data, error } = await client.rpc("update_isp_contracted_service", {
    p_payload: payload as Json,
  })
  if (error) rpcError(error)
  const result = (data ?? {}) as { serviceId?: string }
  return { serviceId: result.serviceId ?? payload.serviceId }
}

export async function updateIspConnection(
  client: IspQueriesClient,
  payload: {
    connectionId: string
    connection: Partial<IspConnectionDraft>
  }
): Promise<{ connectionId: string; serviceId: string | null }> {
  const { data, error } = await client.rpc("update_isp_connection", {
    p_payload: {
      connectionId: payload.connectionId,
      connection: connectionDraftToPayload(payload.connection),
    } as Json,
  })
  if (error) rpcError(error)
  const result = (data ?? {}) as {
    connectionId?: string
    serviceId?: string | null
  }
  return {
    connectionId: result.connectionId ?? payload.connectionId,
    serviceId: result.serviceId ?? null,
  }
}

export async function deleteIspConnection(
  client: IspQueriesClient,
  companyId: string,
  connectionId: string
): Promise<{ deleted: true; connectionId: string }> {
  const now = new Date().toISOString()

  const { data: current, error: loadError } = await client
    .from("isp_connections")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", connectionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!current) throw new Error(ISP_CONNECTION_NOT_FOUND_MESSAGE)

  const { error: equipmentError } = await client
    .from("isp_connection_equipment")
    .update({ deleted_at: now })
    .eq("company_id", companyId)
    .eq("connection_id", connectionId)
    .is("deleted_at", null)

  if (equipmentError) throw new Error(equipmentError.message)

  const { data, error } = await client
    .from("isp_connections")
    .update({ deleted_at: now })
    .eq("company_id", companyId)
    .eq("id", connectionId)
    .is("deleted_at", null)
    .select("id")

  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error(ISP_CONNECTION_NOT_FOUND_MESSAGE)

  return { deleted: true, connectionId }
}

export async function getIspContractedService(
  client: IspQueriesClient,
  companyId: string,
  serviceId: string
) {
  const { data, error } = await client
    .from("isp_services")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", serviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapIspServiceRow(data) : null
}

export async function listIspUnconnectedServices(
  client: IspQueriesClient,
  companyId: string
): Promise<IspUnconnectedServiceOption[]> {
  const { data: serviceRows, error: serviceError } = await client
    .from("isp_services")
    .select("id, customer_id, plan_name, catalog_id, catalog_code, commercial_status, activation_date")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(400)

  if (serviceError) throw new Error(serviceError.message)
  if (!serviceRows?.length) return []

  const { data: connectionRows, error: connectionError } = await client
    .from("isp_connections")
    .select("service_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in(
      "service_id",
      serviceRows.map((row) => row.id)
    )

  if (connectionError) throw new Error(connectionError.message)
  const connected = new Set((connectionRows ?? []).map((row) => row.service_id))
  const unconnected = serviceRows.filter((row) => !connected.has(row.id))
  if (unconnected.length === 0) return []

  const customerIds = [...new Set(unconnected.map((row) => row.customer_id))]
  const { data: customers, error: customerError } = await client
    .from("customers")
    .select("id, name")
    .eq("company_id", companyId)
    .in("id", customerIds)

  if (customerError) throw new Error(customerError.message)
  const nameById = new Map((customers ?? []).map((row) => [row.id, row.name]))

  return unconnected.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: nameById.get(row.customer_id) ?? "Abonado",
    planName: row.plan_name,
    catalogId: row.catalog_id,
    catalogCode: row.catalog_code,
    commercialStatus: resolveEffectiveCommercialStatus({
      storedStatus: row.commercial_status,
      activationDate: row.activation_date,
    }),
  }))
}
