import "server-only"

import {
  logPresenceError,
  logPresenceEventRegistered,
  logPresenceInconsistency,
} from "@/lib/presence/logging"
import { calculatePresenceDistanceMeters } from "@/lib/presence/geo"
import { getOperationalPresenceRadiusMeters } from "@/lib/presence/operational-radius.server"
import {
  decidePresenceEventType,
  resolvePresenceZoneState,
} from "@/lib/presence/presence-state"
import { registerPresenceActivitySafe } from "@/lib/presence/register-presence-activity"
import { PresenceRepository } from "@/lib/presence/repository.server"
import { resolvePresenceTargetCoordinates } from "@/lib/presence/resolve-presence-target.server"
import type {
  RegisterPresenceEventInput,
  RegisterPresenceEventResult,
  TaskPresenceEvent,
} from "@/lib/presence/types"
import type { PresenceEventType } from "@/lib/presence/constants"

export class PresenceTargetLocationError extends Error {
  readonly code = "PRESENCE_TARGET_LOCATION_REQUIRED" as const

  constructor(message: string) {
    super(message)
    this.name = "PresenceTargetLocationError"
  }
}

/**
 * Presence Engine internal service — reusable by mobile API and future admin UIs.
 * Server is the authority for ENTER / HEARTBEAT / EXIT (ADR / Master Context).
 */
export class PresenceService {
  constructor(private readonly repository = new PresenceRepository()) {}

  async getOperationalRadiusMeters(companyId: string): Promise<number> {
    return getOperationalPresenceRadiusMeters(companyId)
  }

  async registerEvent(
    input: RegisterPresenceEventInput
  ): Promise<RegisterPresenceEventResult> {
    const operationalRadiusMeters = await this.getOperationalRadiusMeters(
      input.companyId
    )

    const target = await resolvePresenceTargetCoordinates(
      input.companyId,
      input.taskId
    )

    if (!target) {
      throw new PresenceTargetLocationError(
        "No hay ubicación GPS objetivo para evaluar presencia (OT u Obra)."
      )
    }

    const distanceMeters = calculatePresenceDistanceMeters(
      input.latitude,
      input.longitude,
      target.latitude,
      target.longitude
    )
    const withinRadius = distanceMeters <= operationalRadiusMeters

    const lastBoundary = await this.repository.findLatestBoundaryEvent({
      companyId: input.companyId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      beforeCreatedAt: input.createdAt,
    })
    const zoneState = resolvePresenceZoneState(lastBoundary?.eventType ?? null)
    const decidedEventType = decidePresenceEventType({
      withinRadius,
      zoneState,
    })

    const clientEventTypeIgnored = Boolean(
      input.clientEventType && input.clientEventType !== decidedEventType
    )

    if (clientEventTypeIgnored) {
      logPresenceInconsistency("client_event_type_ignored", {
        taskId: input.taskId,
        employeeId: input.employeeId,
        clientEventType: input.clientEventType,
        decidedEventType,
        distanceMeters: Math.round(distanceMeters),
        operationalRadiusMeters,
        zoneState,
      })
    }

    const persistenceInput = {
      companyId: input.companyId,
      taskId: input.taskId,
      employeeId: input.employeeId,
      eventType: decidedEventType,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      provider: input.provider,
      deviceId: input.deviceId,
      createdAt: input.createdAt,
    }

    try {
      const exact = await this.repository.findExactDuplicate(persistenceInput)
      if (exact) {
        return this.buildDuplicateResult({
          event: exact,
          operationalRadiusMeters,
          distanceMeters,
          withinRadius,
          targetSource: target.source,
          clientEventTypeIgnored,
        })
      }

      const near = await this.repository.findNearDuplicate(persistenceInput)
      if (near) {
        return this.buildDuplicateResult({
          event: near,
          operationalRadiusMeters,
          distanceMeters,
          withinRadius,
          targetSource: target.source,
          clientEventTypeIgnored,
        })
      }

      const event = await this.repository.insertEvent(persistenceInput)
      logPresenceEventRegistered({
        eventType: decidedEventType,
        taskId: input.taskId,
        employeeId: input.employeeId,
        duplicated: false,
      })

      if (
        decidedEventType === "ENTER_RADIUS" ||
        decidedEventType === "EXIT_RADIUS"
      ) {
        await registerPresenceActivitySafe({
          companyId: input.companyId,
          taskId: input.taskId,
          employeeId: input.employeeId,
          eventType: decidedEventType,
          distanceMeters,
          operationalRadiusMeters,
          targetSource: target.source,
          latitude: input.latitude,
          longitude: input.longitude,
          deviceId: input.deviceId,
          presenceEventId: event.id,
        })
      }

      return {
        event,
        duplicated: false,
        operationalRadiusMeters,
        decidedEventType,
        distanceMeters,
        withinRadius,
        targetSource: target.source,
        clientEventTypeIgnored,
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "presence_register_failed"

      if (
        typeof message === "string" &&
        (message.includes("task_presence_events_idempotency_uidx") ||
          message.includes("duplicate key"))
      ) {
        const existing =
          await this.repository.findExactDuplicate(persistenceInput)
        if (existing) {
          logPresenceInconsistency("presence_duplicate_race_resolved", {
            taskId: input.taskId,
            employeeId: input.employeeId,
            eventType: decidedEventType,
          })
          return this.buildDuplicateResult({
            event: existing,
            operationalRadiusMeters,
            distanceMeters,
            withinRadius,
            targetSource: target.source,
            clientEventTypeIgnored,
          })
        }
      }

      logPresenceError("presence_register_failed", {
        taskId: input.taskId,
        employeeId: input.employeeId,
        eventType: decidedEventType,
        message,
      })
      throw error
    }
  }

  private buildDuplicateResult(input: {
    event: TaskPresenceEvent
    operationalRadiusMeters: number
    distanceMeters: number
    withinRadius: boolean
    targetSource: "task" | "project"
    clientEventTypeIgnored: boolean
  }): RegisterPresenceEventResult {
    logPresenceEventRegistered({
      eventType: input.event.eventType,
      taskId: input.event.taskId,
      employeeId: input.event.employeeId,
      duplicated: true,
    })

    return {
      event: input.event,
      duplicated: true,
      operationalRadiusMeters: input.operationalRadiusMeters,
      decidedEventType: input.event.eventType,
      distanceMeters: input.distanceMeters,
      withinRadius: input.withinRadius,
      targetSource: input.targetSource,
      clientEventTypeIgnored: input.clientEventTypeIgnored,
    }
  }

  async listEventsForTask(input: {
    companyId: string
    taskId: string
    limit?: number
  }): Promise<TaskPresenceEvent[]> {
    return this.repository.listByTask(input)
  }

  async listEventsForEmployee(input: {
    companyId: string
    employeeId: string
    limit?: number
  }): Promise<TaskPresenceEvent[]> {
    return this.repository.listByEmployee(input)
  }
}

export const presenceService = new PresenceService()
