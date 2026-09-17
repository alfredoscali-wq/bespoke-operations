export type GpsLiveFreshness = "recent" | "stale" | "missing"

export type GpsLiveHeartbeatRequest = {
  deviceId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  timestamp: string
}

export type GpsLiveHeartbeatAccepted = {
  accepted: true
  workTeamId: string
  latitude: number
  longitude: number
  accuracyMeters: number | null
  capturedAt: string
  receivedAt: string
}

export type CompanyGpsHeartbeatSettings = {
  gpsHeartbeatEnabled: boolean
  gpsHeartbeatIntervalSeconds: number
}

export type GpsLiveDestination = {
  latitude: number
  longitude: number
  source: "task" | "project"
}

export type GpsLiveCurrentTask = {
  id: string
  code: string | null
  title: string
  status: string
  destination: GpsLiveDestination | null
}

export type GpsLiveCrewMarker = {
  workTeamId: string
  workTeamName: string
  shiftStatus: "ACTIVE"
  shiftStartedAt: string
  latitude: number | null
  longitude: number | null
  accuracyMeters: number | null
  capturedAt: string | null
  receivedAt: string | null
  freshness: GpsLiveFreshness
  currentTask: GpsLiveCurrentTask | null
}
