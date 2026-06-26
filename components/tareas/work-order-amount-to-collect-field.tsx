"use client"

import { formatInstallationCostInput } from "@/lib/tasks/commercial-plan"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type WorkOrderAmountToCollectFieldProps = {
  /** Dígitos sin formato (mismo contrato que el antiguo installationCost). */
  value: string
  onChange: (value: string) => void
  id?: string
}

export function WorkOrderAmountToCollectField({
  value,
  onChange,
  id = "wo-amount-to-collect",
}: WorkOrderAmountToCollectFieldProps) {
  function handleChange(rawValue: string) {
    const digits = rawValue.replace(/\D/g, "")
    onChange(digits)
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="space-y-2">
        <Label htmlFor={id}>💰 Importe a cobrar al cliente</Label>
        <Input
          id={id}
          inputMode="numeric"
          value={formatInstallationCostInput(value)}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="$ 0"
        />
      </div>
    </div>
  )
}
