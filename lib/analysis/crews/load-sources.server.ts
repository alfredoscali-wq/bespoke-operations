import "server-only"

/**
 * Lean sources for CUADRILLAS — reuses production/timeline field needs.
 * No SELECT *, no Activity Engine.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeTaskStatusFromDatabase } from "@/lib/tasks/task-archived-status"
import type { PlanningTimelineSourceCrew } from "@/lib/analysis/planning-timeline/types"
import type { CrewsSourceTask } from "@/lib/analysis/crews/source-mappers"

export type { CrewsSourceTask } from "@/lib/analysis/crews/source-mappers"

export const CREWS_TASK_SELECT = [
  "id",
  "code",
  "title",
  "status",
  "due_date",
  "estimated_duration",
  "scheduled_time",
  "customer_name",
  "customer_id",
  "service_type",
  "service_address",
  "locality",
  "crew_id",
  "crew",
  "work_order_number",
  "dispatch_order",
  "execution_order",
  "incident_reason",
  "incident_observation",
  "task_metadata",
].join(", ")

export const CREWS_CREW_SELECT = [
  "id",
  "name",
  "status",
  "habitual_start_time",
  "operational_base_name",
  "notes",
  "crew_members(id, name, role, active, deleted_at)",
].join(", ")

type TaskRow = {
  id: string
  code: string
  title: string
  status: string
  due_date: string
  estimated_duration: string
  scheduled_time: string | null
  customer_name: string | null
  customer_id: string | null
  service_type: string | null
  service_address: string | null
  locality: string | null
  crew_id: string | null
  crew: string
  work_order_number: string | null
  dispatch_order: number | null
  execution_order: number | null
  incident_reason: string | null
  incident_observation: string | null
  task_metadata: unknown
}

type MemberRow = {
  id: string
  name: string
  role: string
  active: boolean
  deleted_at: string | null
}

type CrewRow = {
  id: string
  name: string
  status: string
  habitual_start_time: string | null
  operational_base_name: string | null
  notes: string | null
  crew_members: MemberRow[] | null
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function extractVehicleLabel(notes: string | null | undefined): string | null {
  const text = notes?.trim()
  if (!text) return null
  const match = text.match(
    /(?:veh[ií]culo|patente|unidad)\s*[:\-]?\s*([^\n,;]+)/i
  )
  return match?.[1]?.trim() || null
}

export async function loadCrewsScreenCrews(input: {
  companyId: string
}): Promise<PlanningTimelineSourceCrew[]> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("crews")
    .select(CREWS_CREW_SELECT)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as CrewRow[]).map((row) => {
    const members = (row.crew_members ?? [])
      .filter((member) => member.deleted_at == null)
      .map((member) => ({
        name: member.name,
        role: member.role,
        active: member.active,
      }))

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      habitualStartTime: row.habitual_start_time,
      operationalBaseName: row.operational_base_name,
      vehicleLabel: extractVehicleLabel(row.notes),
      members,
    }
  })
}

export async function loadCrewsScreenTasks(input: {
  companyId: string
  dateFrom: string
  dateTo: string
}): Promise<CrewsSourceTask[]> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("tasks")
    .select(CREWS_TASK_SELECT)
    .eq("company_id", input.companyId)
    .gte("due_date", input.dateFrom)
    .lte("due_date", input.dateTo)
    .is("deleted_at", null)

  if (error) throw error

  return ((data ?? []) as unknown as TaskRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    status: normalizeTaskStatusFromDatabase(row.status as never),
    dueDate: row.due_date,
    estimatedDuration: row.estimated_duration ?? "",
    scheduledTime: row.scheduled_time,
    customerName: row.customer_name,
    customerId: row.customer_id,
    serviceType: row.service_type,
    serviceAddress: row.service_address,
    locality: row.locality,
    crewId: row.crew_id,
    crew: row.crew ?? "",
    workOrderNumber: row.work_order_number ?? undefined,
    dispatchOrder: row.dispatch_order,
    executionOrder: row.execution_order,
    incidentReason: row.incident_reason,
    incidentObservation: row.incident_observation,
    taskMetadata: parseMetadata(row.task_metadata),
  }))
}
