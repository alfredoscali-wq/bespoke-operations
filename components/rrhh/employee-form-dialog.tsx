"use client"

import { useEffect, useMemo, useState } from "react"

import { useEmployeeTypes } from "@/components/configuracion/use-employee-types"
import {
  buildEmployeeFormAreaOptions,
  EMPLOYEE_FORM_AREA_OPTIONS,
  resolveEmployeeFormDepartmentDefault,
} from "@/lib/employees/employee-form-catalog"
import {
  buildEmployeeFormTypeOptions,
  resolveDefaultEmployeeTypeId,
} from "@/lib/employees/employee-type-form"
import { resolveEmployeeTypePersistence } from "@/lib/employees/employee-type-legacy"
import { EMPLOYMENT_STATUS_OPTIONS } from "@/lib/employees/constants"
import { buildNextEmployeeCode } from "@/lib/employees/employee-codes"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listAllEmployeeCodes } from "@/lib/supabase/employees.browser"
import type {
  Employee,
  EmploymentStatus,
  NewEmployeeInput,
} from "@/lib/types/employees"
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
  employeeTypeId: string
  employmentStatus: EmploymentStatus
  hireDate: string
  terminationDate: string
  notes: string
}

function buildEmptyForm(defaultTypeId: string | null): EmployeeFormState {
  return {
    employeeCode: "",
    firstName: "",
    lastName: "",
    preferredName: "",
    nationalId: "",
    birthDate: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: EMPLOYEE_FORM_AREA_OPTIONS[0],
    employeeTypeId: defaultTypeId ?? "",
    employmentStatus: "active",
    hireDate: "",
    terminationDate: "",
    notes: "",
  }
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employee,
  onSubmit,
}: EmployeeFormDialogProps) {
  const { companyId } = useTenantCompanyId()
  const { items: employeeTypes, isLoading: isLoadingTypes } = useEmployeeTypes()
  const defaultTypeId = useMemo(
    () => resolveDefaultEmployeeTypeId(employeeTypes),
    [employeeTypes]
  )
  const [form, setForm] = useState<EmployeeFormState>(buildEmptyForm(null))
  const [baselineForm, setBaselineForm] = useState<EmployeeFormState>(
    buildEmptyForm(null)
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

  const showTerminationWarning = useMemo(
    () =>
      form.employmentStatus === "inactive" && form.terminationDate.trim() === "",
    [form.employmentStatus, form.terminationDate]
  )

  const areaOptions = useMemo(
    () =>
      buildEmployeeFormAreaOptions(
        mode === "edit" ? employee?.department ?? form.department : undefined
      ),
    [mode, employee?.department, form.department]
  )

  const employeeTypeOptions = useMemo(
    () =>
      buildEmployeeFormTypeOptions(
        employeeTypes,
        mode === "edit" ? form.employeeTypeId : undefined
      ),
    [employeeTypes, mode, form.employeeTypeId]
  )

  useEffect(() => {
    if (!open) return

    setError(null)
    const nextForm =
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
            department: resolveEmployeeFormDepartmentDefault(employee.department),
            employeeTypeId:
              employee.employeeTypeId ?? defaultTypeId ?? "",
            employmentStatus: employee.employmentStatus,
            hireDate: employee.hireDate ?? "",
            terminationDate: employee.terminationDate ?? "",
            notes: employee.notes,
          }
        : buildEmptyForm(defaultTypeId)

    setForm(nextForm)
    setBaselineForm(nextForm)
  }, [open, mode, employee, defaultTypeId])

  function updateField<K extends keyof EmployeeFormState>(
    key: K,
    value: EmployeeFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

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

    if (!form.employeeTypeId) {
      setError("Seleccione un tipo de empleado.")
      return
    }

    setIsSubmitting(true)

    try {
      let employeeCode: string
      if (mode === "edit" && employee) {
        employeeCode = employee.employeeCode
      } else {
        if (!companyId) {
          throw new Error("No se pudo resolver la empresa para generar el código.")
        }
        const codesResult = await listAllEmployeeCodes(companyId)
        if (codesResult.error || !codesResult.data) {
          throw new Error(
            codesResult.error?.message ??
              "No se pudieron obtener los códigos de empleado."
          )
        }
        employeeCode = buildNextEmployeeCode(codesResult.data)
      }

      const typeFields = resolveEmployeeTypePersistence({
        employeeTypeId: form.employeeTypeId,
        catalog: employeeTypes,
      })

      await onSubmit({
        employeeCode,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        preferredName: form.preferredName.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
        birthDate: form.birthDate || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        employeeTypeId: typeFields.employeeTypeId,
        employeeType: typeFields.employeeType,
        employmentStatus: form.employmentStatus,
        hireDate: form.hireDate || undefined,
        terminationDate: form.terminationDate || undefined,
        notes: form.notes.trim(),
      })
      forceClose()
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
    form.firstName.trim() !== "" &&
    form.lastName.trim() !== "" &&
    form.jobTitle.trim() !== "" &&
    form.employeeTypeId !== ""

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo Empleado" : "Editar Empleado"}
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
              <Label htmlFor="department">Departamento / Área organizacional</Label>
              <Select
                value={form.department}
                onValueChange={(value) => updateField("department", value)}
              >
                <SelectTrigger id="department" className="w-full">
                  <SelectValue placeholder="Seleccione departamento" />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeTypeId">Tipo de empleado</Label>
              <Select
                value={form.employeeTypeId}
                onValueChange={(value) => updateField("employeeTypeId", value)}
                disabled={isLoadingTypes || employeeTypeOptions.length === 0}
              >
                <SelectTrigger id="employeeTypeId" className="w-full">
                  <SelectValue placeholder="Seleccione tipo" />
                </SelectTrigger>
                <SelectContent>
                  {employeeTypeOptions.map((option) => (
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
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : mode === "create"
                  ? "Registrar Empleado"
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
