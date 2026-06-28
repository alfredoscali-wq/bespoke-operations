"use client"

import type { WorkOrderFormInput } from "@/lib/tasks/work-order"
import { WorkOrderAddressLocationBlock } from "@/components/tareas/work-order-address-location-block"
import { WorkOrderTechnologyStateSection } from "@/components/tareas/work-order-ftth-installation-fields"
import type { ContractedPlan } from "@/lib/tasks/commercial-plan"
import type { WorkOrderTechnology } from "@/lib/tasks/work-order"

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
  function updateCurrentTechnology(value: WorkOrderTechnology) {
    updateField("currentTechnology", value)
    updateField("technology", value)
  }

  function updateNewTechnology(value: WorkOrderTechnology) {
    updateField("newTechnology", value)
    updateField("technology", value)
  }

  return (
    <div className="space-y-4">
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
          locationLinkRequired
          addressId="wo-new-address"
          localityId="wo-new-locality"
          locationLinkId="wo-new-location-link"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkOrderTechnologyStateSection
          title="Estado actual"
          description="Tecnología y plan vigentes en el domicilio de origen."
          technology={form.currentTechnology}
          contractedPlan={form.currentContractedPlan}
          onTechnologyChange={updateCurrentTechnology}
          onContractedPlanChange={(value: ContractedPlan) =>
            updateField("currentContractedPlan", value)
          }
          showInstallationFields={false}
          idPrefix="wo-current-tech"
          technologyLabel="Tecnología actual *"
          planLabel="Plan actual *"
        />

        <WorkOrderTechnologyStateSection
          title="Estado final (nuevo domicilio)"
          description="Tecnología y plan a instalar. Si es Fibra, complete los datos FTTH."
          technology={form.newTechnology}
          contractedPlan={form.newContractedPlan || form.contractedPlan}
          onTechnologyChange={updateNewTechnology}
          onContractedPlanChange={(value: ContractedPlan) => {
            updateField("newContractedPlan", value)
            updateField("contractedPlan", value)
          }}
          napBox={form.napBox}
          napPort={form.napPort}
          onuSerial={form.onuSerial}
          onNapBoxChange={(value) => updateField("napBox", value)}
          onNapPortChange={(value) => updateField("napPort", value)}
          onOnuSerialChange={(value) => updateField("onuSerial", value)}
          showInstallationFields
          idPrefix="wo-new-tech"
          technologyLabel="Tecnología en el nuevo domicilio *"
          planLabel="Plan en el nuevo domicilio *"
        />
      </div>
    </div>
  )
}
