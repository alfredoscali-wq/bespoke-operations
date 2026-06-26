"use client"

import type { WorkOrderFormInput } from "@/lib/tasks/work-order"
import { WorkOrderAddressLocationBlock } from "@/components/tareas/work-order-address-location-block"

type WorkOrderCambioDomicilioFieldsProps = {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
}

export function WorkOrderCambioDomicilioFields({
  form,
  updateField,
}: WorkOrderCambioDomicilioFieldsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <WorkOrderAddressLocationBlock
        title="Domicilio actual"
        description="Ubicación de retiro de equipos."
        address={form.currentAddress}
        locality={form.currentLocality}
        sharedLocation={form.currentSharedLocation}
        latitude={form.currentLatitude}
        longitude={form.currentLongitude}
        onAddressChange={(value) => updateField("currentAddress", value)}
        onLocalityChange={(value) => updateField("currentLocality", value)}
        onSharedLocationChange={(value) =>
          updateField("currentSharedLocation", value)
        }
        onCoordinatesChange={(latitude, longitude) => {
          updateField("currentLatitude", latitude)
          updateField("currentLongitude", longitude)
        }}
        addressRequired
        localityRequired
        addressId="wo-current-address"
        localityId="wo-current-locality"
        locationLinkId="wo-current-location-link"
      />

      <WorkOrderAddressLocationBlock
        title="Domicilio nuevo"
        description="Ubicación de instalación del servicio."
        address={form.newAddress}
        locality={form.newLocality}
        sharedLocation={form.newSharedLocation}
        latitude={form.newLatitude}
        longitude={form.newLongitude}
        onAddressChange={(value) => updateField("newAddress", value)}
        onLocalityChange={(value) => updateField("newLocality", value)}
        onSharedLocationChange={(value) =>
          updateField("newSharedLocation", value)
        }
        onCoordinatesChange={(latitude, longitude) => {
          updateField("newLatitude", latitude)
          updateField("newLongitude", longitude)
        }}
        addressRequired
        localityRequired
        addressId="wo-new-address"
        localityId="wo-new-locality"
        locationLinkId="wo-new-location-link"
      />
    </div>
  )
}
