"use client"

import { LocationInput } from "@/components/location/location-input"
import type { CommercialLocationSource } from "@/lib/commercial/catalogs"
import { formatCoordinatePair } from "@/lib/location/coordinates"
import { hasCoordinates } from "@/lib/gps"

/**
 * Person/opportunity location value shape for commercial forms.
 * Capture UI is the canonical LocationInput (paste-only).
 */
export type CommercialPersonLocationFieldsValue = {
  street: string
  streetNumber: string
  floor: string
  apartment: string
  neighborhood: string
  city: string
  province: string
  postalCode: string
  address: string
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
  locationInput: string
}

type CommercialPersonLocationFieldsProps = {
  value: CommercialPersonLocationFieldsValue
  onChange: (next: CommercialPersonLocationFieldsValue) => void
  disabled?: boolean
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
  idPrefix?: string
  /** @deprecated Ignored — domicilio fields removed in UX 6.2. */
  showDomicilioFields?: boolean
  required?: boolean
}

function displayLocationInput(value: CommercialPersonLocationFieldsValue): string {
  if (value.locationInput.trim()) return value.locationInput
  if (hasCoordinates(value.latitude, value.longitude)) {
    return formatCoordinatePair(
      value.latitude as number,
      value.longitude as number
    )
  }
  return ""
}

export function CommercialPersonLocationFields({
  value,
  onChange,
  disabled = false,
  onAdvanceField,
  idPrefix = "commercial-person",
  required = true,
}: CommercialPersonLocationFieldsProps) {
  return (
    <LocationInput
      id={`${idPrefix}-location`}
      value={displayLocationInput(value)}
      disabled={disabled}
      required={required}
      onKeyDown={onAdvanceField}
      onChange={(locationInput) => {
        onChange({
          ...value,
          locationInput,
          address: locationInput.trim(),
          latitude: null,
          longitude: null,
          locationSource: null,
        })
      }}
    />
  )
}

export function emptyCommercialPersonLocationFields(): CommercialPersonLocationFieldsValue {
  return {
    street: "",
    streetNumber: "",
    floor: "",
    apartment: "",
    neighborhood: "",
    city: "",
    province: "",
    postalCode: "",
    address: "",
    latitude: null,
    longitude: null,
    locationSource: null,
    locationInput: "",
  }
}

export const CommercialLocationFields = CommercialPersonLocationFields
export type CommercialLocationFieldsValue = CommercialPersonLocationFieldsValue
export const emptyCommercialLocationFields = emptyCommercialPersonLocationFields
