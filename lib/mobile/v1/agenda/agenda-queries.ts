import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { toLocalDateOnly } from "@/lib/dates/date-only"
import {
  getCachedAgendaTasks,
  setCachedAgendaTasks,
} from "@/lib/mobile/session/agenda-task-cache"
import {
  FIELD_AGENT_AGENDA_QUERY_STATUSES,
  isFieldAgentAgendaTaskVisible,
} from "@/lib/mobile/v1/agenda/agenda-task-visibility"
import { MOBILE_AGENDA_TASK_SELECT } from "@/lib/mobile/v1/agenda/agenda-task-select"
import { mapLeanAgendaRowToTask } from "@/lib/mobile/v1/agenda/map-lean-agenda-row"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/**
 * Fetches today's agenda tasks for a work team.
 * Uses lean SELECT + crew-scoped filter. Results cached for session staleTime
 * so agenda/today and OT detail (nextWork) share one download.
 */
export async function fetchTodayAgendaTasks(
  client: SupabaseClient,
  companyId: string,
  workTeamId: string,
  workTeamName: string,
  referenceDate: string = toLocalDateOnly()
): Promise<Task[]> {
  const cached = getCachedAgendaTasks(companyId, workTeamId, referenceDate)
  if (cached) {
    return cached
  }

  const crewNameFilter = escapePostgrestValue(workTeamName.trim())
  const orFilter = `crew_id.eq.${workTeamId},and(crew_id.is.null,crew.eq.${crewNameFilter})`

  const { data, error } = await client
    .from("tasks")
    .select(MOBILE_AGENDA_TASK_SELECT)
    .eq("company_id", companyId)
    .in("status", [...FIELD_AGENT_AGENDA_QUERY_STATUSES])
    .is("deleted_at", null)
    .or(orFilter)

  if (error) {
    throw error
  }

  const crewRef = { id: workTeamId, name: workTeamName }

  const tasks = (data ?? [])
    .map((row) =>
      mapLeanAgendaRowToTask(
        row as unknown as Parameters<typeof mapLeanAgendaRowToTask>[0]
      )
    )
    .filter(
      (task) =>
        taskMatchesCrewId(task, crewRef) &&
        isFieldAgentAgendaTaskVisible(task, referenceDate)
    )

  setCachedAgendaTasks(companyId, workTeamId, referenceDate, tasks)
  return tasks
}
