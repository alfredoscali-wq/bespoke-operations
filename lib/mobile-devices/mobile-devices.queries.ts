import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  MobileDeviceRecord,
  MobileDeviceStatus,
} from "@/lib/mobile-devices/types"

type MobileDeviceRow = {
  id: string
  company_id: string
  work_team_id: string | null
  device_id: string
  manufacturer: string
  model: string
  android_version: string
  app_version: string
  platform: string
  status: MobileDeviceStatus
  registered_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export type UpsertMobileDeviceInput = {
  companyId: string
  deviceId: string
  manufacturer: string
  model: string
  androidVersion: string
  appVersion: string
  platform: string
}

function mapMobileDeviceRow(row: MobileDeviceRow): MobileDeviceRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    workTeamId: row.work_team_id,
    deviceId: row.device_id,
    manufacturer: row.manufacturer,
    model: row.model,
    androidVersion: row.android_version,
    appVersion: row.app_version,
    platform: row.platform,
    status: row.status,
    registeredAt: row.registered_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchMobileDeviceByCompanyAndDeviceId(
  client: SupabaseClient,
  companyId: string,
  deviceId: string
): Promise<MobileDeviceRecord | null> {
  const { data, error } = await client
    .from("mobile_devices")
    .select("*")
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapMobileDeviceRow(data as MobileDeviceRow) : null
}

export async function upsertMobileDeviceProvision(
  client: SupabaseClient,
  input: UpsertMobileDeviceInput
): Promise<{ device: MobileDeviceRecord; created: boolean }> {
  const existing = await fetchMobileDeviceByCompanyAndDeviceId(
    client,
    input.companyId,
    input.deviceId
  )

  const now = new Date().toISOString()

  if (!existing) {
    const { data, error } = await client
      .from("mobile_devices")
      .insert({
        company_id: input.companyId,
        device_id: input.deviceId,
        manufacturer: input.manufacturer,
        model: input.model,
        android_version: input.androidVersion,
        app_version: input.appVersion,
        platform: input.platform,
        status: "ACTIVE",
        registered_at: now,
        last_seen_at: now,
      })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return {
      device: mapMobileDeviceRow(data as MobileDeviceRow),
      created: true,
    }
  }

  const { data, error } = await client
    .from("mobile_devices")
    .update({
      manufacturer: input.manufacturer,
      model: input.model,
      android_version: input.androidVersion,
      app_version: input.appVersion,
      platform: input.platform,
      last_seen_at: now,
    })
    .eq("id", existing.id)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return {
    device: mapMobileDeviceRow(data as MobileDeviceRow),
    created: false,
  }
}

export async function listMobileDevicesByCompany(
  client: SupabaseClient,
  companyId: string
): Promise<MobileDeviceRecord[]> {
  const { data, error } = await client
    .from("mobile_devices")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => mapMobileDeviceRow(row as MobileDeviceRow))
}

export async function updateMobileDeviceStatus(
  client: SupabaseClient,
  companyId: string,
  deviceRecordId: string,
  status: MobileDeviceStatus
): Promise<MobileDeviceRecord> {
  const { data, error } = await client
    .from("mobile_devices")
    .update({ status })
    .eq("id", deviceRecordId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return mapMobileDeviceRow(data as MobileDeviceRow)
}

export async function fetchMobileDeviceById(
  client: SupabaseClient,
  companyId: string,
  deviceRecordId: string
): Promise<MobileDeviceRecord | null> {
  const { data, error } = await client
    .from("mobile_devices")
    .select("*")
    .eq("id", deviceRecordId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapMobileDeviceRow(data as MobileDeviceRow) : null
}
