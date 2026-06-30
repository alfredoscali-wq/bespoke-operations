import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { ACTIVE_TASK_STATUSES } from "@/lib/tasks/status-groups"
import type { Task } from "@/lib/types/tasks"

export async function fetchTodayAgendaTasks(
  client: SupabaseClient,
  companyId: string,
  workTeamId: string,
  workTeamName: string,
  dueDate: string
): Promise<Task[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .eq("due_date", dueDate)
    .in("status", ACTIVE_TASK_STATUSES)
    .is("deleted_at", null)

  if (error) {
    throw error
  }

  const crewRef = { id: workTeamId, name: workTeamName }

  return (data ?? [])
    .map((row) => mapTaskRowToTask(row))
    .filter((task) => taskMatchesCrewId(task, crewRef))
}
