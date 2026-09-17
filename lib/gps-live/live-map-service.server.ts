import "server-only"

import { GPS_LIVE_MAP_POLL_MS } from "@/lib/gps-live/constants"
import {
  fetchWorkTeamLocationsForCompany,
  loadCompanyGpsHeartbeatSettings,
} from "@/lib/gps-live/locations.queries"
import {
  buildOperationsLiveMapCrews,
  type LiveMapProjectGpsInput,
} from "@/lib/gps-live/live-map-view"
import type { GpsLiveCrewMarker } from "@/lib/gps-live/types"
import { createAdminClient } from "@/lib/supabase/admin"

type ActiveShiftRow = {
  work_team_id: string
  started_at: string
  status: string
}

type CrewRow = {
  id: string
  name: string
}

type TaskRow = {
  id: string
  code: string | null
  title: string
  status: string
  crew_id: string | null
  crew: string | null
  latitude: number | null
  longitude: number | null
  project_id: string | null
}

export async function loadOperationsLiveMap(
  companyId: string,
  nowMs: number = Date.now()
): Promise<{
  heartbeatIntervalSeconds: number
  pollIntervalMs: number
  crews: GpsLiveCrewMarker[]
}> {
  const admin = createAdminClient()
  const settings = await loadCompanyGpsHeartbeatSettings(admin, companyId)

  const { data: shiftRows, error: shiftError } = await admin
    .from("work_team_shifts")
    .select("work_team_id, started_at, status")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE")

  if (shiftError) {
    throw shiftError
  }

  const shifts = (shiftRows ?? []) as ActiveShiftRow[]
  const workTeamIds = [...new Set(shifts.map((row) => row.work_team_id))]

  if (workTeamIds.length === 0) {
    return {
      heartbeatIntervalSeconds: settings.gpsHeartbeatIntervalSeconds,
      pollIntervalMs: GPS_LIVE_MAP_POLL_MS,
      crews: [],
    }
  }

  const [{ data: crewRows, error: crewError }, locations, { data: taskRows, error: taskError }] =
    await Promise.all([
      admin
        .from("crews")
        .select("id, name")
        .eq("company_id", companyId)
        .in("id", workTeamIds)
        .is("deleted_at", null),
      fetchWorkTeamLocationsForCompany(admin, companyId),
      admin
        .from("tasks")
        .select(
          "id, code, title, status, crew_id, crew, latitude, longitude, project_id"
        )
        .eq("company_id", companyId)
        .eq("status", "en-curso")
        .is("deleted_at", null),
    ])

  if (crewError) throw crewError
  if (taskError) throw taskError

  const inProgressTasks = (taskRows ?? []) as TaskRow[]
  const projectIds = [
    ...new Set(
      inProgressTasks
        .map((task) => task.project_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const projectGpsById = new Map<string, LiveMapProjectGpsInput>()
  if (projectIds.length > 0) {
    const { data: projects, error: projectError } = await admin
      .from("projects")
      .select("id, latitude, longitude")
      .eq("company_id", companyId)
      .in("id", projectIds)
      .is("deleted_at", null)
    if (projectError) throw projectError
    for (const project of projects ?? []) {
      projectGpsById.set(project.id, {
        latitude: project.latitude == null ? null : Number(project.latitude),
        longitude:
          project.longitude == null ? null : Number(project.longitude),
      })
    }
  }

  return {
    heartbeatIntervalSeconds: settings.gpsHeartbeatIntervalSeconds,
    pollIntervalMs: GPS_LIVE_MAP_POLL_MS,
    crews: buildOperationsLiveMapCrews({
      shifts: shifts.map((shift) => ({
        workTeamId: shift.work_team_id,
        startedAt: shift.started_at,
      })),
      crews: ((crewRows ?? []) as CrewRow[]).map((crew) => ({
        id: crew.id,
        name: crew.name,
      })),
      locations: locations.map((row) => ({
        workTeamId: row.work_team_id,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyMeters: row.accuracy_meters,
        capturedAt: row.captured_at,
        receivedAt: row.received_at,
      })),
      tasks: inProgressTasks.map((task) => ({
        id: task.id,
        code: task.code,
        title: task.title,
        status: task.status,
        crewId: task.crew_id,
        crew: task.crew,
        latitude: task.latitude == null ? null : Number(task.latitude),
        longitude: task.longitude == null ? null : Number(task.longitude),
        projectId: task.project_id,
      })),
      projectGpsById,
      intervalSeconds: settings.gpsHeartbeatIntervalSeconds,
      nowMs,
    }),
  }
}
