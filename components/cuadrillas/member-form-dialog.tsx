"use client"

import { useEffect, useMemo, useState } from "react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import type { Crew, CrewMember, NewCrewMemberInput } from "@/lib/types/crews"
import {
  getAssignedEmployeeIds,
  resolveCrewMemberDisplay,
} from "@/lib/crews/utils"
import { validateMemberNotSupervisor } from "@/lib/crews/supervisor"
import {
  getEmployeeFullName,
  isEmployeeAvailable,
} from "@/lib/employees/utils"
import { Button } from "@/components/ui/button"
import { TelLink } from "@/components/ui/tel-link"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MemberFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  crew: Crew
  member?: CrewMember
  onSubmit: (input: NewCrewMemberInput) => Promise<void>
}

type MemberFormState = {
  employeeId: string
  name: string
  role: string
  phone: string
  active: boolean
}

const emptyForm: MemberFormState = {
  employeeId: "",
  name: "",
  role: "",
  phone: "",
  active: true,
}

const ROLE_OTHER_VALUE = "__other__"

type MemberFormBaseline = {
  form: MemberFormState
  roleInputMode: "preset" | "other"
}

export function MemberFormDialog({
  open,
  onOpenChange,
  mode,
  crew,
  member,
  onSubmit,
}: MemberFormDialogProps) {
  const { employees, getEmployee } = useEmployees()
  const [form, setForm] = useState<MemberFormState>(emptyForm)
  const [roleInputMode, setRoleInputMode] = useState<"preset" | "other">("preset")
  const [baseline, setBaseline] = useState<MemberFormBaseline>({
    form: emptyForm,
    roleInputMode: "preset",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = isFormStateDirty({ form, roleInputMode }, baseline)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  const isLegacyMember = mode === "edit" && member && !member.employeeId
  const isLinkedMember = mode === "edit" && member && !!member.employeeId

  const assignedEmployeeIds = useMemo(
    () => getAssignedEmployeeIds(crew.members, member?.id),
    [crew.members, member?.id]
  )

  const availableEmployees = useMemo(() => {
    return employees
      .filter(isEmployeeAvailable)
      .filter((employee) => !assignedEmployeeIds.includes(employee.id))
      .filter((employee) => employee.id !== crew.supervisorEmployeeId)
      .sort((a, b) => {
        const codeCompare = a.employeeCode.localeCompare(b.employeeCode, "es")
        if (codeCompare !== 0) return codeCompare
        return getEmployeeFullName(a).localeCompare(getEmployeeFullName(b), "es")
      })
  }, [employees, assignedEmployeeIds, crew.supervisorEmployeeId])

  const roleOptions = useMemo(() => {
    const titles = new Set<string>()

    employees.filter(isEmployeeAvailable).forEach((employee) => {
      const title = employee.jobTitle.trim()
      if (title) titles.add(title)
    })

    if (form.role.trim()) {
      titles.add(form.role.trim())
    }

    return Array.from(titles).sort((a, b) => a.localeCompare(b, "es"))
  }, [employees, form.role])

  const linkedEmployee = useMemo(() => {
    if (!member?.employeeId) return undefined
    return getEmployee(member.employeeId)
  }, [member?.employeeId, getEmployee])

  const linkedDisplay = useMemo(() => {
    if (!member) return null
    return resolveCrewMemberDisplay(member, getEmployee)
  }, [member, getEmployee])

  useEffect(() => {
    if (!open) return

    setError(null)
    const nextForm =
      mode === "edit" && member
        ? {
            employeeId: member.employeeId ?? "",
            name: member.name,
            role: member.role,
            phone: member.phone ?? "",
            active: member.active,
          }
        : emptyForm

    setForm(nextForm)

    const role = nextForm.role.trim()
    const knownTitles = new Set(
      employees
        .filter(isEmployeeAvailable)
        .map((employee) => employee.jobTitle.trim())
        .filter(Boolean)
    )

    const nextRoleInputMode =
      role !== "" && !knownTitles.has(role) ? "other" : "preset"

    setForm(nextForm)
    setRoleInputMode(nextRoleInputMode)
    setBaseline({ form: nextForm, roleInputMode: nextRoleInputMode })
  }, [open, mode, member, employees])

  function updateField<K extends keyof MemberFormState>(
    key: K,
    value: MemberFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleEmployeeChange(employeeId: string) {
    updateField("employeeId", employeeId)

    const employee = getEmployee(employeeId)
    const jobTitle = employee?.jobTitle.trim()

    if (jobTitle) {
      updateField("role", jobTitle)
      setRoleInputMode("preset")
      return
    }

    updateField("role", "")
    setRoleInputMode("other")
  }

  function handleRolePresetChange(value: string) {
    if (value === ROLE_OTHER_VALUE) {
      setRoleInputMode("other")
      updateField("role", "")
      return
    }

    setRoleInputMode("preset")
    updateField("role", value)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (mode === "create") {
      if (!form.employeeId) {
        setError("Seleccione un empleado.")
        return
      }

      const employee = getEmployee(form.employeeId)
      if (!employee) {
        setError("El empleado seleccionado no está disponible.")
        return
      }

      const supervisorValidation = validateMemberNotSupervisor(
        crew,
        employee.id
      )
      if (!supervisorValidation.ok) {
        setError(supervisorValidation.message)
        return
      }

      if (!form.role.trim()) {
        setError("El rol en cuadrilla es obligatorio.")
        return
      }

      setIsSubmitting(true)

      try {
        await onSubmit({
          employeeId: employee.id,
          name: getEmployeeFullName(employee),
          role: form.role.trim(),
          phone: employee.phone,
          active: form.active,
        })
        forceClose()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "No se pudo guardar el integrante."
        )
      } finally {
        setIsSubmitting(false)
      }

      return
    }

    if (!form.role.trim()) {
      setError("El rol en cuadrilla es obligatorio.")
      return
    }

    if (isLegacyMember && !form.name.trim()) {
      setError("Nombre y rol son obligatorios.")
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        employeeId: member?.employeeId ?? null,
        name: isLegacyMember ? form.name.trim() : member!.name,
        role: form.role.trim(),
        phone: isLegacyMember
          ? form.phone?.trim() || undefined
          : member?.phone,
        active: form.active,
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el integrante."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    mode === "create"
      ? form.employeeId !== "" && form.role.trim() !== ""
      : isLegacyMember
        ? form.name.trim() !== "" && form.role.trim() !== ""
        : form.role.trim() !== ""

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="sm:max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Agregar integrante" : "Editar integrante"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Seleccione un empleado activo y defina su rol en la cuadrilla."
              : isLegacyMember
                ? "Actualice los datos del integrante legacy."
                : "Actualice el rol o estado del integrante en la cuadrilla."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="member-employee">Empleado</Label>
              <Select
                value={form.employeeId}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger id="member-employee" className="w-full">
                  <SelectValue placeholder="Seleccione un empleado" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No hay empleados activos disponibles
                    </SelectItem>
                  ) : (
                    availableEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.employeeCode} - {getEmployeeFullName(employee)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLinkedMember && linkedDisplay && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">
                {linkedDisplay.employeeCode
                  ? `${linkedDisplay.employeeCode} - ${linkedDisplay.fullName}`
                  : linkedDisplay.fullName}
              </p>
              {linkedEmployee?.phone && (
                <p className="text-xs text-muted-foreground">
                  <TelLink phone={linkedEmployee.phone} />
                </p>
              )}
            </div>
          )}

          {isLegacyMember && (
            <>
              <div className="space-y-2">
                <Label htmlFor="member-name">Nombre</Label>
                <Input
                  id="member-name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-phone">Teléfono (opcional)</Label>
                <Input
                  id="member-phone"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="+52 ..."
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="member-role">Rol en cuadrilla</Label>
            {roleInputMode === "preset" ? (
              <Select
                value={form.role || undefined}
                onValueChange={handleRolePresetChange}
              >
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                  <SelectItem value={ROLE_OTHER_VALUE}>Otra...</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input
                  id="member-role"
                  value={form.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  placeholder="Ej. Técnico Fibra"
                />
                {roleOptions.length > 0 && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={() => {
                      setRoleInputMode("preset")
                      if (!form.role.trim() && roleOptions[0]) {
                        updateField("role", roleOptions[0])
                      }
                    }}
                  >
                    Elegir de la lista
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="member-active"
              checked={form.active}
              onCheckedChange={(checked) =>
                updateField("active", checked === true)
              }
            />
            <Label htmlFor="member-active">Integrante activo</Label>
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
                  ? "Agregar"
                  : "Guardar"}
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
