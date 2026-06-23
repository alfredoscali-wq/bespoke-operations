"use client"

import { useEffect, useMemo, useState } from "react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  CREW_STATUS_LABELS,
} from "@/lib/crews/constants"
import {
  isCrewManuallyInactive,
  resolveAutomaticCrewStatus,
  resolveCrewStatus,
} from "@/lib/crews/status-workflow"
import { resolveCrewSupervisorDisplay } from "@/lib/crews/supervisor"
import {
  getEmployeeFullName,
  getSupervisorEmployees,
} from "@/lib/employees/utils"
import type { Crew, NewCrewInput } from "@/lib/types/crews"
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

type CrewFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  crew?: Crew
  onSubmit: (input: NewCrewInput) => Promise<void>
}

type CrewFormState = {
  name: string
  description: string
  supervisorEmployeeId: string
  notes: string
  manuallyInactive: boolean
}

const emptyForm: CrewFormState = {
  name: "",
  description: "",
  supervisorEmployeeId: "",
  notes: "",
  manuallyInactive: false,
}

export function CrewFormDialog({
  open,
  onOpenChange,
  mode,
  crew,
  onSubmit,
}: CrewFormDialogProps) {
  const { tasks } = useTasks()
  const { employees, getEmployee } = useEmployees()
  const [form, setForm] = useState<CrewFormState>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<CrewFormState>(emptyForm)
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

  const supervisorOptions = useMemo(
    () => getSupervisorEmployees(employees),
    [employees]
  )

  const legacySupervisorDisplay = useMemo(() => {
    if (!crew) return null
    return resolveCrewSupervisorDisplay(crew, getEmployee)
  }, [crew, getEmployee])

  const operationalStatus = useMemo(() => {
    if (!crew) return "activa" as const
    return resolveCrewStatus(crew, tasks)
  }, [crew, tasks])

  const automaticStatus = useMemo(() => {
    if (!crew) return "activa" as const
    return resolveAutomaticCrewStatus(crew, tasks)
  }, [crew, tasks])

  useEffect(() => {
    if (!open) return

    setError(null)
    const nextForm =
      mode === "edit" && crew
        ? {
            name: crew.name,
            description: crew.description,
            supervisorEmployeeId: crew.supervisorEmployeeId ?? "",
            notes: crew.notes,
            manuallyInactive: isCrewManuallyInactive(crew),
          }
        : emptyForm

    setForm(nextForm)
    setBaselineForm(nextForm)
  }, [open, mode, crew])

  function updateField<K extends keyof CrewFormState>(
    key: K,
    value: CrewFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.")
      return
    }

    if (!form.supervisorEmployeeId) {
      setError("Seleccione un supervisor.")
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        supervisorEmployeeId: form.supervisorEmployeeId,
        notes: form.notes.trim(),
        manuallyInactive:
          mode === "edit" ? form.manuallyInactive : undefined,
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la cuadrilla."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid =
    form.name.trim() !== "" && form.supervisorEmployeeId !== ""

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
            {mode === "create" ? "Nueva cuadrilla" : "Editar cuadrilla"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Registre una cuadrilla de trabajo en el sistema."
              : "Actualice la información de la cuadrilla."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crew-name">Nombre</Label>
            <Input
              id="crew-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Ej. Cuadrilla Norte"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="crew-description">Descripción</Label>
            <Textarea
              id="crew-description"
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="Especialidad o alcance de la cuadrilla..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Supervisor</Label>
            {mode === "edit" &&
              legacySupervisorDisplay?.isLegacy &&
              !form.supervisorEmployeeId && (
                <p className="text-xs text-amber-700">
                  Supervisor legacy: {legacySupervisorDisplay.displayName}.
                  Seleccione un empleado tipo Supervisor para vincularlo.
                </p>
              )}
            <Select
              value={form.supervisorEmployeeId || undefined}
              onValueChange={(value) =>
                updateField("supervisorEmployeeId", value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccione supervisor" />
              </SelectTrigger>
              <SelectContent>
                {supervisorOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No hay supervisores activos en RRHH
                  </SelectItem>
                ) : (
                  supervisorOptions.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.employeeCode} · {getEmployeeFullName(employee)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {mode === "create" ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Estado inicial:{" "}
              <span className="font-medium text-foreground">Activa</span>{" "}
              (automático según tareas asignadas).
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estado operativo
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {CREW_STATUS_LABELS[operationalStatus]}
                  {!form.manuallyInactive && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      (automático
                      {automaticStatus === "en-campo"
                        ? " — tareas en campo"
                        : " — sin tareas activas"}
                      )
                    </span>
                  )}
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.manuallyInactive}
                  onChange={(event) =>
                    updateField("manuallyInactive", event.target.checked)
                  }
                  className="mt-0.5 size-4 rounded border border-input accent-primary"
                />
                <span>
                  Marcar cuadrilla como inactiva
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Vacaciones, licencia, fuera de servicio o deshabilitada
                    temporalmente.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="crew-notes">Observaciones</Label>
            <Textarea
              id="crew-notes"
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Notas operativas..."
              rows={2}
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
                  ? "Crear cuadrilla"
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
