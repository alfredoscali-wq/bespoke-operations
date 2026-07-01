import type { WriteAuditLogInput } from "@/lib/audit/types"

type RecordAuditEventClientInput = Omit<
  WriteAuditLogInput,
  "performedBy" | "ipAddress" | "userAgent"
>

async function readAuditErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { message?: string }
    return payload.message?.trim() || null
  } catch {
    return null
  }
}

/**
 * Best-effort client audit write. Never throws; failures are warning-logged only.
 */
export async function recordAuditEventClient(
  input: RecordAuditEventClientInput
): Promise<void> {
  try {
    const response = await fetch("/api/audit/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const message = await readAuditErrorMessage(response)
      console.warn(
        "[Historial del Sistema] No se pudo registrar el evento (best-effort).",
        {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          status: response.status,
          message,
        }
      )
    }
  } catch (error) {
    console.warn(
      "[Historial del Sistema] Error al registrar evento (best-effort).",
      {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        error,
      }
    )
  }
}
