"use client"

import { useEffect, useMemo, useState } from "react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { AVAILABILITY_TYPE_OPTIONS } from "@/lib/availability/constants"
import { validateAvailabilityInput } from "@/lib/availability/utils"
import type {
  AvailabilityType,
  CreateEmployeeAvailabilityInput,
  EmployeeAvailability,
} from "@/lib/types/availability"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DiscardChangesDialog,
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AvailabilityFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  record?: EmployeeAvailability
  onSubmit: (input: CreateEmployeeAvailabilityInput) => Promise<void>
}

type FormState = {
  employeeId: string
  availabilityType: AvailabilityType
  startDate: string
  endDate: string
  reason: string
}

function buildDefaultForm(): FormState {
  const today = new Date().toISOString().slice(0, 10)

  return {
    employeeId: "",
    availabilityType: "VACATION",
    startDate: today,
    endDate: today,
    reason: "",
  }
}

function buildEditForm(record: EmployeeAvailability): FormState {
  return {
    employeeId: record.employeeId,
    availabilityType: record.availabilityType,
    startDate: record.startDate,
    endDate: record.endDate,
    reason: record.reason ?? "",
  }
}

export function AvailabilityFormDialog({
  open,
  onOpenChange,
  mode,
  record,
  onSubmit,
}: AvailabilityFormDialogProps) {
  const { employees } = useEmployees()
  const [form, setForm] = useState<FormState>(buildDefaultForm)
  const [baselineForm, setBaselineForm] = useState<FormState>(buildDefaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  const employeeOptions = useMemo(
    () =>
      [...employees].sort((a, b) =>
        getEmployeeDisplayName(a).localeCompare(getEmployeeDisplayName(b), "es")
      ),
    [employees]
  )

  useEffect(() => {
    if (!open) return

    setError(null)
    const nextForm =
      mode === "edit" && record
        ? buildEditForm(record)
        : {
            ...buildDefaultForm(),
            employeeId: employeeOptions[0]?.id ?? "",
          }

    setForm(nextForm)
    setBaselineForm(nextForm)
  }, [open, mode, record, employeeOptions])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validationError = validateAvailabilityInput(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        employeeId: form.employeeId,
        availabilityType: form.availabilityType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined,
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la novedad."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    form.employeeId !== "" &&
    form.startDate !== "" &&
    form.endDate !== "" &&
    form.endDate >= form.startDate

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva novedad" : "Editar novedad"}
          </DialogTitle>
          <DialogDescription>
            Registre vacaciones, licencias, capacitaciones u otras ausencias del
            personal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Empleado</Label>
            <Select
              value={form.employeeId}
              onValueChange={(value) => updateField("employeeId", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar empleado" />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.employeeCode} — {getEmployeeDisplayName(employee)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de novedad</Label>
            <Select
              value={form.availabilityType}
              onValueChange={(value) =>
                updateField("availabilityType", value as AvailabilityType)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="availability-start-date">Fecha inicio</Label>
              <Input
                id="availability-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability-end-date">Fecha fin</Label>
              <Input
                id="availability-end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability-reason">Motivo</Label>
            <Textarea
              id="availability-reason"
              value={form.reason}
              onChange={(event) => updateField("reason", event.target.value)}
              placeholder="Detalle opcional de la novedad..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : mode === "create"
                  ? "Registrar novedad"
                  : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
        </ProtectedFormDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
