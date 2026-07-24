"use client"

import { useMemo, useState } from "react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  listTreasuryCategoriesForType,
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGINS,
  TREASURY_ORIGIN_LABELS,
  TREASURY_STATUSES,
  TREASURY_TYPE_LABELS,
  type TreasuryMovementType,
  type TreasuryOrigin,
} from "@/lib/tesoreria/categories"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"

type TreasuryMovementFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  movementType: TreasuryMovementType
}

type FormState = {
  movementDate: string
  amount: string
  category: string
  origin: TreasuryOrigin
  employeeId: string
  notes: string
  hasReceipt: "yes" | "no"
}

function todayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildInitialForm(type: TreasuryMovementType): FormState {
  const categories = listTreasuryCategoriesForType(type)
  return {
    movementDate: todayInputValue(),
    amount: "",
    category: categories[0]?.value ?? "otro",
    origin: TREASURY_ORIGINS.MANUAL,
    employeeId: "none",
    notes: "",
    hasReceipt: "no",
  }
}

export function TreasuryMovementFormDialog({
  open,
  onOpenChange,
  movementType,
}: TreasuryMovementFormDialogProps) {
  const { registerMovement } = useTreasury()
  const { employees } = useEmployees()
  const [form, setForm] = useState<FormState>(() =>
    buildInitialForm(movementType)
  )
  const [baseline] = useState<FormState>(() => buildInitialForm(movementType))
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = isFormStateDirty(form, baseline) || Boolean(receiptFile)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  const categories = useMemo(
    () => listTreasuryCategoriesForType(movementType),
    [movementType]
  )

  const employeeLabel =
    movementType === TREASURY_MOVEMENT_TYPES.EXPENSE
      ? "Entregado a"
      : "Empleado"

  const title =
    movementType === TREASURY_MOVEMENT_TYPES.INCOME
      ? "Registrar Ingreso"
      : "Registrar Egreso"

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const amount = Number(form.amount.replace(",", "."))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingrese un monto válido mayor a cero.")
      return
    }
    if (!form.movementDate) {
      setError("La fecha es obligatoria.")
      return
    }
    if (form.hasReceipt === "yes" && !receiptFile) {
      setError("Seleccione el archivo del comprobante.")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await registerMovement(
        {
          movementType,
          origin: form.origin,
          category: form.category,
          amount,
          movementDate: form.movementDate,
          employeeId: form.employeeId === "none" ? null : form.employeeId,
          status: TREASURY_STATUSES.CONFIRMED,
          notes: form.notes,
        },
        form.hasReceipt === "yes" ? receiptFile : null
      )

      if (!result.success) {
        setError(result.message ?? "No se pudo guardar el movimiento.")
        return
      }

      forceClose()
      setForm(buildInitialForm(movementType))
      setReceiptFile(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ProtectedFormDialogContent
        className="sm:max-w-lg"
        onRequestClose={requestClose}
        isDirty={isDirty}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Registro operativo. Complete solo los datos necesarios.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="treasury-date">Fecha</Label>
              <Input
                id="treasury-date"
                type="date"
                value={form.movementDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    movementDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treasury-amount">Monto</Label>
              <Input
                id="treasury-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, category: value }))
                }
              >
                <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Origen</Label>
              <Select
                value={form.origin}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    origin: value as TreasuryOrigin,
                  }))
                }
              >
                <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TREASURY_ORIGIN_LABELS) as TreasuryOrigin[]).map(
                    (origin) => (
                      <SelectItem key={origin} value={origin}>
                        {TREASURY_ORIGIN_LABELS[origin]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{employeeLabel}</Label>
            <Select
              value={form.employeeId}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, employeeId: value }))
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.lastName}, {employee.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Comprobante</Label>
            <Select
              value={form.hasReceipt}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  hasReceipt: value as "yes" | "no",
                }))
              }
            >
              <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">Sin comprobante</SelectItem>
                <SelectItem value="yes">Con comprobante</SelectItem>
              </SelectContent>
            </Select>
            {form.hasReceipt === "yes" ? (
              <Input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setReceiptFile(event.target.files?.[0] ?? null)
                }
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="treasury-notes">Observaciones</Label>
            <Textarea
              id="treasury-notes"
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Tipo: {TREASURY_TYPE_LABELS[movementType]}
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </ProtectedFormDialogContent>
    </Dialog>
  )
}
