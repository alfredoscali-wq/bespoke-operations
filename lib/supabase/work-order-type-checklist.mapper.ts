import type { Database } from "@/lib/supabase/database.types"
import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"
import type { ChecklistFieldType } from "@/lib/work-order-types/checklist-field-types"
import { isChecklistFieldType } from "@/lib/work-order-types/checklist-field-types"
import {
  normalizeChecklistTechnologyScope,
  type ChecklistTechnologyScope,
} from "@/lib/work-order-types/checklist-technology"

export type WorkOrderTypeChecklistItemRow =
  Database["public"]["Tables"]["work_order_type_checklist_items"]["Row"]

export type WorkOrderTypeChecklistItemInsert =
  Database["public"]["Tables"]["work_order_type_checklist_items"]["Insert"]

export type WorkOrderTypeChecklistItemUpdate =
  Database["public"]["Tables"]["work_order_type_checklist_items"]["Update"]

function mapFieldType(value: string): ChecklistFieldType {
  return isChecklistFieldType(value) ? value : "confirmacion"
}

export function mapChecklistItemRowToItem(
  row: WorkOrderTypeChecklistItemRow
): WorkOrderTypeChecklistItem {
  return {
    id: row.id,
    companyId: row.company_id,
    serviceType: row.service_type,
    technology: normalizeChecklistTechnologyScope(row.technology),
    title: row.title,
    fieldType: mapFieldType(row.field_type),
    required: row.required,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapChecklistItemInsert(input: {
  companyId: string
  serviceType: string
  technology: ChecklistTechnologyScope
  title: string
  fieldType: ChecklistFieldType
  required: boolean
  sortOrder: number
}): WorkOrderTypeChecklistItemInsert {
  return {
    company_id: input.companyId,
    service_type: input.serviceType,
    technology: input.technology,
    title: input.title.trim(),
    field_type: input.fieldType,
    required: input.required,
    sort_order: input.sortOrder,
  }
}

export function mapChecklistItemUpdate(input: {
  title?: string
  fieldType?: ChecklistFieldType
  required?: boolean
  sortOrder?: number | null
}): WorkOrderTypeChecklistItemUpdate {
  const update: WorkOrderTypeChecklistItemUpdate = {}

  if (input.title !== undefined) {
    update.title = input.title.trim()
  }
  if (input.fieldType !== undefined) {
    update.field_type = input.fieldType
  }
  if (input.required !== undefined) {
    update.required = input.required
  }
  if (input.sortOrder !== undefined) {
    update.sort_order = input.sortOrder
  }

  return update
}
