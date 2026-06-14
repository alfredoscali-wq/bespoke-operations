import type { TaskInsert, TaskRow, TaskUpdate } from "@/lib/supabase/database.types"
import type { ChecklistItem, Task } from "@/lib/types/tasks"
import type {
  CreateTaskPayload,
  UpdateTaskPayload,
} from "@/lib/types/supabase/tasks"

function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is ChecklistItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ChecklistItem).id === "string" &&
      typeof (item as ChecklistItem).label === "string" &&
      typeof (item as ChecklistItem).completed === "boolean" &&
      typeof (item as ChecklistItem).required === "boolean"
  )
}

export function mapTaskRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    projectId: row.project_id ?? undefined,
    projectCode: row.project_code,
    projectName: row.project_name,
    type: row.type,
    status: row.status,
    priority: row.priority,
    supervisor: row.supervisor,
    crewId: row.crew_id ?? undefined,
    crew: row.crew,
    startDate: row.start_date,
    dueDate: row.due_date,
    estimatedDuration: row.estimated_duration,
    checklist: parseChecklist(row.checklist),
    progress: row.progress,
    createdAt: row.created_at,
  }
}

export function mapCreatePayloadToInsert(payload: CreateTaskPayload): TaskInsert {
  return {
    code: payload.code.trim(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    project_id: payload.projectId ?? null,
    project_code: payload.projectCode.trim(),
    project_name: payload.projectName.trim(),
    type: payload.type,
    status: payload.status ?? "pendiente",
    priority: payload.priority ?? "media",
    supervisor: payload.supervisor.trim(),
    crew_id: payload.crewId ?? null,
    crew: payload.crew.trim(),
    start_date: payload.startDate,
    due_date: payload.dueDate,
    estimated_duration: payload.estimatedDuration.trim(),
    checklist: payload.checklist,
    progress: payload.progress ?? 0,
  }
}

export function mapUpdatePayloadToUpdate(payload: UpdateTaskPayload): TaskUpdate {
  const update: TaskUpdate = {}

  if (payload.code !== undefined) update.code = payload.code.trim()
  if (payload.title !== undefined) update.title = payload.title.trim()
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.projectId !== undefined) update.project_id = payload.projectId
  if (payload.projectCode !== undefined) {
    update.project_code = payload.projectCode.trim()
  }
  if (payload.projectName !== undefined) {
    update.project_name = payload.projectName.trim()
  }
  if (payload.type !== undefined) update.type = payload.type
  if (payload.status !== undefined) update.status = payload.status
  if (payload.priority !== undefined) update.priority = payload.priority
  if (payload.supervisor !== undefined) {
    update.supervisor = payload.supervisor.trim()
  }
  if (payload.crewId !== undefined) update.crew_id = payload.crewId
  if (payload.crew !== undefined) update.crew = payload.crew.trim()
  if (payload.startDate !== undefined) update.start_date = payload.startDate
  if (payload.dueDate !== undefined) update.due_date = payload.dueDate
  if (payload.estimatedDuration !== undefined) {
    update.estimated_duration = payload.estimatedDuration.trim()
  }
  if (payload.checklist !== undefined) update.checklist = payload.checklist
  if (payload.progress !== undefined) update.progress = payload.progress

  return update
}

export function mapTaskToUpdatePayload(task: Task): UpdateTaskPayload {
  return {
    status: task.status,
    progress: task.progress,
    checklist: task.checklist,
  }
}
