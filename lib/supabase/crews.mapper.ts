import type {
  CrewInsert,
  CrewMemberInsert,
  CrewMemberRow,
  CrewMemberUpdate,
  CrewRow,
  CrewUpdate,
} from "@/lib/supabase/database.aliases"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import { formatHabitualStartTimeForDb } from "@/lib/crews/operational-config"
import type { Crew, CrewMember } from "@/lib/types/crews"
import type {
  CreateCrewMemberPayload,
  CreateCrewPayload,
  UpdateCrewMemberPayload,
  UpdateCrewPayload,
} from "@/lib/types/supabase/crews"

export type CrewRowWithMembers = CrewRow & {
  crew_members?: CrewMemberRow[] | null
}

export function mapCrewMemberRowToMember(row: CrewMemberRow): CrewMember {
  return {
    id: row.id,
    crewId: row.crew_id,
    employeeId: row.employee_id,
    name: row.name,
    role: row.role,
    phone: row.phone ?? undefined,
    active: row.active,
  }
}

export function mapCrewRowToCrew(row: CrewRowWithMembers): Crew {
  const members = (row.crew_members ?? [])
    .filter((member) => member.deleted_at === null)
    .map(mapCrewMemberRowToMember)
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    supervisor: row.supervisor,
    supervisorEmployeeId: row.supervisor_employee_id,
    status: row.status,
    notes: row.notes,
    origin: row.origin ?? "internal",
    contractorId: row.contractor_id,
    operationalBaseName: row.operational_base_name,
    operationalBaseAddress: row.operational_base_address,
    operationalBaseLatitude: row.operational_base_latitude,
    operationalBaseLongitude: row.operational_base_longitude,
    habitualStartTime: row.habitual_start_time,
    habitualShiftMinutes: row.habitual_shift_minutes,
    members,
  }
}

function mapOperationalFieldsToDb(payload: {
  operationalBaseName?: string | null
  operationalBaseAddress?: string | null
  operationalBaseLatitude?: number | null
  operationalBaseLongitude?: number | null
  habitualStartTime?: string | null
  habitualShiftMinutes?: number | null
}): Partial<CrewInsert> {
  const update: Partial<CrewInsert> = {}

  if (payload.operationalBaseName !== undefined) {
    update.operational_base_name = payload.operationalBaseName?.trim() || null
  }
  if (payload.operationalBaseAddress !== undefined) {
    update.operational_base_address =
      payload.operationalBaseAddress?.trim() || null
  }
  if (payload.operationalBaseLatitude !== undefined) {
    update.operational_base_latitude = payload.operationalBaseLatitude
  }
  if (payload.operationalBaseLongitude !== undefined) {
    update.operational_base_longitude = payload.operationalBaseLongitude
  }
  if (payload.habitualStartTime !== undefined) {
    update.habitual_start_time = formatHabitualStartTimeForDb(
      payload.habitualStartTime
    )
  }
  if (payload.habitualShiftMinutes !== undefined) {
    update.habitual_shift_minutes =
      payload.habitualShiftMinutes == null
        ? null
        : Math.round(payload.habitualShiftMinutes)
  }

  return update
}

export function mapCreatePayloadToInsert(payload: CreateCrewPayload): CrewInsert {
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    name: payload.name.trim(),
    description: payload.description?.trim() ?? "",
    supervisor: payload.supervisor.trim(),
    supervisor_employee_id: payload.supervisorEmployeeId ?? null,
    status: payload.status ?? "activa",
    notes: payload.notes?.trim() ?? "",
    origin: payload.origin ?? "internal",
    contractor_id: payload.contractorId ?? null,
    ...mapOperationalFieldsToDb(payload),
  }
}

export function mapUpdatePayloadToUpdate(payload: UpdateCrewPayload): CrewUpdate {
  const update: CrewUpdate = {}

  if (payload.name !== undefined) update.name = payload.name.trim()
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.supervisor !== undefined) {
    update.supervisor = payload.supervisor.trim()
  }
  if (payload.supervisorEmployeeId !== undefined) {
    update.supervisor_employee_id = payload.supervisorEmployeeId
  }
  if (payload.status !== undefined) update.status = payload.status
  if (payload.notes !== undefined) update.notes = payload.notes.trim()
  if (payload.origin !== undefined) update.origin = payload.origin
  if (payload.contractorId !== undefined) {
    update.contractor_id = payload.contractorId
  }

  Object.assign(update, mapOperationalFieldsToDb(payload))

  return update
}

export function mapCreateMemberPayloadToInsert(
  payload: CreateCrewMemberPayload
): CrewMemberInsert {
  return {
    crew_id: payload.crewId,
    employee_id: payload.employeeId ?? null,
    name: payload.name.trim(),
    role: payload.role.trim(),
    phone: payload.phone?.trim() || null,
    active: payload.active ?? true,
  }
}

export function mapUpdateMemberPayloadToUpdate(
  payload: UpdateCrewMemberPayload
): CrewMemberUpdate {
  const update: CrewMemberUpdate = {}

  if (payload.employeeId !== undefined) {
    update.employee_id = payload.employeeId
  }
  if (payload.name !== undefined) update.name = payload.name.trim()
  if (payload.role !== undefined) update.role = payload.role.trim()
  if (payload.phone !== undefined) {
    update.phone = payload.phone?.trim() || null
  }
  if (payload.active !== undefined) update.active = payload.active

  return update
}
