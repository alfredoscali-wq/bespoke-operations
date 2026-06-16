"use client"

import { useEffect, useMemo, useState } from "react"

import {
  EMPLOYEE_DEPARTMENT_OPTIONS,
  EMPLOYEE_TYPE_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
} from "@/lib/employees/constants"
import type {
  Employee,
  EmployeeType,
  EmploymentStatus,
  NewEmployeeInput,
} from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type EmployeeFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  employee?: Employee
  onSubmit: (input: NewEmployeeInput) => Promise<void>
}

type EmployeeFormState = {
  employeeCode: string
  firstName: string
  lastName: string
  preferredName: string
  nationalId: string
  birthDate: string
  email: string
  phone: string
  jobTitle: string
  department: string
  employeeType: EmployeeType
  employmentStatus: EmploymentStatus
  hireDate: string
  terminationDate: string
  notes: string
}

const emptyForm: EmployeeFormState = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  preferredName: "",
  nationalId: "",
  birthDate: "",
  email: "",
  phone: "",
  jobTitle: "",
  department: EMPLOYEE_DEPARTMENT_OPTIONS[0],
  employeeType: "operario",
  employmentStatus: "active",
  hireDate: "",
  terminationDate: "",
  notes: "",
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employee,
  onSubmit,
}: EmployeeFormDialogProps) {
  const [form, setForm] = useState<EmployeeFormState>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showTerminationWarning = useMemo(
    () =>
      form.employmentStatus === "inactive" && form.terminationDate.trim() === "",
    [form.employmentStatus, form.terminationDate]
  )

  useEffect(() => {
    if (!open) return

    setError(null)
    setForm(
      mode === "edit" && employee
        ? {
            employeeCode: employee.employeeCode,
            firstName: employee.firstName,
            lastName: employee.lastName,
            preferredName: employee.preferredName ?? "",
            nationalId: employee.nationalId ?? "",
            birthDate: employee.birthDate ?? "",
            email: employee.email ?? "",
            phone: employee.phone ?? "",
            jobTitle: employee.jobTitle,
            department: employee.department || EMPLOYEE_DEPARTMENT_OPTIONS[0],
            employeeType: employee.employeeType,
            employmentStatus: employee.employmentStatus,
            hireDate: employee.hireDate ?? "",
            terminationDate: employee.terminationDate ?? "",
            notes: employee.notes,
          }
        : emptyForm
    )
  }, [open, mode, employee])

  function updateField<K extends keyof EmployeeFormState>(
    key: K,
    value: EmployeeFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.employeeCode.trim()) {
      setError("El código de empleado es obligatorio.")
      return
    }

    if (!form.firstName.trim()) {
      setError("El nombre es obligatorio.")
      return
    }

    if (!form.lastName.trim()) {
      setError("El apellido es obligatorio.")
      return
    }

    if (!form.jobTitle.trim()) {
      setError("El cargo es obligatorio.")
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        employeeCode: form.employeeCode.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        preferredName: form.preferredName.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
        birthDate: form.birthDate || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        employeeType: form.employeeType,
        employmentStatus: form.employmentStatus,
        hireDate: form.hireDate || undefined,
        terminationDate: form.terminationDate || undefined,
        notes: form.notes.trim(),
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar al empleado."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    form.employeeCode.trim() !== "" &&
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.jobTitle.trim() !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo empleado" : "Editar empleado"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Registre un empleado en el sistema."
              : "Actualice la información del empleado."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employeeCode">Código</Label>
              <Input
                id="employeeCode"
                value={form.employeeCode}
                onChange={(event) =>
                  updateField("employeeCode", event.target.value)
                }
                placeholder="EMP-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalId">DNI / Identificación</Label>
              <Input
                id="nationalId"
                value={form.nationalId}
                onChange={(event) =>
                  updateField("nationalId", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(event) =>
                  updateField("firstName", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(event) =>
                  updateField("lastName", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredName">Nombre preferido</Label>
              <Input
                id="preferredName"
                value={form.preferredName}
                onChange={(event) =>
                  updateField("preferredName", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(event) =>
                  updateField("birthDate", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Cargo</Label>
              <Input
                id="jobTitle"
                value={form.jobTitle}
                onChange={(event) => updateField("jobTitle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Select
                value={form.department}
                onValueChange={(value) => updateField("department", value)}
              >
                <SelectTrigger id="department" className="w-full">
                  <SelectValue placeholder="Seleccione departamento" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_DEPARTMENT_OPTIONS.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeType">Tipo de empleado</Label>
              <Select
                value={form.employeeType}
                onValueChange={(value) =>
                  updateField("employeeType", value as EmployeeType)
                }
              >
                <SelectTrigger id="employeeType" className="w-full">
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employmentStatus">Estado laboral</Label>
              <Select
                value={form.employmentStatus}
                onValueChange={(value) =>
                  updateField("employmentStatus", value as EmploymentStatus)
                }
              >
                <SelectTrigger id="employmentStatus" className="w-full">
                  <SelectValue placeholder="Estado laboral" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hireDate">Fecha de ingreso</Label>
              <Input
                id="hireDate"
                type="date"
                value={form.hireDate}
                onChange={(event) => updateField("hireDate", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terminationDate">Fecha de baja</Label>
              <Input
                id="terminationDate"
                type="date"
                value={form.terminationDate}
                onChange={(event) =>
                  updateField("terminationDate", event.target.value)
                }
              />
              {showTerminationWarning && (
                <p className="text-xs text-amber-700">
                  Se recomienda registrar la fecha de baja para empleados
                  inactivos.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : mode === "create"
                  ? "Registrar empleado"
                  : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
