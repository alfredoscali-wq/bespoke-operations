import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { mapMikrotikIntegrationPublic } from "@/lib/integrations/mikrotik/public"
import type {
  MikrotikConnectionStatus,
  MikrotikIntegrationPublic,
  MikrotikIntegrationSecretRow,
  MikrotikRouterIdentity,
} from "@/lib/integrations/mikrotik/types"
import type { Database, Json } from "@/lib/supabase/database.types"

type MikrotikDb = SupabaseClient<Database>
export type MikrotikIntegrationUpdate =
  Database["public"]["Tables"]["company_mikrotik_integrations"]["Update"]

export const MIKROTIK_PUBLIC_COLUMNS =
  "id, company_id, name, host, port, protocol, username, enabled, last_connection_at, last_connection_status, last_connection_error, last_router_identity, created_at, updated_at, deleted_at"

export const MIKROTIK_SECRET_COLUMNS = MIKROTIK_PUBLIC_COLUMNS + ", password_encrypted"

function asSecretRow(
  data: unknown
): MikrotikIntegrationSecretRow | null {
  if (!data || typeof data !== "object") return null
  return data as MikrotikIntegrationSecretRow
}

export async function listMikrotikIntegrationsForCompany(
  client: MikrotikDb,
  companyId: string
): Promise<MikrotikIntegrationPublic[]> {
  const { data, error } = await client
    .from("company_mikrotik_integrations")
    .select(MIKROTIK_PUBLIC_COLUMNS)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) =>
    mapMikrotikIntegrationPublic(row as MikrotikIntegrationSecretRow)
  )
}

export async function getMikrotikIntegrationForCompany(
  client: MikrotikDb,
  companyId: string,
  id: string
): Promise<MikrotikIntegrationPublic | null> {
  const { data, error } = await client
    .from("company_mikrotik_integrations")
    .select(MIKROTIK_PUBLIC_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  const row = asSecretRow(data)
  return row ? mapMikrotikIntegrationPublic(row) : null
}

export async function getMikrotikIntegrationSecretForCompany(
  client: MikrotikDb,
  companyId: string,
  id: string
): Promise<MikrotikIntegrationSecretRow | null> {
  const { data, error } = await client
    .from("company_mikrotik_integrations")
    .select(MIKROTIK_SECRET_COLUMNS)
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  return asSecretRow(data)
}

export async function insertMikrotikIntegration(
  client: MikrotikDb,
  row: {
    company_id: string
    name: string
    host: string
    port: number
    protocol: string
    username: string
    password_encrypted: string
    enabled: boolean
    last_connection_status: MikrotikConnectionStatus
  }
): Promise<MikrotikIntegrationPublic> {
  const { data, error } = await client
    .from("company_mikrotik_integrations")
    .insert(row)
    .select(MIKROTIK_PUBLIC_COLUMNS)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la integracion MikroTik.")
  }

  return mapMikrotikIntegrationPublic(data as MikrotikIntegrationSecretRow)
}

export async function updateMikrotikIntegrationForCompany(
  client: MikrotikDb,
  companyId: string,
  id: string,
  patch: MikrotikIntegrationUpdate
): Promise<MikrotikIntegrationPublic | null> {
  const { data, error } = await client
    .from("company_mikrotik_integrations")
    .update(patch)
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .select(MIKROTIK_PUBLIC_COLUMNS)
    .maybeSingle()

  if (error) throw error
  const row = asSecretRow(data)
  return row ? mapMikrotikIntegrationPublic(row) : null
}

export async function softDeleteMikrotikIntegrationForCompany(
  client: MikrotikDb,
  companyId: string,
  id: string
): Promise<boolean> {
  const { data, error } = await client
    .from("company_mikrotik_integrations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function updateMikrotikConnectionState(
  client: MikrotikDb,
  companyId: string,
  id: string,
  state: {
    last_connection_at: string
    last_connection_status: MikrotikConnectionStatus
    last_connection_error: string | null
    last_router_identity: MikrotikRouterIdentity | null
  }
): Promise<MikrotikIntegrationPublic | null> {
  return updateMikrotikIntegrationForCompany(client, companyId, id, {
    last_connection_at: state.last_connection_at,
    last_connection_status: state.last_connection_status,
    last_connection_error: state.last_connection_error,
    last_router_identity: (state.last_router_identity ?? null) as Json | null,
  })
}
