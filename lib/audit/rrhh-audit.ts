import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import {
  buildAuditChangeMetadata,
  buildAuditFieldChanges,
} from "@/lib/audit/metadata-changes"
import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import { AVAILABILITY_TYPE_LABELS } from "@/lib/availability/constants"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { UpdateCrewPayload } from "@/lib/types/supabase/crews"
import type {
  CreateEmployeeAvailabilityInput,
  EmployeeAvailability,
  UpdateEmployeeAvailabilityInput,
} from "@/lib/types/availability"
import type { Crew, CrewMember, CrewStatus } from "@/lib/types/crews"
import type {
  Employee,
  EmploymentStatus,
  UpdateEmployeeInput,
} from "@/lib/types/employees"
import { USER_ACCOUNT_FIELDS } from "@/lib/audit/users-audit"

export function resolveEmployeeEntityLabel(
  employee: Pick<Employee, "employeeCode" | "firstName" | "lastName" | "id">
) {
  const displayName = getEmployeeDisplayName(employee)
  return employee.employeeCode?.trim() || displayName || employee.id
}

export function resolveCrewEntityLabel(crew: Pick<Crew, "name" | "id">) {
  return crew.name?.trim() || crew.id
}

export function buildEmploymentStatusMetadata(
  before: Pick<Employee, "employmentStatus">,
  after: Pick<Employee, "employmentStatus">
) {
  return {
    estado_anterior: before.employmentStatus,
    estado_nuevo: after.employmentStatus,
  }
}

export function buildCrewStatusMetadata(
  before: Pick<Crew, "status">,
  after: Pick<Crew, "status">
) {
  return {
    estado_anterior: before.status,
    estado_nuevo: after.status,
  }
}

const EMPLOYEE_UPDATE_FIELD_LABELS: Partial<Record<keyof UpdateEmployeeInput, string>> =
  {
    employeeCode: "employeeCode",
    firstName: "firstName",
    lastName: "lastName",
    preferredName: "preferredName",
    nationalId: "nationalId",
    birthDate: "birthDate",
    email: "email",
    phone: "phone",
    jobTitle: "jobTitle",
    department: "department",
    employeeType: "employeeType",
    employmentStatus: "employmentStatus",
    hireDate: "hireDate",
    terminationDate: "terminationDate",
    notes: "notes",
  }

const EMPLOYEE_UPDATE_AUDIT_FIELDS = Object.keys(
  EMPLOYEE_UPDATE_FIELD_LABELS
) as (keyof UpdateEmployeeInput)[]

const EMPLOYEE_STATUS_ONLY_FIELDS = new Set<keyof UpdateEmployeeInput>([
  "employmentStatus",
  "terminationDate",
])

const CREW_UPDATE_FIELD_LABELS: Partial<Record<keyof UpdateCrewPayload, string>> =
  {
    name: "name",
    description: "description",
    supervisor: "supervisor",
    supervisorEmployeeId: "supervisorEmployeeId",
    notes: "notes",
  }

const CREW_UPDATE_AUDIT_FIELDS = Object.keys(
  CREW_UPDATE_FIELD_LABELS
) as (keyof UpdateCrewPayload)[]

function buildEmployeeUpdateChangeMetadata(
  before: Employee,
  input: UpdateEmployeeInput
) {
  const fields = EMPLOYEE_UPDATE_AUDIT_FIELDS.filter(
    (field) => input[field] !== undefined
  )

  const changes = buildAuditFieldChanges({
    before,
    updates: input as Partial<Record<keyof Employee, unknown>>,
    fields: fields as (keyof Employee)[],
    labels: EMPLOYEE_UPDATE_FIELD_LABELS as Partial<Record<keyof Employee, string>>,
  })

  return buildAuditChangeMetadata(changes)
}

function buildCrewUpdateChangeMetadata(before: Crew, payload: UpdateCrewPayload) {
  const fields = CREW_UPDATE_AUDIT_FIELDS.filter(
    (field) => payload[field] !== undefined
  )

  const changes = buildAuditFieldChanges({
    before,
    updates: payload as Partial<Record<keyof Crew, unknown>>,
    fields: fields as (keyof Crew)[],
    labels: CREW_UPDATE_FIELD_LABELS as Partial<Record<keyof Crew, string>>,
  })

  return buildAuditChangeMetadata(changes)
}

