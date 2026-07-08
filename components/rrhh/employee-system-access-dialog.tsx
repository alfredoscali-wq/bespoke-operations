"use client"

import { useEffect, useMemo, useState } from "react"

import { useCompanyRoles } from "@/components/configuracion/use-company-roles"
import { SYSTEM_ROLE_LABELS } from "@/lib/employees/constants"
import type { Employee, UpdateEmployeeInput } from "@/lib/types/employees"
import {
  isCustomCompanyRole,
  listFixedCompanyAreas,
  resolveDefaultAreaCodeForSystemRole,
} from "@/lib/roles/company-areas"
import { mapRoleCodeToSystemRole } from "@/lib/roles/role-utils"
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
  roleId: string
  mustChangePassword: boolean
}

type EmployeeSystemAccessDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee
  onSubmit: (
    input: Pick<
      UpdateEmployeeInput,
      "systemAccess" | "roleId" | "systemRole" | "mustChangePassword"
    >
  ) => Promise<void>
}

function buildFormState(employee: Employee): SystemAccessFormState {
  return {
    systemAccess: employee.systemAccess,
    roleId: employee.roleId ?? "",
    mustChangePassword: employee.mustChangePassword,
  }
}

export function EmployeeSystemAccessDialog({
  open,
  onOpenChange,
  employee,
  onSubmit,
}: EmployeeSystemAccessDialogProps) {
  const { roles, isLoading: isLoadingRoles } = useCompanyRoles()
  const [form, setForm] = useState<SystemAccessFormState>(() =>
    buildFormState(employee)
  )
  const [baselineForm, setBaselineForm] = useState<SystemAccessFormState>(() =>
    buildFormState(employee)
  )
  const fixedAreas = useMemo(() => listFixedCompanyAreas(roles), [roles])
  const areaOptions = useMemo(() => {
    const selectedRole = roles.find((role) => role.id === form.roleId)

    if (selectedRole && isCustomCompanyRole(selectedRole)) {
      return [selectedRole, ...fixedAreas.filter((area) => area.id !== selectedRole.id)]
    }

    return fixedAreas
  }, [fixedAreas, form.roleId, roles])
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

  useEffect(() => {
    if (!open || form.roleId || roles.length === 0) {
      return
    }

    const fallbackRole =
      roles.find(
        (role) => role.code === resolveDefaultAreaCodeForSystemRole(employee.systemRole)
      ) ?? fixedAreas[0]

    if (fallbackRole) {
      setForm((current) => ({ ...current, roleId: fallbackRole.id }))
      setBaselineForm((current) => ({ ...current, roleId: fallbackRole.id }))
    }
  }, [employee.systemRole, fixedAreas, form.roleId, open, roles])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.roleId) {
      setError("Seleccione un Área para el empleado.")
      return
    }

    const selectedRole = roles.find((role) => role.id === form.roleId)

    if (!selectedRole) {
      setError("El Área seleccionada no es válida.")
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        systemAccess: form.systemAccess,
        roleId: form.roleId,
        systemRole: mapRoleCodeToSystemRole(selectedRole.code),
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
              Configure el Área y permisos de acceso para{" "}
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
              <Label htmlFor="employeeArea">Área</Label>
              <Select
                value={form.roleId}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    roleId: value,
                  }))
                }
                disabled={isLoadingRoles}
              >
                <SelectTrigger id="employeeArea" className="w-full">
                  <SelectValue placeholder="Seleccione un Área" />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.roleId && fixedAreas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Área legacy: {SYSTEM_ROLE_LABELS[employee.systemRole]}
                </p>
              ) : null}
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
