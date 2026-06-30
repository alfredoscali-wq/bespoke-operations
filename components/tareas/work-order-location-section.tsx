"use client"

import { SharedLocationInput } from "@/components/tareas/shared-location-input"

type WorkOrderLocationSectionProps = {
  sharedLocation: string
  onSharedLocationChange: (value: string) => void
}

export function WorkOrderLocationSection({
  sharedLocation,
  onSharedLocationChange,
}: WorkOrderLocationSectionProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <SharedLocationInput
        id="wo-client-location-link"
        label="📍 Enlace de Google Maps"
        value={sharedLocation}
        onChange={onSharedLocationChange}
        required
      />
    </div>
  )
}
