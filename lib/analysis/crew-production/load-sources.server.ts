import "server-only"

/**
 * Server loaders for Producción de Cuadrillas — lean selects, no SELECT *.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeTaskStatusFromDatabase } from "@/lib/tasks/task-archived-status"
import type {
  CrewProductionSourceCrew,
  CrewProductionSourceTask,
} from "@/lib/analysis/crew-production/types"

export const CREW_PRODUCTION_TASK_SELECT = [
  "id",
  "code",
  "title",
  "status",
  "due_date",
  "estimated_duration",
  "customer_name",
  "project_name",
  "crew_id",
  "crew",
  "work_order_number",
  "task_metadata",
].join(", ")

export const CREW_PRODUCTION_CREW_SELECT = [
  "id",
  "name",
  "status",
  "crew_members(id, active)",
].join(", ")

type TaskRow = {
  id: string
  code: string
  title: string
  status: string
  due_date: string
  estimated_duration: string
  customer_name: string | null
  project_name: string
  crew_id: string | null
  crew: string
  work_order_number: string | null
  task_metadata: unknown
}

type CrewMemberRow = {
  id: string
  active: boolean
}

type CrewRow = {
  id: string
  name: string
  status: string
  crew_members: CrewMemberRow[] | null
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export async function loadCrewProductionTasks(input: {
  companyId: string
  date: string
}): Promise<CrewProductionSourceTask[]> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("tasks")
    .select(CREW_PRODUCTION_TASK_SELECT)
    .eq("company_id", input.companyId)
    .eq("due_date", input.date)
    .is("deleted_at", null)

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as TaskRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    status: normalizeTaskStatusFromDatabase(row.status as never),
    dueDate: row.due_date,
    estimatedDuration: row.estimated_duration ?? "",
    customerName: row.customer_name ?? undefined,
    projectName: row.project_name || undefined,
    crewId: row.crew_id ?? undefined,
    crew: row.crew ?? "",
    workOrderNumber: row.work_order_number ?? undefined,
    taskMetadata: parseMetadata(row.task_metadata),
  }))
}

export async function loadCrewProductionCrews(input: {
  companyId: string
}): Promise<CrewProductionSourceCrew[]> {
  const client = createAdminClient()
  const { data, error } = await client
    .from("crews")
    .select(CREW_PRODUCTION_CREW_SELECT)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as CrewRow[]).map((row) => {
    const members = row.crew_members ?? []
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      memberCount: members.filter((member) => member.active).length,
    }
  })
}
