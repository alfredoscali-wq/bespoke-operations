"use client"

import { useEffect } from "react"

import { useOtCatalogPlans } from "@/lib/isp/use-ot-catalog-plans"
import type { ContractedPlan } from "@/lib/tasks/commercial-plan"
import {
  WORK_ORDER_TECHNOLOGY_OPTIONS,
  type WorkOrderFormInput,
  type WorkOrderTechnology,
} from "@/lib/tasks/work-order"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
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
  | "serviceType"
  | "technology"
  | "contractedPlan"
  | "serviceCatalogId"
  | "installationIp"
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
  const { plans, loading } = useOtCatalogPlans(
    form.technology,
    form.serviceCatalogId || null
  )
  const isWireless = form.technology === "wireless"

  useEffect(() => {
    if (loading || !isWireless || plans.length !== 1) return

    const only = plans[0]
    if (
      form.serviceCatalogId === only.catalogId &&
      form.contractedPlan === only.contractedPlanCode
    ) {
      return
    }

    updateField(
      "contractedPlan" as keyof T,
      only.contractedPlanCode as ContractedPlan as T[keyof T]
    )
    updateField(
      "serviceCatalogId" as keyof T,
      (only.catalogId || "") as T[keyof T]
    )
  }, [
    form.contractedPlan,
    form.serviceCatalogId,
    isWireless,
    loading,
    plans,
  ])

  if (!showTechnology && !showPlan) {
    return null
  }

  function handleTechnologyChange(value: WorkOrderTechnology) {
    updateField("technology" as keyof T, value as T[keyof T])
    updateField("contractedPlan" as keyof T, "" as T[keyof T])
    updateField("serviceCatalogId" as keyof T, "" as T[keyof T])
    if (value !== "wireless") {
      updateField("installationIp" as keyof T, "" as T[keyof T])
    }
  }

  function handlePlanSelect(catalogId: string, contractedPlanCode: string) {
    updateField(
      "contractedPlan" as keyof T,
      contractedPlanCode as ContractedPlan as T[keyof T]
    )
    updateField("serviceCatalogId" as keyof T, catalogId as T[keyof T])
  }

  function isSelected(catalogId: string, contractedPlanCode: string) {
    if (form.serviceCatalogId && catalogId) {
      return form.serviceCatalogId === catalogId
    }
    return form.contractedPlan === contractedPlanCode
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
          {isWireless && plans.length <= 1 ? (
            <div className="rounded-lg border bg-background px-3 py-2.5 text-sm font-medium">
              {plans[0]?.label ?? (loading ? "Cargando plan…" : "Sin plan activo")}
            </div>
          ) : plans.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No hay planes activos para esta tecnología.
            </p>
          ) : (
            <div className="space-y-2">
              {plans.map((option) => {
                const selected = isSelected(
                  option.catalogId,
                  option.contractedPlanCode
                )

                return (
                  <label
                    key={option.catalogId || option.contractedPlanCode}
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
                      value={option.catalogId || option.contractedPlanCode}
                      checked={selected}
                      onChange={() =>
                        handlePlanSelect(
                          option.catalogId,
                          option.contractedPlanCode
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

      {isWireless ? (
        <div className="space-y-2">
          <Label htmlFor="installation-ip">IP de Instalación *</Label>
          <Input
            id="installation-ip"
            value={form.installationIp}
            onChange={(event) =>
              updateField(
                "installationIp" as keyof T,
                event.target.value as T[keyof T]
              )
            }
            placeholder="Ej: 192.168.100.15"
            autoComplete="off"
          />
        </div>
      ) : null}
    </div>
  )
}
