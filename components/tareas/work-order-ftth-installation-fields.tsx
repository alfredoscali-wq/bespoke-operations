"use client"

import {
  getPlanOptionsForTechnology,
  sanitizePlanForTechnology,
  WIRELESS_CONTRACTED_PLAN_LABEL,
  type ContractedPlan,
} from "@/lib/tasks/commercial-plan"
import { isFtthTechnology } from "@/lib/tasks/ftth-installation"
import {
  WORK_ORDER_TECHNOLOGY_OPTIONS,
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

export type WorkOrderFtthInstallationValues = {
  contractedPlan: ContractedPlan | ""
  napBox: string
  napPort: string
  onuSerial: string
}

type WorkOrderFtthInstallationFieldsProps = {
  technology: WorkOrderTechnology | ""
  values: WorkOrderFtthInstallationValues
  onContractedPlanChange?: (plan: ContractedPlan) => void
  onNapBoxChange?: (value: string) => void
  onNapPortChange?: (value: string) => void
  onOnuSerialChange?: (value: string) => void
  readOnly?: boolean
  planReadOnly?: boolean
  showPlan?: boolean
  showInstallationFields?: boolean
  idPrefix?: string
  planLabel?: string
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function WorkOrderFtthInstallationFields({
  technology,
  values,
  onContractedPlanChange,
  onNapBoxChange,
  onNapPortChange,
  onOnuSerialChange,
  readOnly = false,
  planReadOnly,
  showPlan = true,
  showInstallationFields = true,
  idPrefix = "ftth",
  planLabel = "Plan *",
}: WorkOrderFtthInstallationFieldsProps) {
  if (!technology) {
    return null
  }

  const planOptions = getPlanOptionsForTechnology(technology)
  const isWireless = technology === "wireless"
  const planIsReadOnly = planReadOnly ?? readOnly
  const showFtthInputs = showInstallationFields && isFtthTechnology(technology)

  return (
    <div className="space-y-4">
      {showPlan ? (
        <div className="space-y-2">
          <Label>{planLabel}</Label>
          {planIsReadOnly ? (
            <ReadOnlyRow
              label={planLabel.replace(/\s*\*$/, "")}
              value={
                isWireless
                  ? WIRELESS_CONTRACTED_PLAN_LABEL
                  : planOptions.find((option) => option.value === values.contractedPlan)
                      ?.label ?? values.contractedPlan
              }
            />
          ) : isWireless ? (
            <div className="rounded-lg border bg-background px-3 py-2.5 text-sm font-medium">
              {WIRELESS_CONTRACTED_PLAN_LABEL}
            </div>
          ) : (
            <div className="space-y-2">
              {planOptions.map((option) => {
                const selected = values.contractedPlan === option.value

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
                      name={`${idPrefix}-contracted-plan`}
                      value={option.value}
                      checked={selected}
                      onChange={() => onContractedPlanChange?.(option.value)}
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

      {showFtthInputs ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-nap`}>NAP</Label>
            {readOnly ? (
              <ReadOnlyRow label="NAP" value={values.napBox} />
            ) : (
              <Input
                id={`${idPrefix}-nap`}
                value={values.napBox}
                onChange={(event) => onNapBoxChange?.(event.target.value)}
                placeholder="Caja NAP"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-port`}>Puerto</Label>
            {readOnly ? (
              <ReadOnlyRow label="Puerto" value={values.napPort} />
            ) : (
              <Input
                id={`${idPrefix}-port`}
                value={values.napPort}
                onChange={(event) => onNapPortChange?.(event.target.value)}
                placeholder="Puerto NAP"
              />
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-serial`}>Serial ONT</Label>
            {readOnly ? (
              <ReadOnlyRow label="Serial ONT" value={values.onuSerial} />
            ) : (
              <Input
                id={`${idPrefix}-serial`}
                value={values.onuSerial}
                onChange={(event) => onOnuSerialChange?.(event.target.value)}
                placeholder="Serial ONU / ONT"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type WorkOrderTechnologyStateSectionProps = {
  title: string
  description?: string
  technology: WorkOrderTechnology | ""
  contractedPlan: ContractedPlan | ""
  onTechnologyChange?: (technology: WorkOrderTechnology) => void
  onContractedPlanChange?: (plan: ContractedPlan) => void
  napBox?: string
  napPort?: string
  onuSerial?: string
  onNapBoxChange?: (value: string) => void
  onNapPortChange?: (value: string) => void
  onOnuSerialChange?: (value: string) => void
  readOnly?: boolean
  showInstallationFields?: boolean
  idPrefix?: string
  technologyLabel?: string
  planLabel?: string
}

export function WorkOrderTechnologyStateSection({
  title,
  description,
  technology,
  contractedPlan,
  onTechnologyChange,
  onContractedPlanChange,
  napBox = "",
  napPort = "",
  onuSerial = "",
  onNapBoxChange,
  onNapPortChange,
  onOnuSerialChange,
  readOnly = false,
  showInstallationFields = false,
  idPrefix = "tech-state",
  technologyLabel = "Tecnología *",
  planLabel = "Plan *",
}: WorkOrderTechnologyStateSectionProps) {
  function handleTechnologyChange(value: WorkOrderTechnology) {
    onTechnologyChange?.(value)
    onContractedPlanChange?.(
      sanitizePlanForTechnology(contractedPlan, value) as ContractedPlan
    )
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-technology`}>{technologyLabel}</Label>
        {readOnly ? (
          <p className="text-sm font-medium">
            {WORK_ORDER_TECHNOLOGY_OPTIONS.find((option) => option.value === technology)
              ?.label ?? "—"}
          </p>
        ) : (
          <Select
            value={technology || undefined}
            onValueChange={(value) =>
              handleTechnologyChange(value as WorkOrderTechnology)
            }
          >
            <SelectTrigger id={`${idPrefix}-technology`}>
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
        )}
      </div>

      {technology ? (
        <WorkOrderFtthInstallationFields
          technology={technology}
          values={{ contractedPlan, napBox, napPort, onuSerial }}
          onContractedPlanChange={onContractedPlanChange}
          onNapBoxChange={onNapBoxChange}
          onNapPortChange={onNapPortChange}
          onOnuSerialChange={onOnuSerialChange}
          readOnly={readOnly}
          showInstallationFields={showInstallationFields}
          idPrefix={idPrefix}
          planLabel={planLabel}
        />
      ) : null}
    </div>
  )
}
