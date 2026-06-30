"use client"

import { MapPin, Navigation } from "lucide-react"

import { buildGoogleMapsNavigationUrl, formatCoordinate, hasCoordinates } from "@/lib/gps"
import { SharedLocationInput } from "@/components/tareas/shared-location-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type WorkOrderAddressLocationBlockProps = {
  title: string
  description?: string
  address: string
  locality: string
  sharedLocation: string
  latitude: number | null
  longitude: number | null
  onAddressChange?: (value: string) => void
  onLocalityChange?: (value: string) => void
  onSharedLocationChange?: (value: string) => void
  readOnly?: boolean
  addressRequired?: boolean
  localityRequired?: boolean
  locationLinkRequired?: boolean
  addressId?: string
  localityId?: string
  locationLinkId?: string
  className?: string
}

export function WorkOrderAddressLocationBlock({
  title,
  description,
  address,
  locality,
  sharedLocation,
  latitude,
  longitude,
  onAddressChange,
  onLocalityChange,
  onSharedLocationChange,
  readOnly = false,
  addressRequired = false,
  localityRequired = false,
  locationLinkRequired = false,
  addressId,
  localityId,
  locationLinkId,
  className,
}: WorkOrderAddressLocationBlockProps) {
  const coordinatesReady = hasCoordinates(latitude, longitude)
  const navigationUrl = coordinatesReady
    ? buildGoogleMapsNavigationUrl(latitude as number, longitude as number)
    : null

  return (
    <div className={cn("space-y-4 rounded-xl border bg-muted/20 p-4", className)}>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={addressId}>
          Dirección{addressRequired ? " *" : ""}
        </Label>
        <Input
          id={addressId}
          value={address}
          onChange={(event) => onAddressChange?.(event.target.value)}
          readOnly={!onAddressChange}
          className={!onAddressChange ? "bg-muted/40" : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={localityId}>
          Localidad{localityRequired ? " *" : ""}
        </Label>
        <Input
          id={localityId}
          value={locality}
          onChange={(event) => onLocalityChange?.(event.target.value)}
          readOnly={!onLocalityChange}
          className={!onLocalityChange ? "bg-muted/40" : undefined}
        />
      </div>

      <SharedLocationInput
        id={locationLinkId ?? "wo-location-link"}
        label="📍 Enlace de Google Maps"
        value={sharedLocation}
        onChange={(value) => onSharedLocationChange?.(value)}
        required={locationLinkRequired}
        readOnly={readOnly || !onSharedLocationChange}
      />

      {coordinatesReady ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">GPS cargado</p>
              <p className="font-mono text-xs text-muted-foreground">
                {formatCoordinate(latitude as number)},{" "}
                {formatCoordinate(longitude as number)}
              </p>
            </div>
          </div>
          {navigationUrl ? (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <a href={navigationUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="size-4" />
                Navegar
              </a>
            </Button>
          ) : null}
        </div>
      ) : sharedLocation.trim() ? (
        <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Las coordenadas se resolverán al guardar la orden de trabajo.
        </div>
      ) : null}
    </div>
  )
}
