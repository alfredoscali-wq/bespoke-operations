"use client"

import { WorkOrderTechnologyPlanFields } from "@/components/tareas/work-order-technology-plan-fields"
import { WorkOrderFtthInstallationFields } from "@/components/tareas/work-order-ftth-installation-fields"
import type { WorkOrderFormInput } from "@/lib/tasks/work-order"

type CommercialFormSlice = Pick<
  WorkOrderFormInput,
  | "serviceType"
  | "technology"
  | "contractedPlan"
  | "napBox"
  | "napPort"
  | "onuSerial"
>

type WorkOrderCommercialFieldsProps<T extends CommercialFormSlice> = {
  form: T
  updateField: <K extends keyof T>(key: K, value: T[K]) => void
}

export function WorkOrderCommercialFields<T extends CommercialFormSlice>({
  form,
  updateField,
}: WorkOrderCommercialFieldsProps<T>) {
  if (form.serviceType !== "instalacion-nueva") {
    return null
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <h4 className="text-sm font-semibold text-foreground">
        Información comercial e instalación
      </h4>
      <WorkOrderTechnologyPlanFields form={form} updateField={updateField} />
      <WorkOrderFtthInstallationFields
        technology={form.technology}
        values={{
          contractedPlan: form.contractedPlan,
          napBox: form.napBox,
          napPort: form.napPort,
          onuSerial: form.onuSerial,
        }}
        onNapBoxChange={(value) => updateField("napBox" as keyof T, value as T[keyof T])}
        onNapPortChange={(value) => updateField("napPort" as keyof T, value as T[keyof T])}
        onOnuSerialChange={(value) =>
          updateField("onuSerial" as keyof T, value as T[keyof T])
        }
        showPlan={false}
        showInstallationFields
        idPrefix="wo-install"
      />
    </div>
  )
}
