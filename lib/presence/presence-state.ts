import type { PresenceEventType } from "@/lib/presence/constants"

/**
 * Operational zone state derived from the last boundary fact (ENTER/EXIT).
 * HEARTBEAT never changes this state.
 */
export const PRESENCE_ZONE_STATES = {
  UNKNOWN: "UNKNOWN",
  OUTSIDE_RADIUS: "OUTSIDE_RADIUS",
  INSIDE_RADIUS: "INSIDE_RADIUS",
} as const

export type PresenceZoneState =
  (typeof PRESENCE_ZONE_STATES)[keyof typeof PRESENCE_ZONE_STATES]

/** Boundary events that define zone membership. */
export function isPresenceBoundaryEvent(
  eventType: PresenceEventType
): eventType is "ENTER_RADIUS" | "EXIT_RADIUS" {
  return eventType === "ENTER_RADIUS" || eventType === "EXIT_RADIUS"
}

export function resolvePresenceZoneState(
  lastBoundaryEventType: PresenceEventType | null
): PresenceZoneState {
  if (lastBoundaryEventType === "ENTER_RADIUS") {
    return PRESENCE_ZONE_STATES.INSIDE_RADIUS
  }
  if (lastBoundaryEventType === "EXIT_RADIUS") {
    return PRESENCE_ZONE_STATES.OUTSIDE_RADIUS
  }
  return PRESENCE_ZONE_STATES.UNKNOWN
}

/**
 * Server authority: decide which presence event to persist from
 * (within-radius observation + last known zone state).
 *
 * Rules:
 * - ENTER only when crossing inward (UNKNOWN/OUTSIDE → inside)
 * - EXIT only when crossing outward (INSIDE → outside) with a valid fix
 * - HEARTBEAT for permanence; never invents EXIT from missing GPS
 * - Never emits consecutive ENTER or consecutive EXIT
 */
export function decidePresenceEventType(input: {
  withinRadius: boolean
  zoneState: PresenceZoneState
}): PresenceEventType {
  if (input.withinRadius) {
    if (input.zoneState === PRESENCE_ZONE_STATES.INSIDE_RADIUS) {
      return "HEARTBEAT"
    }
    // UNKNOWN or OUTSIDE → first confirmed inside is ENTER
    return "ENTER_RADIUS"
  }

  if (input.zoneState === PRESENCE_ZONE_STATES.INSIDE_RADIUS) {
    return "EXIT_RADIUS"
  }

  // UNKNOWN or OUTSIDE while still outside → telemetry only
  return "HEARTBEAT"
}
