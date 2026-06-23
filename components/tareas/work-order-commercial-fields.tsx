"use client"

import {
  FIBER_CONTRACTED_PLAN_OPTIONS,
  WIRELESS_CONTRACTED_PLAN_LABEL,
  formatInstallationCostInput,
  type FiberContractedPlan,
} from "@/lib/tasks/commercial-plan"
import type { WorkOrderFormInput } from "@/lib/tasks/work-order"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type WorkOrderCommercialFieldsProps = {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
}

export function WorkOrderCommercialFields({
  form,
  updateField,
}: WorkOrderCommercialFieldsProps) {
  if (form.serviceType !== "instalacion-nueva" || !form.technology) {
    return null
  }

  const isWireless = form.technology === "wireless"

  function handleInstallationCostChange(rawValue: string) {
    const digits = rawValue.replace(/\D/g, "")
    updateField("installationCost", digits)
  }

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

      <div className="space-y-2">
        <Label htmlFor="wo-installation-cost">Costo de instalación *</Label>
        <Input
          id="wo-installation-cost"
          inputMode="numeric"
          value={formatInstallationCostInput(form.installationCost)}
          onChange={(event) => handleInstallationCostChange(event.target.value)}
          placeholder="$ 0"
        />
      </div>
    </div>
  )
}
