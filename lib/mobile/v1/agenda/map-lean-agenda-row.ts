import type { TaskRow } from "@/lib/supabase/database.aliases"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Task } from "@/lib/types/tasks"

/**
 * Maps a lean agenda row into Task with safe defaults for omitted columns.
 */
export function mapLeanAgendaRowToTask(
  row: Partial<TaskRow> & Pick<TaskRow, "id" | "code" | "title" | "status" | "due_date">
): Task {
  const defaults: TaskRow = {
    id: row.id,
    code: row.code,
    title: row.title,
    description: "",
    project_id: null,
    project_code: "",
    project_name: "",
    customer_company: null,
    customer_name: null,
    customer_phone: null,
    customer_dni: null,
    customer_id: null,
    service_address: null,
    latitude: null,
    longitude: null,
    shared_location: "",
    location_resolution_method: null,
    observations_for_crew: "",
    work_order_number: null,
    type: row.type ?? "maintenance",
    status: row.status,
    priority: row.priority ?? "media",
    supervisor: "",
    crew_id: null,
    crew: "",
    start_date: row.due_date,
    due_date: row.due_date,
    scheduled_time: null,
    original_scheduled_date: null,
    original_scheduled_time: null,
    rescheduled_by: "",
    rescheduled_at: null,
    reschedule_reason: "",
    reschedule_notes: "",
    estimated_duration: "",
    checklist: [],
    operational_steps: [],
    progress: 0,
    created_at: "",
    completed_at: null,
    closed_at: null,
    rejection_reason: "",
    incident_reason: "",
    incident_observation: "",
    incident_reported_at: null,
    incident_reported_by: "",
    cancellation_reason: "",
    cancellation_observation: "",
    service_type: null,
    locality: null,
    contracted_plan: null,
    installation_cost: null,
    amount_to_collect: null,
    payment_method: null,
    task_metadata: {},
    execution_order: null,
    dispatch_order: null,
    company_id: "",
    updated_at: "",
    deleted_at: null,
  }

  return mapTaskRowToTask({ ...defaults, ...row })
}
