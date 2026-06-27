import type {
  CrewInsert,
  CrewMemberInsert,
  CrewMemberRow,
  CrewMemberUpdate,
  CrewRow,
  CrewUpdate,
} from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
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
    members,
  }
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
