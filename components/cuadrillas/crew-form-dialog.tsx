"use client"

import { useEffect, useState } from "react"

import type { Crew, CrewStatus, NewCrewInput } from "@/lib/types/crews"
import {
  CREW_STATUS_OPTIONS,
  CREW_SUPERVISOR_OPTIONS,
} from "@/lib/crews/constants"
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

const emptyForm: NewCrewInput = {
  name: "",
  description: "",
  supervisor: CREW_SUPERVISOR_OPTIONS[0],
  status: "activa",
  notes: "",
}

export function CrewFormDialog({
  open,
  onOpenChange,
  mode,
  crew,
  onSubmit,
}: CrewFormDialogProps) {
  const [form, setForm] = useState<NewCrewInput>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setError(null)
    setForm(
      mode === "edit" && crew
        ? {
            name: crew.name,
            description: crew.description,
            supervisor: crew.supervisor,
            status: crew.status,
            notes: crew.notes,
          }
        : emptyForm
    )
  }, [open, mode, crew])

  function updateField<K extends keyof NewCrewInput>(
    key: K,
    value: NewCrewInput[K]
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
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        notes: form.notes.trim(),
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

          <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  updateField("status", value as CrewStatus)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREW_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
