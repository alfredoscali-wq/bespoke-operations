import type {

  PresenceEventType,

  PresenceLocationProvider,

} from "@/lib/presence/constants"



export type MobilePresenceEventRequest = {

  deviceId: string

  employeeId: string

  latitude: number

  longitude: number

  accuracy: number | null

  provider: PresenceLocationProvider

  /**

   * Legacy — optional. Server decides the authoritative event type.

   * Accepted for backward compatibility with older Mobile builds.

   */

  eventType?: PresenceEventType | null

  createdAt: string

}



export type MobilePresenceEventResponse = {

  eventId: string

  duplicated: boolean

  /** Server-authoritative event type that was persisted. */

  eventType: PresenceEventType

  createdAt: string

  operationalRadiusMeters: number

  distanceMeters: number

  withinRadius: boolean

}


