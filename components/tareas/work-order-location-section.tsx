"use client"

import { LocationInput } from "@/components/location/location-input"

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
      <LocationInput
        id="wo-client-location-link"
        value={sharedLocation}
        onChange={onSharedLocationChange}
        required
      />
    </div>
  )
}
