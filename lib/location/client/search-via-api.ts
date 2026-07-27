import type { AddressSuggestion } from "@/lib/location/address-suggestion"

type SearchAddressApiResponse =
  | { success: true; suggestions: AddressSuggestion[] }
  | { success: false; message: string }

export async function searchAddressViaApi(
  query: string
): Promise<AddressSuggestion[]> {
  const response = await fetch("/api/operations/location/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })

  let payload: SearchAddressApiResponse
  try {
    payload = (await response.json()) as SearchAddressApiResponse
  } catch {
    throw new Error("No se pudo buscar la dirección.")
  }

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.success === false
        ? payload.message
        : "No se pudo buscar la dirección."
    )
  }

  return payload.suggestions
}

export async function reverseAddressViaApi(
  latitude: number,
  longitude: number
): Promise<AddressSuggestion | null> {
  const response = await fetch("/api/operations/location/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  })

  let payload: SearchAddressApiResponse
  try {
    payload = (await response.json()) as SearchAddressApiResponse
  } catch {
    return null
  }

  if (!response.ok || !payload.success) {
    return null
  }

  return payload.suggestions[0] ?? null
}
