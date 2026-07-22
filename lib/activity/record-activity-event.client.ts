import type { RecordActivityEventInput } from "@/lib/activity/types"

type ClientActivityEventInput = Omit<
  RecordActivityEventInput,
  "companyId" | "employeeId" | "actorType"
>

async function readActivityErrorMessage(
  response: Response
): Promise<string | null> {
  try {
    const payload = (await response.json()) as { message?: string }
    return payload.message?.trim() || null
  } catch {
    return null
  }
}

/**
 * Best-effort client Activity write. Never throws; failures are warning-logged only.
 */
export async function recordActivityEventClient(
  input: ClientActivityEventInput
): Promise<void> {
  try {
    const response = await fetch("/api/activity/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const message = await readActivityErrorMessage(response)
      console.warn("[Activity Engine] No se pudo registrar el evento (best-effort).", {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        status: response.status,
        message,
      })
    }
  } catch (error) {
    console.warn("[Activity Engine] Error al registrar evento (best-effort).", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error,
    })
  }
}
