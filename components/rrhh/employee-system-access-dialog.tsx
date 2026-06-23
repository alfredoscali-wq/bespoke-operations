"use client"

import { useEffect, useState } from "react"

import { SYSTEM_ROLE_LABELS, SYSTEM_ROLE_OPTIONS } from "@/lib/employees/constants"
import type { Employee, SystemRole, UpdateEmployeeInput } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SystemAccessFormState = {
  systemAccess: boolean
  systemRole: SystemRole
  mustChangePassword: boolean
}

type EmployeeSystemAccessDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
  onSubmit: (
    input: Pick<
      UpdateEmployeeInput,
      "systemAccess" | "systemRole" | "mustChangePassword"
    >
  ) => Promise<void>
}

function buildFormState(employee: Employee): SystemAccessFormState {
  return {
    systemAccess: employee.systemAccess,
    systemRole: employee.systemRole,
    mustChangePassword: employee.mustChangePassword,
  }
}

export function EmployeeSystemAccessDialog({
  open,
  onOpenChange,
  employee,
  onSubmit,
}: EmployeeSystemAccessDialogProps) {
  const [form, setForm] = useState<SystemAccessFormState>(() =>
    buildFormState(employee)
  )
  const [baselineForm, setBaselineForm] = useState<SystemAccessFormState>(() =>
    buildFormState(employee)
  )
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

  useEffect(() => {
    if (!open) return

    setError(null)
    const nextForm = buildFormState(employee)
    setForm(nextForm)
    setBaselineForm(nextForm)
  }, [open, employee])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await onSubmit({
        systemAccess: form.systemAccess,
        systemRole: form.systemRole,
        mustChangePassword: form.mustChangePassword,
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar el acceso."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="sm:max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>Editar acceso al sistema</DialogTitle>
            <DialogDescription>
              Configure el rol y permisos de acceso para{" "}
              {employee.preferredName?.trim() ||
                [employee.firstName, employee.lastName].filter(Boolean).join(" ")}
              . El usuario de acceso será el DNI registrado en RRHH.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Usuario (DNI)</p>
              <p className="mt-0.5 text-sm font-medium">
                {employee.nationalId?.trim() || "Sin DNI registrado"}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="systemAccess"
                checked={form.systemAccess}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    systemAccess: checked === true,
                  }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="systemAccess" className="leading-none">
                  Acceso habilitado
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite que el empleado ingrese a la plataforma cuando el
                  inicio de sesión esté disponible.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemRole">Rol del sistema</Label>
              <Select
                value={form.systemRole}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    systemRole: value as SystemRole,
                  }))
                }
              >
                <SelectTrigger id="systemRole" className="w-full">
                  <SelectValue placeholder="Seleccione rol" />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {SYSTEM_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="mustChangePassword"
                checked={form.mustChangePassword}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    mustChangePassword: checked === true,
                  }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor="mustChangePassword" className="leading-none">
                  Debe cambiar contraseña
                </Label>
                <p className="text-xs text-muted-foreground">
                  El empleado deberá establecer una nueva contraseña en su
                  primer acceso.
                </p>
              </div>
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
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
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
