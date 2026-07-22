"use client"

import { useMemo, useState } from "react"

import { useCompanyRoles } from "@/components/configuracion/use-company-roles"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { buildInitialCredentialsInfoMessage } from "@/lib/auth/initial-credentials-policy"
import {
  buildNextExternalEmployeeCode,
  isEmployeeNationalIdLocked,
} from "@/lib/contractors/employees"
import { filterExternalCrews } from "@/lib/crews/origin"
import type { Employee, EmploymentStatus } from "@/lib/types/employees"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ExternalUserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractorId: string
  contractorName: string
  mode?: "create" | "edit"
  employee?: Employee | null
  onSaved?: (employee: Employee) => void
}

type FormState = {
  firstName: string
  lastName: string
  nationalId: string
  phone: string
  email: string
  employmentStatus: EmploymentStatus
  crewId: string
  roleInCrew: string
}

function buildFormState(employee?: Employee | null): FormState {
  if (!employee) {
    return {
      firstName: "",
      lastName: "",
      nationalId: "",
      phone: "",
      email: "",
      employmentStatus: "active",
      crewId: "",
      roleInCrew: "Operario",
    }
  }

  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    nationalId: employee.nationalId ?? "",
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    employmentStatus: employee.employmentStatus,
    crewId: "",
    roleInCrew: "Operario",
  }
}

export function ExternalUserFormDialog(props: ExternalUserFormDialogProps) {
  if (!props.open) {
    return <Dialog open={false} onOpenChange={props.onOpenChange} />
  }

  const mode = props.mode ?? "create"
  return (
    <ExternalUserFormDialogBody
      key={
        mode === "edit"
          ? `edit-${props.employee?.id ?? "unknown"}`
          : `create-${props.contractorId}`
      }
      {...props}
      mode={mode}
    />
  )
}

function ExternalUserFormDialogBody({
  open,
  onOpenChange,
  contractorId,
  contractorName,
  mode = "create",
  employee,
  onSaved,
}: ExternalUserFormDialogProps) {
  const { employees, addEmployee, editEmployee, provisionEmployeeAccess } =
    useEmployees()
  const { crews, addMember } = useCrews()
  const { roles } = useCompanyRoles()
  const initial = buildFormState(employee)
  const [form, setForm] = useState<FormState>(initial)
  const [baselineForm] = useState<FormState>(initial)
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

  const contractorCrews = useMemo(
    () => filterExternalCrews(crews, contractorId),
    [crews, contractorId]
  )

  const operarioRole = useMemo(
    () => roles.find((role) => role.code === "operario") ?? null,
    [roles]
  )

  const nationalIdLocked = isEmployeeNationalIdLocked(employee)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Nombre y apellido son obligatorios.")
      return
    }
    if (!form.nationalId.trim()) {
      setError("El DNI es obligatorio para el acceso a Field Agent.")
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === "edit" && employee) {
        const result = await editEmployee(employee.id, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          ...(nationalIdLocked
            ? {}
            : { nationalId: form.nationalId.trim() }),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          employmentStatus: form.employmentStatus,
        })
        if (!result.success || !result.employee) {
          throw new Error(result.message ?? "No se pudo actualizar el usuario.")
        }
        onSaved?.(result.employee)
        forceClose()
        return
      }

      if (!operarioRole) {
        throw new Error("No se encontró el rol Operario de la empresa.")
      }

      const employeeCode = buildNextExternalEmployeeCode(
        employees.map((item) => item.employeeCode)
      )

      const createResult = await addEmployee({
        employeeCode,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nationalId: form.nationalId.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        jobTitle: "Operario externo",
        department: contractorName,
        employeeType: "operario",
        employmentStatus: form.employmentStatus,
        notes: `Usuario externo · ${contractorName}`,
        systemRole: "operario",
        systemAccess: true,
        mustChangePassword: true,
        roleId: operarioRole.id,
        contractorId,
      })

      if (!createResult.success || !createResult.employee) {
        throw new Error(
          createResult.message ?? "No se pudo crear el usuario externo."
        )
      }

      let saved = createResult.employee

      if (
        !saved.systemAccess ||
        saved.systemRole !== "operario" ||
        saved.contractorId !== contractorId
      ) {
        const patched = await editEmployee(saved.id, {
          systemAccess: true,
          systemRole: "operario",
          roleId: operarioRole.id,
          contractorId,
          mustChangePassword: true,
        })
        if (patched.employee) {
          saved = patched.employee
        }
      }

      const provision = await provisionEmployeeAccess(saved.id)
      if (!provision.success) {
        throw new Error(
          `Usuario creado, pero no se pudo provisionar Auth: ${provision.message ?? "error desconocido"}`
        )
      }
      if (provision.employee) {
        saved = provision.employee
      }

      if (form.crewId) {
        const memberResult = await addMember(form.crewId, {
          employeeId: saved.id,
          name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          role: form.roleInCrew.trim() || "Operario",
          phone: form.phone.trim() || undefined,
          active: true,
        })
        if (!memberResult.success) {
          throw new Error(
            `Usuario provisionado, pero no se pudo asignar a la cuadrilla: ${memberResult.message}`
          )
        }
      }

      onSaved?.(saved)
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el usuario externo."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "edit"
                ? "Editar usuario Field Agent"
                : "Nuevo usuario Field Agent"}
            </DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? "Actualizá los datos del usuario externo. La asignación a cuadrilla se gestiona aparte."
                : "Se crea como Operario (sin módulos admin), se provisiona Auth y usa el Field Agent actual."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "create" ? (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                role="note"
              >
                {buildInitialCredentialsInfoMessage(
                  form.nationalId.trim() || undefined
                )}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ext-user-first">Nombre *</Label>
                <Input
                  id="ext-user-first"
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ext-user-last">Apellido *</Label>
                <Input
                  id="ext-user-last"
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-user-dni">DNI *</Label>
              <Input
                id="ext-user-dni"
                value={form.nationalId}
                readOnly={nationalIdLocked}
                disabled={nationalIdLocked}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nationalId: event.target.value,
                  }))
                }
              />
              {nationalIdLocked ? (
                <p className="text-xs text-muted-foreground">
                  El DNI ya fue utilizado para crear el acceso al sistema.
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ext-user-phone">Teléfono</Label>
                <Input
                  id="ext-user-phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ext-user-email">Email</Label>
                <Input
                  id="ext-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {mode === "edit" ? (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={form.employmentStatus}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      employmentStatus: value as EmploymentStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Cuadrilla externa (opcional)</Label>
                  <Select
                    value={form.crewId || "__none__"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        crewId: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar luego" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin asignar ahora</SelectItem>
                      {contractorCrews.map((crew) => (
                        <SelectItem key={crew.id} value={crew.id}>
                          {crew.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.crewId ? (
                  <div className="space-y-2">
                    <Label htmlFor="ext-user-role">Rol en la cuadrilla</Label>
                    <Input
                      id="ext-user-role"
                      value={form.roleInCrew}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          roleInCrew: event.target.value,
                        }))
                      }
                    />
                  </div>
                ) : null}
              </>
            )}
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Guardando…"
                  : mode === "edit"
                    ? "Guardar"
                    : "Crear y provisionar"}
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
