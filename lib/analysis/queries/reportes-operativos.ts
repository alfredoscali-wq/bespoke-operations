/**
 * Lean Reportes Operativos data loaders (Sprint 16 + batch drain Sprint 17).
 * Explicit columns only — no SELECT *, no crew_members join, no per-id loops.
 */

import { createClient } from "@/lib/supabase/client"
import {
  ANALYSIS_REPORTES_CREW_SELECT,
  ANALYSIS_REPORTES_PROJECT_SELECT,
  ANALYSIS_REPORTES_TASK_SELECT,
} from "@/lib/analysis/queries/selects"
import { applyVencidaSyncFromApi } from "@/lib/tasks/vencida-sync.client"
import { normalizeTaskStatusFromDatabase } from "@/lib/tasks/task-archived-status"
import type { Project } from "@/lib/types/projects"
import type { Task, TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"

/** PostgREST default max rows — drain in pages to avoid silent truncation. */
const ANALYSIS_REPORTES_PAGE_SIZE = 1000

type TaskRow = {
  id: string
  code: string
  title: string
  status: string
  type: string
  priority: string
  due_date: string
  start_date: string
  completed_at: string | null
  closed_at: string | null
  service_type: string | null
  locality: string | null
  customer_name: string | null
  project_id: string | null
  project_code: string
  project_name: string
  crew_id: string | null
  crew: string
  supervisor: string
  estimated_duration: string
  progress: number
  created_at: string
  task_metadata: unknown
}

type ProjectRow = {
  id: string
  code: string
  name: string
  status: Project["status"]
  progress: number
  end_date: string | null
  type: Project["type"]
  client: string
  supervisor: string
  location: string
  description: string
  created_at: string
}

function parseTaskMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: "",
    projectId: row.project_id ?? undefined,
    projectCode: row.project_code,
    projectName: row.project_name,
    customerName: row.customer_name ?? undefined,
    type: row.type as TaskType,
    status: normalizeTaskStatusFromDatabase(row.status as TaskStatus),
    priority: row.priority as TaskPriority,
    supervisor: row.supervisor,
    crewId: row.crew_id ?? undefined,
    crew: row.crew,
    startDate: row.start_date,
    dueDate: row.due_date,
    estimatedDuration: row.estimated_duration,
    checklist: [],
    progress: row.progress,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    closedAt: row.closed_at,
    serviceType: row.service_type,
    locality: row.locality,
    taskMetadata: parseTaskMetadata(row.task_metadata),
  }
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    type: row.type,
    status: row.status,
    progress: row.progress,
    endDate: row.end_date ?? undefined,
    supervisor: row.supervisor,
    location: row.location,
    description: row.description,
    createdAt: row.created_at,
  }
}

async function drainPagedRows<T>(
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = []
  let from = 0

  while (true) {
    const to = from + ANALYSIS_REPORTES_PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) {
      return { data: null, error }
    }
    const page = data ?? []
    all.push(...page)
    if (page.length < ANALYSIS_REPORTES_PAGE_SIZE) {
      break
    }
    from += ANALYSIS_REPORTES_PAGE_SIZE
  }

  return { data: all, error: null }
}

export async function listAnalysisReportesTasks(companyId: string): Promise<{
  data: Task[] | null
  error: { message: string } | null
}> {
  const client = createClient()
  const drained = await drainPagedRows<TaskRow>(async (from, to) => {
    const { data, error } = await client
      .from("tasks")
      .select(ANALYSIS_REPORTES_TASK_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .range(from, to)

    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data: (data ?? []) as unknown as TaskRow[], error: null }
  })

  if (drained.error || !drained.data) {
    return { data: null, error: drained.error }
  }

  const tasks = drained.data.map(mapTaskRow)
  const synced = await applyVencidaSyncFromApi(tasks)
  return { data: synced, error: null }
}

export async function listAnalysisReportesProjects(companyId: string): Promise<{
  data: Project[] | null
  error: { message: string } | null
}> {
  const client = createClient()
  const drained = await drainPagedRows<ProjectRow>(async (from, to) => {
    const { data, error } = await client
      .from("projects")
      .select(ANALYSIS_REPORTES_PROJECT_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      return { data: null, error: { message: error.message } }
    }
    return { data: (data ?? []) as unknown as ProjectRow[], error: null }
  })

  if (drained.error || !drained.data) {
    return { data: null, error: drained.error }
  }

  return {
    data: drained.data.map(mapProjectRow),
    error: null,
  }
}

export async function listAnalysisReportesCrews(companyId: string): Promise<{
  data: { id: string; name: string }[] | null
  error: { message: string } | null
}> {
  const client = createClient()
  const drained = await drainPagedRows<{ id: string; name: string }>(
    async (from, to) => {
      const { data, error } = await client
        .from("crews")
        .select(ANALYSIS_REPORTES_CREW_SELECT)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .range(from, to)

      if (error) {
        return { data: null, error: { message: error.message } }
      }
      return {
        data: (data ?? []) as unknown as { id: string; name: string }[],
        error: null,
      }
    }
  )

  if (drained.error || !drained.data) {
    return { data: null, error: drained.error }
  }

  return {
    data: drained.data.map((row) => ({
      id: row.id,
      name: row.name,
    })),
    error: null,
  }
}
