import type { Database } from "@/lib/supabase/database.types"
import type { IncidentType, IncidentTypeInput } from "@/lib/types/incident-types"

export type IncidentTypeRow = Database["public"]["Tables"]["incident_types"]["Row"]
export type IncidentTypeInsert =
  Database["public"]["Tables"]["incident_types"]["Insert"]
export type IncidentTypeUpdate =
  Database["public"]["Tables"]["incident_types"]["Update"]

export function mapIncidentTypeRowToItem(row: IncidentTypeRow): IncidentType {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    description: row.description,
    color: row.color,
    pausesWorkOrder: row.pauses_work_order,
    requiresSupervisorIntervention: row.requires_supervisor_intervention,
    notifySupervisor: row.notify_supervisor,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapIncidentTypeInsert(input: {
  companyId: string
  code: string
  sortOrder: number
  item: IncidentTypeInput
}): IncidentTypeInsert {
  return {
    company_id: input.companyId,
    code: input.code,
    name: input.item.name.trim(),
    description: input.item.description.trim(),
    color: input.item.color,
    pauses_work_order: input.item.pausesWorkOrder,
    requires_supervisor_intervention: input.item.requiresSupervisorIntervention,
    notify_supervisor: input.item.notifySupervisor,
    is_active: input.item.isActive,
    sort_order: input.sortOrder,
  }
}

export function mapIncidentTypeUpdate(
  input: Partial<IncidentTypeInput>
): IncidentTypeUpdate {
  const update: IncidentTypeUpdate = {}

  if (input.name !== undefined) {
    update.name = input.name.trim()
  }
  if (input.description !== undefined) {
    update.description = input.description.trim()
  }
  if (input.color !== undefined) {
    update.color = input.color
  }
  if (input.pausesWorkOrder !== undefined) {
    update.pauses_work_order = input.pausesWorkOrder
  }
  if (input.requiresSupervisorIntervention !== undefined) {
    update.requires_supervisor_intervention =
      input.requiresSupervisorIntervention
  }
  if (input.notifySupervisor !== undefined) {
    update.notify_supervisor = input.notifySupervisor
  }
  if (input.isActive !== undefined) {
    update.is_active = input.isActive
  }

  return update
}
