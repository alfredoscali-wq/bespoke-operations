"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { WorkOrderFormInput } from "@/lib/tasks/work-order"
import { WorkOrderTechnologyStateSection } from "@/components/tareas/work-order-ftth-installation-fields"
import type { ContractedPlan } from "@/lib/tasks/commercial-plan"
import type { WorkOrderTechnology } from "@/lib/tasks/work-order"

type WorkOrderCambioTecnologiaFieldsProps = {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
}

export function WorkOrderCambioTecnologiaFields({
  form,
  updateField,
}: WorkOrderCambioTecnologiaFieldsProps) {
  function updateNewTechnology(value: WorkOrderTechnology) {
    updateField("newTechnology", value)
    updateField("technology", value)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">Domicilio</h4>
          <p className="text-xs text-muted-foreground">
            Calle y localidad del cliente. La ubicación GPS se completa más abajo.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wo-cambio-tech-address">Dirección *</Label>
          <Input
            id="wo-cambio-tech-address"
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wo-cambio-tech-locality">Localidad</Label>
          <Input
            id="wo-cambio-tech-locality"
            value={form.locality}
            onChange={(event) => updateField("locality", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WorkOrderTechnologyStateSection
          title="Estado actual"
          description="Tecnología y plan vigentes del cliente."
          technology={form.currentTechnology}
          contractedPlan={form.currentContractedPlan}
          onTechnologyChange={(value) => updateField("currentTechnology", value)}
          onContractedPlanChange={(value: ContractedPlan) =>
            updateField("currentContractedPlan", value)
          }
          showInstallationFields={false}
          idPrefix="wo-cambio-tech-current"
          technologyLabel="Tecnología actual *"
          planLabel="Plan actual *"
        />

        <WorkOrderTechnologyStateSection
          title="Estado final"
          description="Nueva tecnología y plan. Si termina en Fibra, complete los datos FTTH."
          technology={form.newTechnology}
          contractedPlan={form.newContractedPlan || form.contractedPlan}
          serviceCatalogId={form.serviceCatalogId}
          onTechnologyChange={updateNewTechnology}
          onContractedPlanChange={(value: ContractedPlan) => {
            updateField("newContractedPlan", value)
            updateField("contractedPlan", value)
          }}
          onServiceCatalogIdChange={(value) => updateField("serviceCatalogId", value)}
          napBox={form.napBox}
          napPort={form.napPort}
          onuSerial={form.onuSerial}
          onNapBoxChange={(value) => updateField("napBox", value)}
          onNapPortChange={(value) => updateField("napPort", value)}
          onOnuSerialChange={(value) => updateField("onuSerial", value)}
          showInstallationFields
          idPrefix="wo-cambio-tech-new"
          technologyLabel="Nueva tecnología *"
          planLabel="Plan de la nueva tecnología *"
        />
      </div>
    </div>
  )
}
