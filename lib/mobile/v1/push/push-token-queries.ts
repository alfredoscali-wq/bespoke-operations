import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { StoredPushTokenRow } from "@/lib/mobile/v1/push/types"

type PushTokenRow = StoredPushTokenRow

function mapRow(row: PushTokenRow): StoredPushTokenRow {
  return {
    id: row.id,
    company_id: row.company_id,
    user_id: row.user_id,
    device_id: row.device_id,
    platform: row.platform,
    push_token: row.push_token,
    enabled: row.enabled,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export async function fetchActivePushTokensForCompany(
  client: SupabaseClient,
  companyId: string
): Promise<StoredPushTokenRow[]> {
  const { data, error } = await client
    .from("network_push_tokens")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => mapRow(row as PushTokenRow))
}

export async function persistPushTokenRows(
  client: SupabaseClient,
  previous: StoredPushTokenRow[],
  next: StoredPushTokenRow[]
): Promise<void> {
  const previousById = new Map(previous.map((row) => [row.id, row]))
  const nextById = new Map(next.map((row) => [row.id, row]))

  for (const row of next) {
    const before = previousById.get(row.id)
    if (!before) {
      const { error } = await client.from("network_push_tokens").insert({
        id: row.id,
        company_id: row.company_id,
        user_id: row.user_id,
        device_id: row.device_id,
        platform: row.platform,
        push_token: row.push_token,
        enabled: row.enabled,
        last_seen_at: row.last_seen_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      })
      if (error) {
        throw error
      }
      continue
    }

    if (
      before.push_token === row.push_token &&
      before.enabled === row.enabled &&
      before.last_seen_at === row.last_seen_at &&
      before.deleted_at === row.deleted_at
    ) {
      continue
    }

    const { error } = await client
      .from("network_push_tokens")
      .update({
        platform: row.platform,
        push_token: row.push_token,
        enabled: row.enabled,
        last_seen_at: row.last_seen_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      })
      .eq("id", row.id)
    if (error) {
      throw error
    }
  }

  for (const row of previous) {
    if (!nextById.has(row.id)) {
      const { error } = await client
        .from("network_push_tokens")
        .update({
          enabled: false,
          deleted_at: row.updated_at,
          updated_at: row.updated_at,
        })
        .eq("id", row.id)
      if (error) {
        throw error
      }
    }
  }
}
