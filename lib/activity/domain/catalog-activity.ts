import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"

export function recordCatalogCreatedActivity(input: {
  catalog: string
  entityId: string
  metadata?: Record<string, unknown>
}): void {
  emitActivityClient({
    module: "settings",
    entityType: input.catalog,
    entityId: input.entityId,
    action: ACTIVITY_EVENT_ACTIONS.CATALOG_CREATED,
    metadata: {
      catalog: input.catalog,
      ...(input.metadata ?? {}),
    },
  })
}

export function recordCatalogUpdatedActivity(input: {
  catalog: string
  entityId: string
  metadata?: Record<string, unknown>
}): void {
  emitActivityClient({
    module: "settings",
    entityType: input.catalog,
    entityId: input.entityId,
    action: ACTIVITY_EVENT_ACTIONS.CATALOG_UPDATED,
    metadata: {
      catalog: input.catalog,
      ...(input.metadata ?? {}),
    },
  })
}

export function recordCatalogDeletedActivity(input: {
  catalog: string
  entityId: string
  metadata?: Record<string, unknown>
}): void {
  emitActivityClient({
    module: "settings",
    entityType: input.catalog,
    entityId: input.entityId,
    action: ACTIVITY_EVENT_ACTIONS.CATALOG_DELETED,
    metadata: {
      catalog: input.catalog,
      ...(input.metadata ?? {}),
    },
  })
}
