import { roundCoordinate } from "@/lib/gps"

export type AddressSuggestion = {
  id: string
  label: string
  normalizedAddress: string
  street: string
  streetNumber: string
  neighborhood: string
  city: string
  province: string
  postalCode: string
  latitude: number
  longitude: number
  provider: "openrouteservice" | "nominatim"
}

export type AddressSearchResult =
  | { ok: true; suggestions: AddressSuggestion[] }
  | { ok: false; message: string }
