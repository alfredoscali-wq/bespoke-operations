import {
  ACTIVITY_EVENT_TITLES,
  type ActivityEventAction,
} from "@/lib/activity/actions"

export type ClientRecordActivityInput = {
  module: string
  entityType: string
  entityId?: string | null
  action: ActivityEventAction
  title?: string
  description?: string | null
  metadata?: Record<string, unknown>
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { message?: string }
    return payload.message?.trim() || null
  } catch {
    return null
  }
}

/**
 * Browser bridge to the canonical Activity Engine.
 * Always ends server-side in recordActivity(). Never throws.
 */
export async function recordActivityClient(
  input: ClientRecordActivityInput
): Promise<void> {
  try {
    const response = await fetch("/api/activity/record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        title: input.title ?? ACTIVITY_EVENT_TITLES[input.action],
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      }),
    })

    if (!response.ok) {
      const message = await readErrorMessage(response)
      console.warn("[activity-engine] recordActivityClient failed", {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        status: response.status,
        message,
      })
    }
  } catch (error) {
    console.warn("[activity-engine] recordActivityClient failed", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error,
    })
  }
}
