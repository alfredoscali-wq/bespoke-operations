/**
 * Browser bridge for Customer Service → Activity Engine.
 * Posts prepared payloads to the server helper (never touches activity_events).
 */

import type { RegisterCustomerActivityInput } from "@/lib/customer-atenciones/register-customer-activity.types"

type ClientRegisterInput = Omit<
  RegisterCustomerActivityInput,
  "companyId" | "employeeId"
>

export async function requestRegisterCustomerActivity(
  input: ClientRegisterInput
): Promise<void> {
  try {
    const response = await fetch("/api/atencion-cliente/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId: input.entityId,
        action: input.action,
        category: input.category,
        impact: input.impact,
        origin: input.origin,
        title: input.title,
        description: input.description,
        metadata: input.metadata ?? {},
      }),
    })

    if (!response.ok) {
      console.warn("[customer-service/activity] client bridge failed", {
        action: input.action,
        entityId: input.entityId,
        status: response.status,
      })
    }
  } catch (error) {
    console.warn("[customer-service/activity] client bridge error", {
      action: input.action,
      entityId: input.entityId,
      error,
    })
  }
}
