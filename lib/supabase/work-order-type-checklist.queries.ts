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
  serviceType: string
): Promise<ChecklistRepositoryResult<WorkOrderTypeChecklistItem[]>> {
  const { data, error } = await client
    .from("work_order_type_checklist_items")
    .select("*")
    .eq("company_id", companyId)
    .eq("service_type", serviceType)
    .order("sort_order", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapChecklistItemRowToItem),
    error: null,
  }
}

export async function createWorkOrderTypeChecklistItem(
  client: SupabaseChecklistClient,
  input: {
    companyId: string
    serviceType: string
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
        title: input.item.title,
        required: input.item.required,
        requiresPhoto: input.item.requiresPhoto,
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
    required?: boolean
    requiresPhoto?: boolean
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
  serviceType: string
): Promise<number> {
  const { data } = await client
    .from("work_order_type_checklist_items")
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("service_type", serviceType)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? 0) + 1
}
