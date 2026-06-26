"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
      <div className="space-y-1">
        <Label className="text-base" htmlFor="wo-client-location-link">
          📍 Ubicación del trabajo
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wo-client-location-link">Enlace enviado por el cliente</Label>
        <Input
          id="wo-client-location-link"
          value={sharedLocation}
          onChange={(event) => onSharedLocationChange(event.target.value)}
          placeholder="https://maps.app.goo.gl/..."
        />
      </div>
    </div>
  )
}
