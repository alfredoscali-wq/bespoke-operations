export {

  DEFAULT_OPERATIONAL_PRESENCE_RADIUS_METERS,

  PRESENCE_EVENT_IDEMPOTENCY_WINDOW_MS,

  PRESENCE_EVENT_TYPES,

  PRESENCE_LOCATION_PROVIDERS,

  isPresenceEventType,

  isPresenceLocationProvider,

  type PresenceEventType,

  type PresenceLocationProvider,

} from "@/lib/presence/constants"

export {

  decidePresenceEventType,

  isPresenceBoundaryEvent,

  PRESENCE_ZONE_STATES,

  resolvePresenceZoneState,

  type PresenceZoneState,

} from "@/lib/presence/presence-state"

export type {

  PresenceEngineSettings,

  RegisterPresenceEventInput,

  RegisterPresenceEventResult,

  TaskPresenceEvent,

} from "@/lib/presence/types"


