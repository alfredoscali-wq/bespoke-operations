"use client"

import {
  getPlanOptionsForTechnology,
  sanitizePlanForTechnology,
  WIRELESS_CONTRACTED_PLAN_LABEL,
  type ContractedPlan,
} from "@/lib/tasks/commercial-plan"
import {
  WORK_ORDER_TECHNOLOGY_OPTIONS,
  type WorkOrderFormInput,
  type WorkOrderTechnology,
} from "@/lib/tasks/work-order"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CommercialFormSlice = Pick<
  WorkOrderFormInput,
  "serviceType" | "technology" | "contractedPlan"
>

type WorkOrderTechnologyPlanFieldsProps<T extends CommercialFormSlice> = {
  form: T
  updateField: <K extends keyof T>(key: K, value: T[K]) => void
  showTechnology?: boolean
  showPlan?: boolean
  technologyLabel?: string
  planLabel?: string
}

export function WorkOrderTechnologyPlanFields<T extends CommercialFormSlice>({
  form,
  updateField,
  showTechnology = true,
  showPlan = true,
  technologyLabel = "Tecnología *",
  planLabel = "Plan contratado *",
}: WorkOrderTechnologyPlanFieldsProps<T>) {
  if (!showTechnology && !showPlan) {
    return null
  }

  const planOptions = getPlanOptionsForTechnology(form.technology)
  const isWireless = form.technology === "wireless"

  function handleTechnologyChange(value: WorkOrderTechnology) {
    updateField("technology" as keyof T, value as T[keyof T])
    updateField(
      "contractedPlan" as keyof T,
      sanitizePlanForTechnology(form.contractedPlan, value) as T[keyof T]
    )
  }

  return (
    <div className="space-y-4">
      {showTechnology ? (
        <div className="space-y-2">
          <Label>{technologyLabel}</Label>
          <Select
            value={form.technology || undefined}
            onValueChange={(value) =>
              handleTechnologyChange(value as WorkOrderTechnology)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tecnología" />
            </SelectTrigger>
            <SelectContent>
              {WORK_ORDER_TECHNOLOGY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showPlan && form.technology ? (
        <div className="space-y-2">
          <Label>{planLabel}</Label>
          {isWireless ? (
            <div className="rounded-lg border bg-background px-3 py-2.5 text-sm font-medium">
              {WIRELESS_CONTRACTED_PLAN_LABEL}
            </div>
          ) : (
            <div className="space-y-2">
              {planOptions.map((option) => {
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
                          "contractedPlan" as keyof T,
                          option.value as ContractedPlan as T[keyof T]
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
      ) : null}
    </div>
  )
}
