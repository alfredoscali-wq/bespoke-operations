"use client"

import { WorkOrderTechnologyPlanFields } from "@/components/tareas/work-order-technology-plan-fields"
import type { WorkOrderFormInput } from "@/lib/tasks/work-order"

type CommercialFormSlice = Pick<
  WorkOrderFormInput,
  "serviceType" | "technology" | "contractedPlan" | "installationIp"
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
        Información comercial
      </h4>
      <WorkOrderTechnologyPlanFields form={form} updateField={updateField} />
    </div>
  )
}
