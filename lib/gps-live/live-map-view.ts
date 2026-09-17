import { hasCoordinates } from "@/lib/gps"
import { resolveGpsLiveFreshness } from "@/lib/gps-live/heartbeat-policy"
import type { GpsLiveCrewMarker, GpsLiveCurrentTask } from "@/lib/gps-live/types"
import { resolveTaskStartCoordinatesFromSources } from "@/lib/mobile/v1/tasks/task-start-coordinates"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"

export type LiveMapShiftInput = {
  workTeamId: string
  startedAt: string
}

export type LiveMapCrewInput = {
  id: string
  name: string
}

export type LiveMapLocationInput = {
  workTeamId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  capturedAt: string
  receivedAt: string
}

export type LiveMapTaskInput = {
  id: string
  code: string | null
  title: string
  status: string
  crewId: string | null
  crew: string | null
  latitude: number | null
  longitude: number | null
  projectId: string | null
}

export type LiveMapProjectGpsInput = {
  latitude: number | null
  longitude: number | null
}

export function buildOperationsLiveMapCrews(input: {
  shifts: LiveMapShiftInput[]
  crews: LiveMapCrewInput[]
  locations: LiveMapLocationInput[]
  tasks: LiveMapTaskInput[]
  projectGpsById: Map<string, LiveMapProjectGpsInput>
  intervalSeconds: number
  nowMs: number
}): GpsLiveCrewMarker[] {
  const crewNameById = new Map(input.crews.map((crew) => [crew.id, crew.name]))
  const workTeamIds = [...new Set(input.shifts.map((shift) => shift.workTeamId))]
  const locationByTeam = new Map(
    input.locations
      .filter((row) => workTeamIds.includes(row.workTeamId))
      .map((row) => [row.workTeamId, row])
  )

  const currentTaskByTeam = new Map<string, GpsLiveCurrentTask>()
  for (const workTeamId of workTeamIds) {
    const crew = {
      id: workTeamId,
      name: crewNameById.get(workTeamId) ?? "",
    }
    const match = input.tasks.find((task) =>
      taskMatchesCrewId(
        { crewId: task.crewId ?? undefined, crew: task.crew ?? "" },
        crew
      )
    )
    if (!match) continue

    const destination = resolveTaskStartCoordinatesFromSources({
      task: {
        projectId: match.projectId ?? undefined,
        latitude: match.latitude ?? undefined,
        longitude: match.longitude ?? undefined,
      },
      project: match.projectId
        ? input.projectGpsById.get(match.projectId) ?? null
        : null,
    })

    currentTaskByTeam.set(workTeamId, {
      id: match.id,
      code: match.code,
      title: match.title,
      status: match.status,
      destination: destination
        ? {
            latitude: destination.latitude,
            longitude: destination.longitude,
            source: destination.source,
          }
        : null,
    })
  }

  const markers: GpsLiveCrewMarker[] = input.shifts.map((shift) => {
    const location = locationByTeam.get(shift.workTeamId) ?? null
    const hasFix =
      location != null &&
      hasCoordinates(location.latitude, location.longitude)

    return {
      workTeamId: shift.workTeamId,
      workTeamName: crewNameById.get(shift.workTeamId)?.trim() || "Cuadrilla",
      shiftStatus: "ACTIVE",
      shiftStartedAt: shift.startedAt,
      latitude: hasFix && location ? location.latitude : null,
      longitude: hasFix && location ? location.longitude : null,
      accuracyMeters: hasFix && location ? location.accuracyMeters : null,
      capturedAt: hasFix && location ? location.capturedAt : null,
      receivedAt: hasFix && location ? location.receivedAt : null,
      freshness: resolveGpsLiveFreshness({
        capturedAt: hasFix && location ? location.capturedAt : null,
        receivedAt: hasFix && location ? location.receivedAt : null,
        intervalSeconds: input.intervalSeconds,
        nowMs: input.nowMs,
      }),
      currentTask: currentTaskByTeam.get(shift.workTeamId) ?? null,
    }
  })

  markers.sort((a, b) => a.workTeamName.localeCompare(b.workTeamName, "es"))
  return markers
}
