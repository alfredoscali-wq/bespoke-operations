"use client"

import {
  formatInstallationCostInput,
  WORK_ORDER_PAYMENT_METHOD_OPTIONS,
} from "@/lib/tasks/commercial-plan"
import type { WorkOrderPaymentMethod } from "@/lib/tasks/commercial-plan"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type WorkOrderAmountToCollectFieldProps = {
  /** Dígitos sin formato (mismo contrato que el antiguo installationCost). */
  value: string
  onChange: (value: string) => void
  paymentMethod?: WorkOrderPaymentMethod | ""
  onPaymentMethodChange?: (value: WorkOrderPaymentMethod | "") => void
  showPaymentMethod?: boolean
  id?: string
}

export function WorkOrderAmountToCollectField({
  value,
  onChange,
  paymentMethod = "",
  onPaymentMethodChange,
  showPaymentMethod = false,
  id = "wo-amount-to-collect",
}: WorkOrderAmountToCollectFieldProps) {
  function handleChange(rawValue: string) {
    const digits = rawValue.replace(/\D/g, "")
    onChange(digits)
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div
        className={
          showPaymentMethod
            ? "grid gap-4 sm:grid-cols-2"
            : "space-y-2"
        }
      >
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

        {showPaymentMethod && onPaymentMethodChange ? (
          <div className="space-y-2">
            <Label htmlFor={`${id}-payment-method`}>Medio de Pago</Label>
            <Select
              value={paymentMethod || undefined}
              onValueChange={(nextValue) =>
                onPaymentMethodChange(nextValue as WorkOrderPaymentMethod)
              }
            >
              <SelectTrigger id={`${id}-payment-method`}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {WORK_ORDER_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  )
}
