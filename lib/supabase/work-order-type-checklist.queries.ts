import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapChecklistItemInsert,
  mapChecklistItemRowToItem,
  mapChecklistItemUpdate,
} from "@/lib/supabase/work-order-type-checklist.mapper"
import type {
  WorkOrderTypeChecklistItem,
  WorkOrderTypeChecklistItemInput,
} from "@/lib/types/work-order-type-checklist"
import type { ChecklistSortOrderUpdate } from "@/lib/work-order-types/checklist-reorder"
import {
  DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE,
  resolvePreferredChecklistTechnology,
  type ChecklistTechnologyScope,
} from "@/lib/work-order-types/checklist-technology"
import type { WorkOrderTechnology } from "@/lib/tasks/work-order"

export type SupabaseChecklistClient = SupabaseClient<Database>

export type ChecklistRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } }

function mapError(error: { message: string }): { message: string } {
  return { message: error.message }
}

export async function listWorkOrderTypeChecklistItems(
  client: SupabaseChecklistClient,
  companyId: string,
  serviceType: string,
  technology: ChecklistTechnologyScope = DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE
): Promise<ChecklistRepositoryResult<WorkOrderTypeChecklistItem[]>> {
  const { data, error } = await client
    .from("work_order_type_checklist_items")
    .select("*")
    .eq("company_id", companyId)
    .eq("service_type", serviceType)
    .eq("technology", technology)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapChecklistItemRowToItem),
    error: null,
  }
}

/**
 * Resolve checklist for OT execution:
 * exact technology → "todas" fallback → empty list.
 */
export async function resolveWorkOrderTypeChecklistItems(
  client: SupabaseChecklistClient,
  companyId: string,
  serviceType: string,
  technology?: WorkOrderTechnology | "" | null
): Promise<ChecklistRepositoryResult<WorkOrderTypeChecklistItem[]>> {
  const preferred = resolvePreferredChecklistTechnology(technology)

  if (preferred) {
    const specific = await listWorkOrderTypeChecklistItems(
      client,
      companyId,
      serviceType,
      preferred
    )

    if (specific.error) {
      return specific
    }

    if ((specific.data?.length ?? 0) > 0) {
      return specific
    }
  }

  return listWorkOrderTypeChecklistItems(
    client,
    companyId,
    serviceType,
    DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE
  )
}

export async function createWorkOrderTypeChecklistItem(
  client: SupabaseChecklistClient,
  input: {
    companyId: string
    serviceType: string
    technology: ChecklistTechnologyScope
    sortOrder: number
    item: WorkOrderTypeChecklistItemInput
  }
): Promise<ChecklistRepositoryResult<WorkOrderTypeChecklistItem>> {
  const { data, error } = await client
    .from("work_order_type_checklist_items")
    .insert(
      mapChecklistItemInsert({
        companyId: input.companyId,
        serviceType: input.serviceType,
        technology: input.technology,
        title: input.item.title,
        required: input.item.required,
        fieldType: input.item.fieldType,
        sortOrder: input.sortOrder,
      })
    )
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo crear el ítem." }),
    }
  }

  return { data: mapChecklistItemRowToItem(data), error: null }
}

export async function updateWorkOrderTypeChecklistItem(
  client: SupabaseChecklistClient,
  id: string,
  input: {
    title?: string
    fieldType?: WorkOrderTypeChecklistItemInput["fieldType"]
    required?: boolean
    sortOrder?: number | null
  }
): Promise<ChecklistRepositoryResult<WorkOrderTypeChecklistItem>> {
  const { data, error } = await client
    .from("work_order_type_checklist_items")
    .update(mapChecklistItemUpdate(input))
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    return {
      data: null,
      error: mapError(error ?? { message: "No se pudo actualizar el ítem." }),
    }
  }

  return { data: mapChecklistItemRowToItem(data), error: null }
}

export async function deleteWorkOrderTypeChecklistItem(
  client: SupabaseChecklistClient,
  id: string
): Promise<ChecklistRepositoryResult<true>> {
  const { error } = await client
    .from("work_order_type_checklist_items")
    .delete()
    .eq("id", id)

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: true, error: null }
}

export async function persistChecklistSortOrderUpdates(
  client: SupabaseChecklistClient,
  updates: ChecklistSortOrderUpdate[]
): Promise<ChecklistRepositoryResult<true>> {
  for (const update of updates) {
    const result = await updateWorkOrderTypeChecklistItem(client, update.id, {
      sortOrder: update.sortOrder,
    })

    if (result.error) {
      return { data: null, error: result.error }
    }
  }

  return { data: true, error: null }
}

export async function resolveNextChecklistSortOrder(
  client: SupabaseChecklistClient,
  companyId: string,
  serviceType: string,
  technology: ChecklistTechnologyScope = DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE
): Promise<number> {
  const { data } = await client
    .from("work_order_type_checklist_items")
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("service_type", serviceType)
    .eq("technology", technology)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? 0) + 1
}
