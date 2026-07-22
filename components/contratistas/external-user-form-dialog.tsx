"use client"

import { useMemo, useState } from "react"

import { useCompanyRoles } from "@/components/configuracion/use-company-roles"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { requestProvisionEmployeeAccess } from "@/lib/auth/provision-client"
import { buildNextExternalEmployeeCode } from "@/lib/contractors/employees"
import { filterExternalCrews } from "@/lib/crews/origin"
import type { Employee } from "@/lib/types/employees"
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
  onCreated?: (employee: Employee) => void
}

type FormState = {
  firstName: string
  lastName: string
  nationalId: string
  phone: string
  email: string
  crewId: string
  roleInCrew: string
}

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  nationalId: "",
  phone: "",
  email: "",
  crewId: "",
  roleInCrew: "Operario",
}

export function ExternalUserFormDialog(props: ExternalUserFormDialogProps) {
  if (!props.open) {
    return <Dialog open={false} onOpenChange={props.onOpenChange} />
  }

  return (
    <ExternalUserFormDialogBody
      key={`create-${props.contractorId}`}
      {...props}
    />
  )
}

function ExternalUserFormDialogBody({
  open,
  onOpenChange,
  contractorId,
  contractorName,
  onCreated,
}: ExternalUserFormDialogProps) {
  const { employees, addEmployee, editEmployee } = useEmployees()
  const { crews, addMember } = useCrews()
  const { roles } = useCompanyRoles()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [baselineForm] = useState<FormState>(emptyForm)
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Nombre y apellido son obligatorios.")
      return
    }
    if (!form.nationalId.trim()) {
      setError("El DNI es obligatorio para crear el acceso a Field Agent.")
      return
    }
    if (!operarioRole) {
      setError("No se encontró el rol Operario de la empresa.")
      return
    }

    setIsSubmitting(true)
    try {
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
        employmentStatus: "active",
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

      const employee = createResult.employee

      if (
        !employee.systemAccess ||
        employee.systemRole !== "operario" ||
        employee.contractorId !== contractorId
      ) {
        await editEmployee(employee.id, {
          systemAccess: true,
          systemRole: "operario",
          roleId: operarioRole.id,
          contractorId,
          mustChangePassword: true,
        })
      }

      const provision = await requestProvisionEmployeeAccess(employee.id)
      if (!provision.success) {
        throw new Error(
          `Usuario creado, pero no se pudo provisionar Auth: ${provision.error}`
        )
      }

      if (form.crewId) {
        const memberResult = await addMember(form.crewId, {
          employeeId: employee.id,
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

      onCreated?.(employee)
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el usuario externo."
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
            <DialogTitle>Nuevo usuario externo</DialogTitle>
            <DialogDescription>
              Se crea como empleado con rol Operario (sin módulos admin), se
              provisiona Auth y puede usar el Field Agent actual.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
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
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nationalId: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Se usa como identidad de Auth (mismo flujo que empleados
                internos).
              </p>
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
                {isSubmitting ? "Creando…" : "Crear y provisionar"}
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
