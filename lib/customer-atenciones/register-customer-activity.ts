import "server-only"

import { activity } from "@/lib/activity-engine/activity-engine"
import type { ActivityEngineRecordResult } from "@/lib/activity-engine/activity-types"
import {
  CUSTOMER_ACTIVITY_DEFAULTS,
  CUSTOMER_SERVICE_ACTIVITY_ENTITY_TYPE,
  CUSTOMER_SERVICE_ACTIVITY_MODULE,
  type RegisterCustomerActivityInput,
} from "@/lib/customer-atenciones/register-customer-activity.types"

export type { RegisterCustomerActivityInput } from "@/lib/customer-atenciones/register-customer-activity.types"
export {
  CUSTOMER_SERVICE_ACTIVITY_ENTITY_TYPE,
  CUSTOMER_SERVICE_ACTIVITY_MODULE,
} from "@/lib/customer-atenciones/register-customer-activity.types"

/**
 * Customer Service → Activity Engine bridge.
 * Prepares the payload and always ends in `activity.record()`.
 * Never inserts into activity_events or calls RPCs directly.
 */
export async function registerCustomerActivity(
  input: RegisterCustomerActivityInput
): Promise<ActivityEngineRecordResult> {
  return activity.record({
    companyId: input.companyId,
    module: CUSTOMER_SERVICE_ACTIVITY_MODULE,
    entityType: CUSTOMER_SERVICE_ACTIVITY_ENTITY_TYPE,
    entityId: input.entityId,
    employeeId: input.employeeId ?? null,
    action: input.action,
    category: input.category ?? CUSTOMER_ACTIVITY_DEFAULTS.category,
    impact: input.impact ?? CUSTOMER_ACTIVITY_DEFAULTS.impact,
    origin: input.origin ?? CUSTOMER_ACTIVITY_DEFAULTS.origin,
    title: input.title,
    description: input.description,
    metadata: input.metadata ?? {},
  })
}

/** Best-effort wrapper — never throws into domain flows. */
export async function registerCustomerActivitySafe(
  input: RegisterCustomerActivityInput
): Promise<void> {
  try {
    const result = await registerCustomerActivity(input)
    if (!result.ok) {
      console.warn("[customer-service/activity] registro omitido", {
        action: input.action,
        entityId: input.entityId,
        error: result.error,
      })
    }
  } catch (error) {
    console.warn("[customer-service/activity] error al registrar", {
      action: input.action,
      entityId: input.entityId,
      error,
    })
  }
}
