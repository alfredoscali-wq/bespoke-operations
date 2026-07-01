import { createClient } from "@/lib/supabase/client"
import {
  createWorkOrderTypeChecklistItem,
  deleteWorkOrderTypeChecklistItem,
  listWorkOrderTypeChecklistItems,
  persistChecklistSortOrderUpdates,
  resolveNextChecklistSortOrder,
  updateWorkOrderTypeChecklistItem,
  type SupabaseChecklistClient,
} from "@/lib/supabase/work-order-type-checklist.queries"
import type {
  WorkOrderTypeChecklistItem,
  WorkOrderTypeChecklistItemInput,
} from "@/lib/types/work-order-type-checklist"
import type { ChecklistSortOrderUpdate } from "@/lib/work-order-types/checklist-reorder"

export function createBrowserChecklistClient(): SupabaseChecklistClient {
  return createClient()
}

export async function fetchWorkOrderTypeChecklistItems(
  companyId: string,
  serviceType: string,
  client: SupabaseChecklistClient = createBrowserChecklistClient()
) {
  return listWorkOrderTypeChecklistItems(client, companyId, serviceType)
}

export async function addWorkOrderTypeChecklistItem(
  companyId: string,
  serviceType: string,
  item: WorkOrderTypeChecklistItemInput,
  client: SupabaseChecklistClient = createBrowserChecklistClient()
): Promise<
  | { success: true; item: WorkOrderTypeChecklistItem }
  | { success: false; message: string }
> {
  const sortOrder = await resolveNextChecklistSortOrder(
    client,
    companyId,
    serviceType
  )

  const result = await createWorkOrderTypeChecklistItem(client, {
    companyId,
    serviceType,
    sortOrder,
    item,
  })

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo agregar el ítem.",
    }
  }

  return { success: true, item: result.data }
}

export async function saveWorkOrderTypeChecklistItem(
  id: string,
  input: Partial<WorkOrderTypeChecklistItemInput>,
  client: SupabaseChecklistClient = createBrowserChecklistClient()
): Promise<
  | { success: true; item: WorkOrderTypeChecklistItem }
  | { success: false; message: string }
> {
  const result = await updateWorkOrderTypeChecklistItem(client, id, input)

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo guardar el ítem.",
    }
  }

  return { success: true, item: result.data }
}

export async function removeWorkOrderTypeChecklistItem(
  id: string,
  client: SupabaseChecklistClient = createBrowserChecklistClient()
): Promise<{ success: true } | { success: false; message: string }> {
  const result = await deleteWorkOrderTypeChecklistItem(client, id)

  if (result.error) {
    return {
      success: false,
      message: result.error.message ?? "No se pudo eliminar el ítem.",
    }
  }

  return { success: true }
}

export async function saveWorkOrderTypeChecklistOrder(
  updates: ChecklistSortOrderUpdate[],
  client: SupabaseChecklistClient = createBrowserChecklistClient()
): Promise<{ success: true } | { success: false; message: string }> {
  const result = await persistChecklistSortOrderUpdates(client, updates)

  if (result.error) {
    return {
      success: false,
      message: result.error.message ?? "No se pudo reordenar el checklist.",
    }
  }

  return { success: true }
}
