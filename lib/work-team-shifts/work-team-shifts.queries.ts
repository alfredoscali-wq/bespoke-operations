import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  WorkTeamShiftRecord,
  WorkTeamShiftStatus,
} from "@/lib/work-team-shifts/types"

type WorkTeamShiftRow = {
  id: string
  company_id: string
  work_team_id: string
  mobile_device_id: string
  started_by: string
  started_at: string
  finished_by: string | null
  finished_at: string | null
  start_latitude: number
  start_longitude: number
  end_latitude: number | null
  end_longitude: number | null
  status: WorkTeamShiftStatus
  created_at: string
  updated_at: string
}

function mapWorkTeamShiftRow(row: WorkTeamShiftRow): WorkTeamShiftRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    workTeamId: row.work_team_id,
    mobileDeviceId: row.mobile_device_id,
    startedBy: row.started_by,
    startedAt: row.started_at,
    finishedBy: row.finished_by,
    finishedAt: row.finished_at,
    startLatitude: row.start_latitude,
    startLongitude: row.start_longitude,
    endLatitude: row.end_latitude,
    endLongitude: row.end_longitude,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchActiveWorkTeamShift(
  client: SupabaseClient,
  companyId: string,
  workTeamId: string
): Promise<WorkTeamShiftRecord | null> {
  const { data, error } = await client
    .from("work_team_shifts")
    .select("*")
    .eq("company_id", companyId)
    .eq("work_team_id", workTeamId)
    .eq("status", "ACTIVE")
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapWorkTeamShiftRow(data as WorkTeamShiftRow) : null
}

export type InsertWorkTeamShiftInput = {
  companyId: string
  workTeamId: string
  mobileDeviceId: string
  startedBy: string
  startLatitude: number
  startLongitude: number
}

export async function insertWorkTeamShift(
  client: SupabaseClient,
  input: InsertWorkTeamShiftInput
): Promise<WorkTeamShiftRecord> {
  const { data, error } = await client
    .from("work_team_shifts")
    .insert({
      company_id: input.companyId,
      work_team_id: input.workTeamId,
      mobile_device_id: input.mobileDeviceId,
      started_by: input.startedBy,
      start_latitude: input.startLatitude,
      start_longitude: input.startLongitude,
      status: "ACTIVE",
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return mapWorkTeamShiftRow(data as WorkTeamShiftRow)
}

export type FinishWorkTeamShiftInput = {
  shiftId: string
  finishedBy: string
  endLatitude: number
  endLongitude: number
}

export async function finishWorkTeamShift(
  client: SupabaseClient,
  input: FinishWorkTeamShiftInput
): Promise<WorkTeamShiftRecord> {
  const finishedAt = new Date().toISOString()

  const { data, error } = await client
    .from("work_team_shifts")
    .update({
      finished_by: input.finishedBy,
      finished_at: finishedAt,
      end_latitude: input.endLatitude,
      end_longitude: input.endLongitude,
      status: "FINISHED",
    })
    .eq("id", input.shiftId)
    .eq("status", "ACTIVE")
    .select("*")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error("SHIFT_NOT_ACTIVE")
  }

  return mapWorkTeamShiftRow(data as WorkTeamShiftRow)
}

export async function fetchCrewNameById(
  client: SupabaseClient,
  crewId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("crews")
    .select("name")
    .eq("id", crewId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.name?.trim() || null
}
