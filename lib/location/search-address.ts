import "server-only"

import type {
  AddressSearchResult,
  AddressSuggestion,
} from "@/lib/location/address-suggestion"
import { roundCoordinate } from "@/lib/gps"

const SEARCH_TIMEOUT_MS = 8_000
const MAX_RESULTS = 6
const USER_AGENT = "bespoke-operations/1.0 (commercial-geocoding)"

type OrsGeocodeFeature = {
  geometry?: { coordinates?: [number, number] }
  properties?: {
    id?: string | number
    label?: string
    name?: string
    street?: string
    housenumber?: string
    neighbourhood?: string
    locality?: string
    county?: string
    region?: string
    postalcode?: string
    country?: string
  }
}

type NominatimResult = {
  place_id?: number
  display_name?: string
  lat?: string
  lon?: string
  address?: {
    road?: string
    pedestrian?: string
    house_number?: string
    neighbourhood?: string
    suburb?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    state?: string
    postcode?: string
  }
}

function buildNormalizedAddress(parts: {
  street: string
  streetNumber: string
  neighborhood: string
  city: string
  province: string
  postalCode: string
  fallback: string
}): string {
  const streetLine = [parts.street, parts.streetNumber].filter(Boolean).join(" ")
  const chunks = [
    streetLine,
    parts.neighborhood,
    parts.city,
    parts.province,
    parts.postalCode,
  ].filter(Boolean)
  return chunks.join(", ") || parts.fallback
}

async function searchOpenRouteService(
  query: string,
  fetchImpl: typeof fetch
): Promise<AddressSuggestion[]> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim()
  if (!apiKey) return []

  const url = new URL("https://api.openrouteservice.org/geocode/autocomplete")
  url.searchParams.set("text", query)
  url.searchParams.set("size", String(MAX_RESULTS))
  url.searchParams.set("boundary.country", "AR")
  url.searchParams.set("lang", "es")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    })

    if (!response.ok) return []

    const payload = (await response.json()) as {
      features?: OrsGeocodeFeature[]
    }
    const features = payload.features ?? []

    return features
      .map((feature, index): AddressSuggestion | null => {
        const coords = feature.geometry?.coordinates
        const props = feature.properties
        if (!coords || !props) return null
        const longitude = roundCoordinate(coords[0])
        const latitude = roundCoordinate(coords[1])
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude == null ||
          longitude == null
        ) {
          return null
        }

        const street = props.street?.trim() || props.name?.trim() || ""
        const streetNumber = props.housenumber?.trim() || ""
        const neighborhood = props.neighbourhood?.trim() || ""
        const city = props.locality?.trim() || props.county?.trim() || ""
        const province = props.region?.trim() || ""
        const postalCode = props.postalcode?.trim() || ""
        const label = props.label?.trim() || props.name?.trim() || query
        const normalizedAddress = buildNormalizedAddress({
          street,
          streetNumber,
          neighborhood,
          city,
          province,
          postalCode,
          fallback: label,
        })

        return {
          id: String(props.id ?? `ors-${index}`),
          label,
          normalizedAddress,
          street,
          streetNumber,
          neighborhood,
          city,
          province,
          postalCode,
          latitude,
          longitude,
          provider: "openrouteservice",
        }
      })
      .filter((entry): entry is AddressSuggestion => entry != null)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

async function searchNominatim(
  query: string,
  fetchImpl: typeof fetch
): Promise<AddressSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", String(MAX_RESULTS))
  url.searchParams.set("countrycodes", "ar")
  url.searchParams.set("accept-language", "es")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    })

    if (!response.ok) return []

    const payload = (await response.json()) as NominatimResult[]

    return (payload ?? [])
      .map((entry, index): AddressSuggestion | null => {
        const latitude = roundCoordinate(Number.parseFloat(entry.lat ?? ""))
        const longitude = roundCoordinate(Number.parseFloat(entry.lon ?? ""))
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude == null ||
          longitude == null
        ) {
          return null
        }

        const address = entry.address ?? {}
        const street =
          address.road?.trim() || address.pedestrian?.trim() || ""
        const streetNumber = address.house_number?.trim() || ""
        const neighborhood =
          address.neighbourhood?.trim() || address.suburb?.trim() || ""
        const city =
          address.city?.trim() ||
          address.town?.trim() ||
          address.village?.trim() ||
          address.municipality?.trim() ||
          ""
        const province = address.state?.trim() || ""
        const postalCode = address.postcode?.trim() || ""
        const label = entry.display_name?.trim() || query
        const normalizedAddress = buildNormalizedAddress({
          street,
          streetNumber,
          neighborhood,
          city,
          province,
          postalCode,
          fallback: label,
        })

        return {
          id: String(entry.place_id ?? `nominatim-${index}`),
          label,
          normalizedAddress,
          street,
          streetNumber,
          neighborhood,
          city,
          province,
          postalCode,
          latitude,
          longitude,
          provider: "nominatim",
        }
      })
      .filter((entry): entry is AddressSuggestion => entry != null)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

async function reverseNominatim(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch
): Promise<AddressSuggestion | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse")
  url.searchParams.set("lat", String(latitude))
  url.searchParams.set("lon", String(longitude))
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("accept-language", "es")
  url.searchParams.set("zoom", "18")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    })

    if (!response.ok) return null

    const entry = (await response.json()) as NominatimResult & {
      error?: string
    }
    if (entry.error) return null

    const lat = roundCoordinate(
      Number.parseFloat(entry.lat ?? String(latitude))
    )
    const lng = roundCoordinate(
      Number.parseFloat(entry.lon ?? String(longitude))
    )
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    const address = entry.address ?? {}
    const street = address.road?.trim() || address.pedestrian?.trim() || ""
    const streetNumber = address.house_number?.trim() || ""
    const neighborhood =
      address.neighbourhood?.trim() || address.suburb?.trim() || ""
    const city =
      address.city?.trim() ||
      address.town?.trim() ||
      address.village?.trim() ||
      address.municipality?.trim() ||
      ""
    const province = address.state?.trim() || ""
    const postalCode = address.postcode?.trim() || ""
    const label = entry.display_name?.trim() || `${lat},${lng}`
    const normalizedAddress = buildNormalizedAddress({
      street,
      streetNumber,
      neighborhood,
      city,
      province,
      postalCode,
      fallback: label,
    })

    return {
      id: String(entry.place_id ?? `nominatim-reverse`),
      label,
      normalizedAddress,
      street,
      streetNumber,
      neighborhood,
      city,
      province,
      postalCode,
      latitude: lat,
      longitude: lng,
      provider: "nominatim",
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function searchAddressSuggestions(
  query: string,
  options?: { fetchImpl?: typeof fetch }
): Promise<AddressSearchResult> {
  const trimmed = query.trim()
  if (trimmed.length < 3) {
    return { ok: true, suggestions: [] }
  }

  const fetchImpl = options?.fetchImpl ?? fetch

  const ors = await searchOpenRouteService(trimmed, fetchImpl)
  if (ors.length > 0) {
    return { ok: true, suggestions: ors }
  }

  const nominatim = await searchNominatim(trimmed, fetchImpl)
  return { ok: true, suggestions: nominatim }
}

export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
  options?: { fetchImpl?: typeof fetch }
): Promise<AddressSuggestion | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return reverseNominatim(latitude, longitude, options?.fetchImpl ?? fetch)
}
