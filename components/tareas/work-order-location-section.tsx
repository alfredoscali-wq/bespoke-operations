"use client"

import { MapPin } from "lucide-react"

import { formatCoordinate } from "@/lib/gps"
import { LocationInput } from "@/components/location/location-input"
import { isWorkOrderGpsLoaded } from "@/lib/tasks/work-order-location"

type WorkOrderLocationSectionProps = {
  sharedLocation: string
  latitude?: number | null
  longitude?: number | null
  onSharedLocationChange: (value: string) => void
}

export function WorkOrderLocationSection({
  sharedLocation,
  latitude = null,
  longitude = null,
  onSharedLocationChange,
}: WorkOrderLocationSectionProps) {
  const gpsLoaded = isWorkOrderGpsLoaded(latitude, longitude)

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Ubicación GPS *</h4>
        {gpsLoaded ? (
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
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠ GPS pendiente
          </p>
        )}
      </div>
      <LocationInput
        id="wo-client-location-link"
        label="Ubicación"
        value={sharedLocation}
        onChange={onSharedLocationChange}
        required
      />
    </div>
  )
}
