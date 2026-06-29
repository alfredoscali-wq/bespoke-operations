"use client"

import { useMemo } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getCrewsForTaskSelection } from "@/lib/crews/status-workflow"
import {
  WORK_ORDER_DURATION_PRESET_OPTIONS,
  WORK_ORDER_SHIFT_OPTIONS,
  type WorkOrderFormInput,
} from "@/lib/tasks/work-order"

type WorkOrderSchedulingFieldsProps = {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
}

export function WorkOrderSchedulingFields({
  form,
  updateField,
}: WorkOrderSchedulingFieldsProps) {
  const { crews } = useCrews()

  const selectableCrews = useMemo(
    () => getCrewsForTaskSelection(crews, form.crewId || null),
    [crews, form.crewId]
  )

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Programación</h3>

      <div className="space-y-2">
        <Label htmlFor="wo-scheduled-date">Fecha programada *</Label>
        <Input
          id="wo-scheduled-date"
          type="date"
          value={form.scheduledDate}
          onChange={(event) => updateField("scheduledDate", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wo-suggested-crew">Cuadrilla sugerida *</Label>
        <Select
          value={form.crewId || undefined}
          onValueChange={(value) => updateField("crewId", value)}
        >
          <SelectTrigger id="wo-suggested-crew">
            <SelectValue placeholder="Seleccionar cuadrilla" />
          </SelectTrigger>
          <SelectContent>
            {selectableCrews.map((crew) => (
              <SelectItem key={crew.id} value={crew.id}>
                {crew.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wo-shift">Turno *</Label>
        <Select
          value={form.shift || undefined}
          onValueChange={(value) =>
            updateField("shift", value as WorkOrderFormInput["shift"])
          }
        >
          <SelectTrigger id="wo-shift">
            <SelectValue placeholder="Seleccionar turno" />
          </SelectTrigger>
          <SelectContent>
            {WORK_ORDER_SHIFT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wo-estimated-duration">Duración estimada *</Label>
        <Select
          value={form.estimatedDurationPreset || undefined}
          onValueChange={(value) =>
            updateField(
              "estimatedDurationPreset",
              value as WorkOrderFormInput["estimatedDurationPreset"]
            )
          }
        >
          <SelectTrigger id="wo-estimated-duration">
            <SelectValue placeholder="Seleccionar duración" />
          </SelectTrigger>
          <SelectContent>
            {WORK_ORDER_DURATION_PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.estimatedDurationPreset === "other" ? (
          <div className="space-y-2">
            <Label htmlFor="wo-estimated-duration-custom">Minutos</Label>
            <Input
              id="wo-estimated-duration-custom"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.estimatedDurationCustomMinutes}
              onChange={(event) =>
                updateField("estimatedDurationCustomMinutes", event.target.value)
              }
              placeholder="Ej: 75"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
