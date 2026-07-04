import "server-only"

import { fetchIncidentTypesForServiceType } from "@/lib/mobile/v1/incidents/incident-type-queries"
import { isFieldAgentAgendaTaskVisible } from "@/lib/mobile/v1/agenda/agenda-task-visibility"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import type { MobileTaskIncidentTypesResponse } from "@/lib/mobile/v1/tasks/types"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"

export async function getMobileTaskIncidentTypes(
  auth: MobileAuthContext,
  taskId: string,
  deviceId: string
): Promise<MobileTaskIncidentTypesResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, deviceId)

  const activeShift = await fetchActiveWorkTeamShift(
    admin,
    auth.companyId,
    resolved.workTeamId
  )

  if (!activeShift) {
    throw new MobileApiError(
      "SHIFT_NOT_ACTIVE",
      "No hay jornada activa.",
      409
    )
  }

  const { data, error } = await admin
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("company_id", auth.companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const task = mapTaskRowToTask(data)
  const crewRef = {
    id: resolved.workTeamId,
    name: resolved.workTeamName,
  }

  if (
    !taskMatchesCrewId(task, crewRef) ||
    !isFieldAgentAgendaTaskVisible(task)
  ) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const items = await fetchIncidentTypesForServiceType(
    admin,
    auth.companyId,
    task.serviceType
  )

  return {
    serviceType: task.serviceType?.trim() || null,
    items,
  }
}
