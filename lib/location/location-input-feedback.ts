import type { LocationInputValidation } from "@/lib/location/types"
import { isValidLocationInput } from "@/lib/location/validate-location-input"

export function validateLocationInput(input: string): LocationInputValidation {
  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, reason: "empty" }
  }

  if (!isValidLocationInput(trimmed)) {
    return { valid: false, reason: "invalid-format" }
  }

  return { valid: true }
}

export function getLocationInputFeedback(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const validation = validateLocationInput(trimmed)
  if (validation.valid) {
    return "✓ Ubicación válida"
  }

  return "⚠ Pegue una ubicación válida de Google Maps."
}
