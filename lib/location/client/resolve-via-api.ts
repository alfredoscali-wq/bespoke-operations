import type { ResolvedLocation } from "@/lib/location/types"

type ResolveLocationApiResponse =
  | { success: true; data: ResolvedLocation }
  | { success: false; message: string; code?: string }

export async function resolveLocationViaApi(
  sharedLocation: string
): Promise<ResolvedLocation> {
  const response = await fetch("/api/operations/location/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sharedLocation }),
  })

  let payload: ResolveLocationApiResponse

  try {
    payload = (await response.json()) as ResolveLocationApiResponse
  } catch {
    throw new Error("No se pudo resolver la ubicación GPS.")
  }

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.success === false
        ? payload.message
        : "No se pudo resolver la ubicación GPS."
    )
  }

  return payload.data
}
