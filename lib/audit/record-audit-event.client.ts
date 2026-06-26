import type { WriteAuditLogInput } from "@/lib/audit/types"

type RecordAuditEventClientInput = Omit<
  WriteAuditLogInput,
  "performedBy" | "ipAddress" | "userAgent"
>

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
      console.error("[Historial del Sistema] No se pudo registrar el evento.")
    }
  } catch (error) {
    console.error("[Historial del Sistema] Error al registrar evento.", error)
  }
}
