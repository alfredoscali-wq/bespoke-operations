import type {
  PresenceEventType,
  PresenceLocationProvider,
} from "@/lib/presence/constants"

export type TaskPresenceEvent = {
  id: string
  companyId: string
  taskId: string
  employeeId: string
  eventType: PresenceEventType
  latitude: number
  longitude: number
  accuracy: number | null
  provider: PresenceLocationProvider
  deviceId: string
  createdAt: string
  receivedAt: string
}

export type RegisterPresenceEventInput = {
  companyId: string
  taskId: string
  employeeId: string
  latitude: number
  longitude: number
  accuracy: number | null
  provider: PresenceLocationProvider
  deviceId: string
  /** Client / device event time (ISO). Supports offline queue replay. */
  createdAt: string
  /**
   * Legacy Mobile field. Accepted for backward compatibility but never used
   * as authority — Presence Engine decides ENTER / HEARTBEAT / EXIT.
   */
  clientEventType?: PresenceEventType | null
}

export type RegisterPresenceEventResult = {
  event: TaskPresenceEvent
  duplicated: boolean
  operationalRadiusMeters: number
  /** Server-authoritative event type persisted. */
  decidedEventType: PresenceEventType
  distanceMeters: number
  withinRadius: boolean
  targetSource: "task" | "project"
  /** True when clientEventType was present and differed from server decision. */
  clientEventTypeIgnored: boolean
}

export type PresenceEngineSettings = {
  companyId: string
  operationalRadiusMeters: number
  updatedAt: string
}
