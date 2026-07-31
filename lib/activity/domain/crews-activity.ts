import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"
import type { Crew, CrewMember } from "@/lib/types/crews"
import type { UpdateCrewPayload } from "@/lib/types/supabase/crews"

const MODULE = "crews"
const ENTITY_TYPE = "crew"

export function recordCrewCreatedActivity(crew: Crew): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: crew.id,
    action: ACTIVITY_EVENT_ACTIONS.CREW_CREATED,
    metadata: {
      status: crew.status,
      supervisorEmployeeId: crew.supervisorEmployeeId ?? null,
    },
  })
}

export function recordCrewUpdatedActivity(
  before: Crew,
  payload: UpdateCrewPayload,
  after: Crew
): void {
  if (
    payload.supervisorEmployeeId !== undefined &&
    before.supervisorEmployeeId !== after.supervisorEmployeeId
  ) {
    emitActivityClient({
      module: MODULE,
      entityType: ENTITY_TYPE,
      entityId: after.id,
      action: ACTIVITY_EVENT_ACTIONS.CREW_SUPERVISOR_CHANGED,
      metadata: {
        oldSupervisorEmployeeId: before.supervisorEmployeeId ?? null,
        newSupervisorEmployeeId: after.supervisorEmployeeId ?? null,
      },
    })
  }

  const changedFields = Object.keys(payload).filter(
    (key) => payload[key as keyof UpdateCrewPayload] !== undefined
  )
  if (changedFields.length === 0) return

  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: after.id,
    action: ACTIVITY_EVENT_ACTIONS.CREW_UPDATED,
    metadata: { changedFields },
  })
}

export function recordCrewDeletedActivity(crew: Pick<Crew, "id" | "status">): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: crew.id,
    action: ACTIVITY_EVENT_ACTIONS.CREW_DELETED,
    metadata: {
      oldStatus: crew.status,
    },
  })
}

export function recordCrewMemberAssignedActivity(input: {
  crew: Pick<Crew, "id">
  member: CrewMember
  operation: "add" | "remove"
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.crew.id,
    action: ACTIVITY_EVENT_ACTIONS.CREW_MEMBER_ASSIGNED,
    metadata: {
      operation: input.operation,
      memberId: input.member.id,
      employeeId: input.member.employeeId ?? null,
      role: input.member.role,
    },
  })

  if (input.member.employeeId) {
    emitActivityClient({
      module: "rrhh",
      entityType: "employee",
      entityId: input.member.employeeId,
      action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_CREW_CHANGED,
      metadata: {
        operation: input.operation,
        crewId: input.crew.id,
        memberId: input.member.id,
      },
    })
  }
}
