import type { ForceDeleteEntityType } from "@/lib/admin/force-delete-types"

export type ForceDeleteRequest = {
  entityType: ForceDeleteEntityType
  entityId: string
}

export type ForceDeleteResponse = {
  success: boolean
  message?: string
  entityType?: ForceDeleteEntityType
  entityId?: string
  entityLabel?: string
}

export async function requestForceDelete(
  input: ForceDeleteRequest
): Promise<ForceDeleteResponse> {
  const response = await fetch("/api/admin/force-delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })

  const payload = (await response.json()) as ForceDeleteResponse

  if (!response.ok) {
    return {
      success: false,
      message:
        payload.message ?? "No se pudo forzar la eliminación del registro.",
    }
  }

  return payload
}