function recordEmployeeAuditEvent(input: {
  action:
    | typeof AUDIT_ACTIONS.EMPLOYEE_CREATE
    | typeof AUDIT_ACTIONS.EMPLOYEE_UPDATE
    | typeof AUDIT_ACTIONS.EMPLOYEE_DEACTIVATE
    | typeof AUDIT_ACTIONS.EMPLOYEE_REACTIVATE
  employee: Pick<Employee, "id" | "employeeCode" | "firstName" | "lastName">
  metadata?: Record<string, unknown>
}) {
  const entityLabel = resolveEmployeeEntityLabel(input.employee)

  void recordAuditEventClient({
    module: AUDIT_MODULES.RRHH,
    action: input.action,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: input.employee.id,
    entityLabel,
    description: buildAuditDescription({
      action: input.action,
      entityLabel,
    }),
    metadata: input.metadata,
  })
}

function recordCrewAuditEvent(input: {
  action:
    | typeof AUDIT_ACTIONS.CREW_CREATE
    | typeof AUDIT_ACTIONS.CREW_UPDATE
    | typeof AUDIT_ACTIONS.CREW_ARCHIVE
    | typeof AUDIT_ACTIONS.CREW_MEMBER_ADD
    | typeof AUDIT_ACTIONS.CREW_MEMBER_REMOVE
  crew: Pick<Crew, "id" | "name">
  metadata?: Record<string, unknown>
}) {
  const entityLabel = resolveCrewEntityLabel(input.crew)

  void recordAuditEventClient({
    module: AUDIT_MODULES.RRHH,
    action: input.action,
    entityType: AUDIT_ENTITY_TYPES.CREW,
    entityId: input.crew.id,
    entityLabel,
    description: buildAuditDescription({
      action: input.action,
      entityLabel,
    }),
    metadata: input.metadata,
  })
}

export function isEmployeeDeactivation(before: Employee, after: Employee): boolean {
  return before.employmentStatus !== "inactive" && after.employmentStatus === "inactive"
}

export function isEmployeeReactivation(before: Employee, after: Employee): boolean {
  return before.employmentStatus === "inactive" && after.employmentStatus !== "inactive"
}

export function recordEmployeeCreateAudit(employee: Employee) {
  recordEmployeeAuditEvent({
    action: AUDIT_ACTIONS.EMPLOYEE_CREATE,
    employee,
    metadata: {
      employeeCode: employee.employeeCode,
      employmentStatus: employee.employmentStatus,
      employeeType: employee.employeeType,
    },
  })
}

export function recordEmployeeDeactivateAudit(
  before: Employee,
  after: Employee,
  input: UpdateEmployeeInput
) {
  recordEmployeeAuditEvent({
    action: AUDIT_ACTIONS.EMPLOYEE_DEACTIVATE,
    employee: before,
    metadata: {
      ...buildEmploymentStatusMetadata(before, after),
      motivo: input.notes?.trim() || after.notes?.trim() || null,
      terminationDate: after.terminationDate ?? null,
    },
  })
}

export function recordEmployeeReactivateAudit(
  before: Employee,
  after: Employee
) {
  recordEmployeeAuditEvent({
    action: AUDIT_ACTIONS.EMPLOYEE_REACTIVATE,
    employee: before,
    metadata: buildEmploymentStatusMetadata(before, after),
  })
}

export function recordEmployeeUpdateAudit(
  before: Employee,
  input: UpdateEmployeeInput,
  after: Employee
) {
  const filteredInput = Object.fromEntries(
    Object.entries(input).filter(
      ([key]) =>
        !EMPLOYEE_STATUS_ONLY_FIELDS.has(key as keyof UpdateEmployeeInput) &&
        !USER_ACCOUNT_FIELDS.has(key as keyof UpdateEmployeeInput)
    )
  ) as UpdateEmployeeInput

  const changeMetadata = buildEmployeeUpdateChangeMetadata(before, filteredInput)
  const metadata: Record<string, unknown> = { ...changeMetadata }

  if (
    input.employmentStatus !== undefined &&
    before.employmentStatus !== after.employmentStatus
  ) {
    Object.assign(metadata, buildEmploymentStatusMetadata(before, after))
  }

  if (changeMetadata.changedFields.length === 0 && !metadata.estado_anterior) {
    return
  }

  recordEmployeeAuditEvent({
    action: AUDIT_ACTIONS.EMPLOYEE_UPDATE,
    employee: before,
    metadata,
  })
}

export function recordEmployeeEditAudit(
  before: Employee,
  input: UpdateEmployeeInput,
  after: Employee
) {
  if (isEmployeeDeactivation(before, after)) {
    recordEmployeeDeactivateAudit(before, after, input)
    return
  }

  if (isEmployeeReactivation(before, after)) {
    recordEmployeeReactivateAudit(before, after)
    return
  }

  recordEmployeeUpdateAudit(before, input, after)
}

export function isCrewAuditableFieldUpdate(payload: UpdateCrewPayload): boolean {
  return CREW_UPDATE_AUDIT_FIELDS.some((field) => payload[field] !== undefined)
}

