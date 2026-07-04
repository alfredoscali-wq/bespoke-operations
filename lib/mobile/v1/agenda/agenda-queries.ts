import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { toLocalDateOnly } from "@/lib/dates/date-only"
import {
  FIELD_AGENT_AGENDA_QUERY_STATUSES,
  isFieldAgentAgendaTaskVisible,
} from "@/lib/mobile/v1/agenda/agenda-task-visibility"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

export async function fetchTodayAgendaTasks(
  client: SupabaseClient,
  companyId: string,
  workTeamId: string,
  workTeamName: string,
  referenceDate: string = toLocalDateOnly()
): Promise<Task[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .in("status", [...FIELD_AGENT_AGENDA_QUERY_STATUSES])
    .is("deleted_at", null)

  if (error) {
    throw error
  }

  const crewRef = { id: workTeamId, name: workTeamName }

  return (data ?? [])
    .map((row) => mapTaskRowToTask(row))
    .filter(
      (task) =>
        taskMatchesCrewId(task, crewRef) &&
        isFieldAgentAgendaTaskVisible(task, referenceDate)
    )
}
