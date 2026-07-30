"use client"

import { useEffect, useId, useRef, useState } from "react"
import { LocateFixed } from "lucide-react"

import { CommercialGeocodeFallbackDialog } from "@/components/gestion-comercial/commercial-geocode-fallback-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CommercialLocationSource } from "@/lib/commercial/catalogs"
import { composeCommercialAddress } from "@/lib/commercial/location"
import { resolveCommercialLocationPaste } from "@/lib/commercial/resolve-person-location"
import { hasCoordinates } from "@/lib/gps"
import type { AddressSuggestion } from "@/lib/location/address-suggestion"
import { searchAddressViaApi, reverseAddressViaApi } from "@/lib/location/client/search-via-api"
import { formatCoordinatePair } from "@/lib/location/coordinates"

/**
 * Shared commercial location capture — used by Alta/Edición de Cliente,
 * Nueva Actividad Comercial, and CommercialPersonForm.
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
  /**
   * When false, hides structured domicilio fields (calle/piso/…).
   * Capture UX (search, paste, GPS, coords) stays identical.
   */
  showDomicilioFields?: boolean
}

const SEARCH_DEBOUNCE_MS = 400

export function CommercialPersonLocationFields({
  value,
  onChange,
  disabled = false,
  onAdvanceField,
  idPrefix = "commercial-person",
  showDomicilioFields = true,
}: CommercialPersonLocationFieldsProps) {
  const listId = useId()
  const [searchQuery, setSearchQuery] = useState("")
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteValue, setPasteValue] = useState("")
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [isResolvingPaste, setIsResolvingPaste] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [mapDialogOpen, setMapDialogOpen] = useState(false)
  const skipSearchRef = useRef(false)
  const requestIdRef = useRef(0)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      if (value.address.trim()) {
        skipSearchRef.current = true
        setSearchQuery(value.address)
      } else if (hasCoordinates(value.latitude, value.longitude)) {
        skipSearchRef.current = true
        setSearchQuery(
          formatCoordinatePair(
            value.latitude as number,
            value.longitude as number
          )
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [value.address, value.latitude, value.longitude])

  function patch(partial: Partial<CommercialPersonLocationFieldsValue>) {
    const next = { ...value, ...partial }
    const address = composeCommercialAddress(next)
    onChange({ ...next, address })
  }

  function applySuggestion(
    suggestion: AddressSuggestion,
    options?: {
      locationSource?: CommercialLocationSource
      locationInput?: string
    }
  ) {
    skipSearchRef.current = true
    setSearchQuery(suggestion.label)
    setSuggestions([])
    setListOpen(false)
    setHasSearched(false)
    setSearchError(null)
    setLocateError(null)
    patch({
      street: suggestion.street,
      streetNumber: suggestion.streetNumber,
      neighborhood: suggestion.neighborhood,
      city: suggestion.city,
      province: suggestion.province,
      postalCode: suggestion.postalCode,
      address: suggestion.normalizedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      locationSource: options?.locationSource ?? "manual",
      locationInput: options?.locationInput ?? "",
    })
  }

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false
      return
    }

    const trimmed = searchQuery.trim()
    const requestId = ++requestIdRef.current

    if (trimmed.length < 3) {
      const clearHandle = window.setTimeout(() => {
        if (requestId !== requestIdRef.current) return
        setSuggestions([])
        setHasSearched(false)
        setIsSearching(false)
        setSearchError(null)
      }, 0)
      return () => {
        window.clearTimeout(clearHandle)
      }
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setIsSearching(true)
        setSearchError(null)
        try {
          const next = await searchAddressViaApi(trimmed)
          if (requestId !== requestIdRef.current) return
          setSuggestions(next)
          setHasSearched(true)
          setListOpen(true)
        } catch (error) {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          setHasSearched(true)
          setListOpen(false)
          setSearchError(
            error instanceof Error
              ? error.message
              : "No se pudo buscar la dirección."
          )
        } finally {
          if (requestId === requestIdRef.current) {
            setIsSearching(false)
          }
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(handle)
    }
  }, [searchQuery])

  const hasCoords = hasCoordinates(value.latitude, value.longitude)
  const showNoResults =
    hasSearched &&
    !isSearching &&
    !hasCoords &&
    suggestions.length === 0 &&
    searchQuery.trim().length >= 3

  async function handlePasteConfirm() {
    setIsResolvingPaste(true)
    setPasteError(null)
    try {
      const resolved = await resolveCommercialLocationPaste(pasteValue)
      if (!resolved) {
        setPasteError("No se pudo interpretar la ubicación.")
        return
      }

      const suggestion = await reverseAddressViaApi(
        resolved.latitude,
        resolved.longitude
      )

      if (suggestion) {
        applySuggestion(
          {
            ...suggestion,
            latitude: resolved.latitude,
            longitude: resolved.longitude,
          },
          {
            locationSource: resolved.locationSource,
            locationInput: pasteValue.trim(),
          }
        )
      } else {
        skipSearchRef.current = true
        const label = formatCoordinatePair(
          resolved.latitude,
          resolved.longitude
        )
        setSearchQuery(label)
        setSuggestions([])
        setListOpen(false)
        setHasSearched(false)
        patch({
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          locationSource: resolved.locationSource,
          locationInput: pasteValue.trim(),
          address: label,
        })
      }

      setPasteOpen(false)
      setPasteValue("")
    } finally {
      setIsResolvingPaste(false)
    }
  }

  function applyCoords(
    latitude: number,
    longitude: number,
    locationSource: CommercialLocationSource,
    locationInput = ""
  ) {
    void (async () => {
      const suggestion = await reverseAddressViaApi(latitude, longitude)
      if (suggestion) {
        applySuggestion(
          {
            ...suggestion,
            latitude,
            longitude,
          },
          { locationSource, locationInput }
        )
        return
      }

      skipSearchRef.current = true
      const label = formatCoordinatePair(latitude, longitude)
      setSearchQuery(label)
      setSuggestions([])
      setListOpen(false)
      setHasSearched(false)
      patch({
        latitude,
        longitude,
        locationSource,
        locationInput,
        address: label,
      })
    })()
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError("Geolocalización no disponible en este dispositivo.")
      return
    }

    setIsLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(7))
        const longitude = Number(position.coords.longitude.toFixed(7))
        applyCoords(latitude, longitude, "gps")
        setIsLocating(false)
      },
      () => {
        setIsLocating(false)
        setLocateError("No se pudo obtener la ubicación actual.")
      },
      { enableHighAccuracy: true, timeout: 12_000 }
    )
  }

  function clearLocation() {
    patch({
      latitude: null,
      longitude: null,
      locationSource: null,
      locationInput: "",
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address-search`}>Dirección</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-address-search`}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              if (hasCoords) {
                clearLocation()
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) setListOpen(true)
            }}
            onKeyDown={onAdvanceField}
            disabled={disabled}
            placeholder="Escriba una dirección o pegue un enlace de Google Maps"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            autoComplete="off"
          />
          {listOpen && suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md"
            >
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => applySuggestion(suggestion)}
                    disabled={disabled}
                  >
                    <span className="block font-medium text-foreground">
                      {suggestion.label}
                    </span>
                    {suggestion.normalizedAddress !== suggestion.label ? (
                      <span className="block text-xs text-muted-foreground">
                        {suggestion.normalizedAddress}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {isSearching ? (
          <p className="text-xs text-muted-foreground">Buscando direcciones…</p>
        ) : null}
        {searchError ? (
          <p className="text-xs text-destructive" role="alert">
            {searchError}
          </p>
        ) : null}
        {value.address.trim() ? (
          <p className="text-xs text-muted-foreground">
            Dirección normalizada: {value.address}
          </p>
        ) : null}
        {hasCoords ? (
          <p className="text-xs text-muted-foreground">
            Coordenadas:{" "}
            {formatCoordinatePair(
              value.latitude as number,
              value.longitude as number
            )}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={disabled || isLocating}
            onClick={handleUseCurrentLocation}
          >
            <LocateFixed className="size-3.5" aria-hidden />
            {isLocating ? "Obteniendo…" : "Usar ubicación actual"}
          </Button>
        </div>
        {locateError ? (
          <p className="text-xs text-destructive" role="alert">
            {locateError}
          </p>
        ) : null}

        {!pasteOpen ? (
          <button
            type="button"
            className="text-left text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => {
              setPasteOpen(true)
              setPasteError(null)
            }}
          >
            ¿Ya tenés la ubicación? Pegar enlace de Google Maps o coordenadas
            GPS
          </button>
        ) : (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor={`${idPrefix}-paste-link`}>
              Enlace o coordenadas
            </Label>
            <Input
              id={`${idPrefix}-paste-link`}
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              placeholder="Pegue un enlace de Google Maps o coordenadas GPS"
              disabled={disabled || isResolvingPaste}
            />
            {pasteError ? (
              <p className="text-xs text-destructive" role="alert">
                {pasteError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={disabled || isResolvingPaste || !pasteValue.trim()}
                onClick={() => void handlePasteConfirm()}
              >
                Usar ubicación
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || isResolvingPaste}
                onClick={() => {
                  setPasteOpen(false)
                  setPasteValue("")
                  setPasteError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {showNoResults ? (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            No encontramos resultados para esta dirección.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setHasSearched(false)
                setSuggestions([])
              }}
            >
              Continuar sin ubicación
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto justify-start px-0 text-xs text-muted-foreground"
              disabled={disabled}
              onClick={() => setMapDialogOpen(true)}
            >
              Seleccionar en mapa (última alternativa)
            </Button>
          </div>
        </div>
      ) : null}

      {showDomicilioFields ? (
        <>
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Domicilio
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Se completa al elegir una sugerencia. Puede ajustar piso y
              departamento manualmente.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${idPrefix}-street`}>Calle</Label>
              <Input
                id={`${idPrefix}-street`}
                value={value.street}
                onChange={(event) => {
                  patch({
                    street: event.target.value,
                    latitude: null,
                    longitude: null,
                    locationSource: null,
                  })
                  setSearchQuery(
                    composeCommercialAddress({
                      ...value,
                      street: event.target.value,
                    })
                  )
                }}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-street-number`}>Número</Label>
              <Input
                id={`${idPrefix}-street-number`}
                value={value.streetNumber}
                onChange={(event) => {
                  patch({
                    streetNumber: event.target.value,
                    latitude: null,
                    longitude: null,
                    locationSource: null,
                  })
                  setSearchQuery(
                    composeCommercialAddress({
                      ...value,
                      streetNumber: event.target.value,
                    })
                  )
                }}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-floor`}>Piso</Label>
              <Input
                id={`${idPrefix}-floor`}
                value={value.floor}
                onChange={(event) => patch({ floor: event.target.value })}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-apartment`}>Departamento</Label>
              <Input
                id={`${idPrefix}-apartment`}
                value={value.apartment}
                onChange={(event) => patch({ apartment: event.target.value })}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-neighborhood`}>Barrio</Label>
              <Input
                id={`${idPrefix}-neighborhood`}
                value={value.neighborhood}
                onChange={(event) =>
                  patch({ neighborhood: event.target.value })
                }
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-city`}>Ciudad</Label>
              <Input
                id={`${idPrefix}-city`}
                value={value.city}
                onChange={(event) => {
                  patch({
                    city: event.target.value,
                    latitude: null,
                    longitude: null,
                    locationSource: null,
                  })
                  setSearchQuery(
                    composeCommercialAddress({
                      ...value,
                      city: event.target.value,
                    })
                  )
                }}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-province`}>Provincia</Label>
              <Input
                id={`${idPrefix}-province`}
                value={value.province}
                onChange={(event) => {
                  patch({
                    province: event.target.value,
                    latitude: null,
                    longitude: null,
                    locationSource: null,
                  })
                  setSearchQuery(
                    composeCommercialAddress({
                      ...value,
                      province: event.target.value,
                    })
                  )
                }}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-postal`}>Código Postal</Label>
              <Input
                id={`${idPrefix}-postal`}
                value={value.postalCode}
                onChange={(event) => patch({ postalCode: event.target.value })}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
          </div>
        </>
      ) : null}

      <CommercialGeocodeFallbackDialog
        open={mapDialogOpen}
        onOpenChange={setMapDialogOpen}
        initialMode="map"
        onResolved={(coords) => {
          applyCoords(coords.latitude, coords.longitude, "manual")
        }}
      />
    </div>
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

/** Alias for the shared commercial location capture (Alta / Edición / Actividad). */
export const CommercialLocationFields = CommercialPersonLocationFields
export type CommercialLocationFieldsValue = CommercialPersonLocationFieldsValue
export const emptyCommercialLocationFields = emptyCommercialPersonLocationFields
