"use client"

import {
  FIBER_CONTRACTED_PLAN_OPTIONS,
  WIRELESS_CONTRACTED_PLAN_LABEL,
  type FiberContractedPlan,
} from "@/lib/tasks/commercial-plan"
import type { WorkOrderFormInput } from "@/lib/tasks/work-order"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

type CommercialFormSlice = Pick<
  WorkOrderFormInput,
  "serviceType" | "technology" | "contractedPlan"
>

type WorkOrderCommercialFieldsProps<T extends CommercialFormSlice> = {
  form: T
  updateField: <K extends keyof T>(key: K, value: T[K]) => void
}

export function WorkOrderCommercialFields<T extends CommercialFormSlice>({
  form,
  updateField,
}: WorkOrderCommercialFieldsProps<T>) {
  if (form.serviceType !== "instalacion-nueva" || !form.technology) {
    return null
  }

  const isWireless = form.technology === "wireless"

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <h4 className="text-sm font-semibold text-foreground">
        Información comercial
      </h4>

      <div className="space-y-2">
        <Label>Plan contratado *</Label>
        {isWireless ? (
          <div className="rounded-lg border bg-background px-3 py-2.5 text-sm font-medium">
            {WIRELESS_CONTRACTED_PLAN_LABEL}
          </div>
        ) : (
          <div className="space-y-2">
            {FIBER_CONTRACTED_PLAN_OPTIONS.map((option) => {
              const selected = form.contractedPlan === option.value

              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5 font-medium"
                      : "bg-background hover:bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="contracted-plan"
                    value={option.value}
                    checked={selected}
                    onChange={() =>
                      updateField(
                        "contractedPlan",
                        option.value as FiberContractedPlan
                      )
                    }
                    className="size-4 shrink-0 accent-primary"
                  />
                  {option.label}
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