export function recordCrewCreateAudit(crew: Crew) {
  recordCrewAuditEvent({
    action: AUDIT_ACTIONS.CREW_CREATE,
    crew,
    metadata: {
      status: crew.status,
      supervisor: crew.supervisor,
      supervisorEmployeeId: crew.supervisorEmployeeId ?? null,
    },
  })
}

export function recordCrewUpdateAudit(
  before: Crew,
  payload: UpdateCrewPayload,
  after: Crew
) {
  const changeMetadata = buildCrewUpdateChangeMetadata(before, payload)
  const metadata: Record<string, unknown> = { ...changeMetadata }

  if (payload.status !== undefined && before.status !== after.status) {
    Object.assign(metadata, buildCrewStatusMetadata(before, after))
  }

  if (changeMetadata.changedFields.length === 0 && !metadata.estado_anterior) {
    return
  }

  recordCrewAuditEvent({
    action: AUDIT_ACTIONS.CREW_UPDATE,
    crew: before,
    metadata,
  })
}

export function recordCrewArchiveAudit(
  crew: Pick<Crew, "id" | "name" | "status">
) {
  recordCrewAuditEvent({
    action: AUDIT_ACTIONS.CREW_ARCHIVE,
    crew,
    metadata: {
      archivedAt: new Date().toISOString(),
      status: crew.status,
    },
  })
}

export function recordCrewMemberAddAudit(input: {
  crew: Pick<Crew, "id" | "name">
  member: CrewMember
}) {
  recordCrewAuditEvent({
    action: AUDIT_ACTIONS.CREW_MEMBER_ADD,
    crew: input.crew,
    metadata: {
      memberId: input.member.id,
      memberName: input.member.name,
      employeeId: input.member.employeeId ?? null,
      role: input.member.role,
    },
  })
}

export function recordCrewMemberRemoveAudit(input: {
  crew: Pick<Crew, "id" | "name">
  member: CrewMember
}) {
  recordCrewAuditEvent({
    action: AUDIT_ACTIONS.CREW_MEMBER_REMOVE,
    crew: input.crew,
    metadata: {
      memberId: input.member.id,
      memberName: input.member.name,
      employeeId: input.member.employeeId ?? null,
      role: input.member.role,
    },
  })
}

export type AvailabilityAuditOperation = "create" | "update" | "remove"

export function recordAvailabilityChangeAudit(input: {
  operation: AvailabilityAuditOperation
  employee: Pick<Employee, "id" | "employeeCode" | "firstName" | "lastName">
  before?: EmployeeAvailability
  after?: EmployeeAvailability
  payload?: CreateEmployeeAvailabilityInput | UpdateEmployeeAvailabilityInput
}) {
  const entityLabel = resolveEmployeeEntityLabel(input.employee)
  const record = input.after ?? input.before

  const metadata: Record<string, unknown> = {
    operation: input.operation,
  }

  if (record) {
    metadata.availabilityId = record.id
    metadata.availabilityType = record.availabilityType
    metadata.availabilityTypeLabel =
      AVAILABILITY_TYPE_LABELS[record.availabilityType]
    metadata.startDate = record.startDate
    metadata.endDate = record.endDate
    metadata.motivo = record.reason?.trim() || null
  }

  if (input.payload?.reason?.trim()) {
    metadata.motivo = input.payload.reason.trim()
  }

  if (input.before && input.after) {
    const changes = buildAuditFieldChanges({
      before: input.before,
      updates: input.payload ?? {},
      fields: ["startDate", "endDate", "availabilityType", "reason"] as const,
      labels: {
        startDate: "startDate",
        endDate: "endDate",
        availabilityType: "availabilityType",
        reason: "reason",
      },
    })

    Object.assign(metadata, buildAuditChangeMetadata(changes))
  }

  void recordAuditEventClient({
    module: AUDIT_MODULES.RRHH,
    action: AUDIT_ACTIONS.AVAILABILITY_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
    entityId: input.employee.id,
    entityLabel,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.AVAILABILITY_CHANGE,
      entityLabel,
    }),
    metadata,
  })
}

export function buildCrewStatusTransitionMetadata(
  previousStatus: CrewStatus,
  nextStatus: CrewStatus
) {
  return buildCrewStatusMetadata(
    { status: previousStatus },
    { status: nextStatus }
  )
}

export function buildEmploymentStatusTransitionMetadata(
  previousStatus: EmploymentStatus,
  nextStatus: EmploymentStatus
) {
  return buildEmploymentStatusMetadata(
    { employmentStatus: previousStatus },
    { employmentStatus: nextStatus }
  )
}
