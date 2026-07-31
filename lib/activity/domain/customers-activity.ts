import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { emitActivityClient } from "@/lib/activity/emit-activity.client"
import type { Customer, UpdateCustomerInput } from "@/lib/types/customers"

const MODULE = "customers"
const ENTITY_TYPE = "customer"

export function recordCustomerCreatedActivity(customer: Customer): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: customer.id,
    action: ACTIVITY_EVENT_ACTIONS.CUSTOMER_CREATED,
    metadata: {
      status: customer.status,
      validationStatus: customer.validationStatus,
    },
  })
}

export function recordCustomerUpdatedActivity(
  before: Customer,
  input: UpdateCustomerInput,
  after?: Customer
): void {
  const next = after ?? before
  const changedFields = Object.keys(input).filter(
    (key) => input[key as keyof UpdateCustomerInput] !== undefined
  )
  if (changedFields.length === 0) return

  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: next.id,
    action: ACTIVITY_EVENT_ACTIONS.CUSTOMER_UPDATED,
    metadata: {
      changedFields,
      oldStatus: before.status,
      newStatus: next.status,
    },
  })
}

export function recordCustomerTagChangedActivity(input: {
  customerId: string
  oldEtiquetaId: string | null
  newEtiquetaId: string | null
}): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: input.customerId,
    action: ACTIVITY_EVENT_ACTIONS.CUSTOMER_TAG_CHANGED,
    metadata: {
      oldEtiquetaId: input.oldEtiquetaId,
      newEtiquetaId: input.newEtiquetaId,
    },
  })
}

export function recordCustomerArchivedActivity(customer: Customer): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: customer.id,
    action: ACTIVITY_EVENT_ACTIONS.CUSTOMER_ARCHIVED,
    metadata: {
      oldStatus: customer.status,
      newStatus: "archived",
    },
  })
}

export function recordCustomerReactivatedActivity(
  before: Customer,
  after: Customer
): void {
  emitActivityClient({
    module: MODULE,
    entityType: ENTITY_TYPE,
    entityId: after.id,
    action: ACTIVITY_EVENT_ACTIONS.CUSTOMER_REACTIVATED,
    metadata: {
      oldStatus: before.status,
      newStatus: after.status,
    },
  })
}
