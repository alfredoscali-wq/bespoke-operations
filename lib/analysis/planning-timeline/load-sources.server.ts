import "server-only"

/**
 * Lean sources for Timeline Operativo — no SELECT *, no Activity Engine.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeTaskStatusFromDatabase } from "@/lib/tasks/task-archived-status"
import type {
  PlanningTimelineSourceCrew,
  PlanningTimelineSourceTask,
} from "@/lib/analysis/planning-timeline/types"

export const PLANNING_TIMELINE_TASK_SELECT = [
  "id",
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
  "dispatch_order",
  "execution_order",
  "incident_reason",
  "incident_observation",
  "task_metadata",
].join(", ")

export const PLANNING_TIMELINE_CREW_SELECT = [
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
  const value = match?.[1]?.trim()
  return value || null
}

export async function loadPlanningTimelineCrew(input: {
  companyId: string
  crewId: string
}): Promise<PlanningTimelineSourceCrew | null> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("crews")
    .select(PLANNING_TIMELINE_CREW_SELECT)
    .eq("company_id", input.companyId)
    .eq("id", input.crewId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) return null

  const row = data as unknown as CrewRow
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
}

export async function loadPlanningTimelineTasks(input: {
  companyId: string
  date: string
  crewId: string
  crewName: string
}): Promise<PlanningTimelineSourceTask[]> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("tasks")
    .select(PLANNING_TIMELINE_TASK_SELECT)
    .eq("company_id", input.companyId)
    .eq("due_date", input.date)
    .is("deleted_at", null)

  if (error) {
    throw error
  }

  const crewNameNorm = input.crewName.trim().toLocaleLowerCase("es")

  return ((data ?? []) as unknown as TaskRow[])
    .map(
      (row): PlanningTimelineSourceTask => ({
        id: row.id,
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
        dispatchOrder: row.dispatch_order,
        executionOrder: row.execution_order,
        incidentReason: row.incident_reason,
        incidentObservation: row.incident_observation,
        taskMetadata: parseMetadata(row.task_metadata),
      })
    )
    .filter((task) => {
      if (task.crewId === input.crewId) return true
      if (
        !task.crewId &&
        task.crew.trim().toLocaleLowerCase("es") === crewNameNorm
      ) {
        return true
      }
      return false
    })
}
