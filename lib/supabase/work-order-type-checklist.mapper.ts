import type { Database } from "@/lib/supabase/database.types"
import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"

export type WorkOrderTypeChecklistItemRow =
  Database["public"]["Tables"]["work_order_type_checklist_items"]["Row"]

export type WorkOrderTypeChecklistItemInsert =
  Database["public"]["Tables"]["work_order_type_checklist_items"]["Insert"]

export type WorkOrderTypeChecklistItemUpdate =
  Database["public"]["Tables"]["work_order_type_checklist_items"]["Update"]

export function mapChecklistItemRowToItem(
  row: WorkOrderTypeChecklistItemRow
): WorkOrderTypeChecklistItem {
  return {
    id: row.id,
    companyId: row.company_id,
    serviceType: row.service_type,
    title: row.title,
    required: row.required,
    requiresPhoto: row.requires_photo,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapChecklistItemInsert(input: {
  companyId: string
  serviceType: string
  title: string
  required: boolean
  requiresPhoto: boolean
  sortOrder: number
}): WorkOrderTypeChecklistItemInsert {
  return {
    company_id: input.companyId,
    service_type: input.serviceType,
    title: input.title.trim(),
    required: input.required,
    requires_photo: input.requiresPhoto,
    sort_order: input.sortOrder,
  }
}

export function mapChecklistItemUpdate(input: {
  title?: string
  required?: boolean
  requiresPhoto?: boolean
  sortOrder?: number | null
}): WorkOrderTypeChecklistItemUpdate {
  const update: WorkOrderTypeChecklistItemUpdate = {}

  if (input.title !== undefined) {
    update.title = input.title.trim()
  }
  if (input.required !== undefined) {
    update.required = input.required
  }
  if (input.requiresPhoto !== undefined) {
    update.requires_photo = input.requiresPhoto
  }
  if (input.sortOrder !== undefined) {
    update.sort_order = input.sortOrder
  }

  return update
}
