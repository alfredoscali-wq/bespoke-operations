import "server-only"

import {
  PRESENCE_EVENT_IDEMPOTENCY_WINDOW_MS,
  type PresenceEventType,
  type PresenceLocationProvider,
} from "@/lib/presence/constants"
import type { TaskPresenceEvent } from "@/lib/presence/types"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

type PresenceEventRow = {
  id: string
  company_id: string
  task_id: string
  employee_id: string
  event_type: string
  latitude: number
  longitude: number
  accuracy: number | null
  provider: string
  device_id: string
  created_at: string
  received_at: string
}

export function mapPresenceEventRow(row: PresenceEventRow): TaskPresenceEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    taskId: row.task_id,
    employeeId: row.employee_id,
    eventType: row.event_type as PresenceEventType,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    provider: row.provider as PresenceLocationProvider,
    deviceId: row.device_id,
    createdAt: row.created_at,
    receivedAt: row.received_at,
  }
}

export class PresenceRepository {
  constructor(private readonly client: SupabaseClient = createAdminClient()) {}

  async findExactDuplicate(input: {
    companyId: string
    taskId: string
    employeeId: string
    eventType: PresenceEventType
    createdAt: string
    deviceId: string
  }): Promise<TaskPresenceEvent | null> {
    const { data, error } = await this.client
      .from("task_presence_events")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("task_id", input.taskId)
      .eq("employee_id", input.employeeId)
      .eq("event_type", input.eventType)
      .eq("created_at", input.createdAt)
      .eq("device_id", input.deviceId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data ? mapPresenceEventRow(data as PresenceEventRow) : null
  }

  /**
   * Near-duplicate within a short window (same task/employee/type/time vicinity).
   * Window is short so normal HEARTBEAT cadence is not blocked.
   */
  async findNearDuplicate(
    input: {
      companyId: string
      taskId: string
      employeeId: string
      eventType: PresenceEventType
      createdAt: string
    },
    windowMs: number = PRESENCE_EVENT_IDEMPOTENCY_WINDOW_MS
  ): Promise<TaskPresenceEvent | null> {
    const createdAtMs = Date.parse(input.createdAt)
    if (!Number.isFinite(createdAtMs)) {
      return null
    }

    const fromIso = new Date(createdAtMs - windowMs).toISOString()
    const toIso = new Date(createdAtMs + windowMs).toISOString()

    const { data, error } = await this.client
      .from("task_presence_events")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("task_id", input.taskId)
      .eq("employee_id", input.employeeId)
      .eq("event_type", input.eventType)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    const row = data?.[0] as PresenceEventRow | undefined
    return row ? mapPresenceEventRow(row) : null
  }

  /**
   * Last ENTER/EXIT for zone state. HEARTBEAT is ignored by design.
   * Only events strictly before `beforeCreatedAt` so offline replay stays causal.
   */
  async findLatestBoundaryEvent(input: {
    companyId: string
    taskId: string
    employeeId: string
    beforeCreatedAt: string
  }): Promise<TaskPresenceEvent | null> {
    const { data, error } = await this.client
      .from("task_presence_events")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("task_id", input.taskId)
      .eq("employee_id", input.employeeId)
      .in("event_type", ["ENTER_RADIUS", "EXIT_RADIUS"])
      .lt("created_at", input.beforeCreatedAt)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    const row = data?.[0] as PresenceEventRow | undefined
    return row ? mapPresenceEventRow(row) : null
  }

  async insertEvent(input: {
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
  }): Promise<TaskPresenceEvent> {
    const { data, error } = await this.client
      .from("task_presence_events")
      .insert({
        company_id: input.companyId,
        task_id: input.taskId,
        employee_id: input.employeeId,
        event_type: input.eventType,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        provider: input.provider,
        device_id: input.deviceId,
        created_at: input.createdAt,
      })
      .select("*")
      .single()

    if (error) {
      throw error
    }

    return mapPresenceEventRow(data as PresenceEventRow)
  }

  async listByTask(input: {
    companyId: string
    taskId: string
    limit?: number
  }): Promise<TaskPresenceEvent[]> {
    let query = this.client
      .from("task_presence_events")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("task_id", input.taskId)
      .order("created_at", { ascending: true })

    if (input.limit != null) {
      query = query.limit(input.limit)
    }

    const { data, error } = await query
    if (error) {
      throw error
    }

    return (data ?? []).map((row) =>
      mapPresenceEventRow(row as PresenceEventRow)
    )
  }

  async listByEmployee(input: {
    companyId: string
    employeeId: string
    limit?: number
  }): Promise<TaskPresenceEvent[]> {
    let query = this.client
      .from("task_presence_events")
      .select("*")
      .eq("company_id", input.companyId)
      .eq("employee_id", input.employeeId)
      .order("created_at", { ascending: false })

    if (input.limit != null) {
      query = query.limit(input.limit)
    }

    const { data, error } = await query
    if (error) {
      throw error
    }

    return (data ?? []).map((row) =>
      mapPresenceEventRow(row as PresenceEventRow)
    )
  }
}
