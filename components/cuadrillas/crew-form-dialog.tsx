"use client"

import { useEffect, useMemo, useState } from "react"

import { useTasks } from "@/components/tareas/tasks-provider"
import type { Crew, NewCrewInput } from "@/lib/types/crews"
import {
  CREW_STATUS_LABELS,
  CREW_SUPERVISOR_OPTIONS,
} from "@/lib/crews/constants"
import {
  isCrewManuallyInactive,
  resolveAutomaticCrewStatus,
  resolveCrewStatus,
} from "@/lib/crews/status-workflow"
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
  supervisor: string
  notes: string
  manuallyInactive: boolean
}

const emptyForm: CrewFormState = {
  name: "",
  description: "",
  supervisor: CREW_SUPERVISOR_OPTIONS[0],
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
  const [form, setForm] = useState<CrewFormState>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setForm(
      mode === "edit" && crew
        ? {
            name: crew.name,
            description: crew.description,
            supervisor: crew.supervisor,
            notes: crew.notes,
            manuallyInactive: isCrewManuallyInactive(crew),
          }
        : emptyForm
    )
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

    setIsSubmitting(true)

    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        supervisor: form.supervisor,
        notes: form.notes.trim(),
        manuallyInactive:
          mode === "edit" ? form.manuallyInactive : undefined,
      })
      onOpenChange(false)
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

  const isValid = form.name.trim() !== "" && form.supervisor !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
            <Select
              value={form.supervisor}
              onValueChange={(value) => updateField("supervisor", value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREW_SUPERVISOR_OPTIONS.map((supervisor) => (
                  <SelectItem key={supervisor} value={supervisor}>
                    {supervisor}
                  </SelectItem>
                ))}
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
              onClick={() => onOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  )
}
