import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"
import type { Employee, UpdateEmployeeInput } from "@/lib/types/employees"

const MODULE = "rrhh"
const ENTITY_TYPE = "employee"

function isReactivation(before: Employee, after: Employee): boolean {
  return (
    before.employmentStatus === "inactive" &&
    after.employmentStatus !== "inactive"
  )
}

export function recordEmployeeCreatedActivity(employee: Employee): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: employee.id,
    action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_CREATED,
    metadata: {
      employmentStatus: employee.employmentStatus,
      roleId: employee.roleId ?? null,
    },
  })
}

export function recordEmployeeDeletedActivity(employee: Employee): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: employee.id,
    action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_DELETED,
    metadata: {
      oldStatus: employee.employmentStatus,
      newStatus: "inactive",
    },
  })
}

export function recordEmployeeEditedActivity(
  before: Employee,
  input: UpdateEmployeeInput,
  after: Employee
): void {
  if (isReactivation(before, after)) {
    emitActivityClient({
      module: MODULE,
      entityType: ENTITY_TYPE,
      entityId: after.id,
      action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_REACTIVATED,
      metadata: {
        oldStatus: before.employmentStatus,
        newStatus: after.employmentStatus,
      },
    })
    return
  }

  if (
    (input.roleId !== undefined && before.roleId !== after.roleId) ||
    (input.systemRole !== undefined && before.systemRole !== after.systemRole)
  ) {
    emitActivityClient({
      module: MODULE,
      entityType: ENTITY_TYPE,
      entityId: after.id,
      action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_ROLE_CHANGED,
      metadata: {
        oldRoleId: before.roleId ?? null,
        newRoleId: after.roleId ?? null,
        oldSystemRole: before.systemRole ?? null,
        newSystemRole: after.systemRole ?? null,
      },
    })
  }

  if (
    input.employmentStatus !== undefined &&
    before.employmentStatus !== after.employmentStatus
  ) {
    emitActivityClient({
      module: MODULE,
      entityType: ENTITY_TYPE,
      entityId: after.id,
      action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_UPDATED,
      metadata: {
        oldStatus: before.employmentStatus,
        newStatus: after.employmentStatus,
      },
    })
    return
  }

  const changedKeys = Object.keys(input).filter(
    (key) => input[key as keyof UpdateEmployeeInput] !== undefined
  )
  if (changedKeys.length === 0) return

  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: after.id,
    action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_UPDATED,
    metadata: {
      changedFields: changedKeys,
    },
  })
}

export function recordEmployeeAvailabilityChangedActivity(input: {
  employeeId: string
  operation: "create" | "update" | "delete"
  availabilityId?: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.employeeId,
    action: ACTIVITY_EVENT_ACTIONS.EMPLOYEE_AVAILABILITY_CHANGED,
    metadata: {
      operation: input.operation,
      availabilityId: input.availabilityId ?? null,
    },
  })
}
